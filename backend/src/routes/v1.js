import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { createRequireApiKey } from "../middleware/auth.js";
import { createEntry, deleteEntry, listEntries, updateEntry } from "../services/entryService.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { ApiError } from "../errors.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

function serializeItem(row) {
  return {
    id: row.id,
    name: row.text,
    status: row.status,
    description: row.details ?? null
  };
}

/**
 * Creates the external v1 API router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {import("express").RequestHandler} [options.requireApiKey] API key middleware override.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {typeof defaultSseManager} [options.sseManager] SSE broadcaster.
 * @returns {import("express").Router} Configured v1 router.
 */
export function createV1Router({
  pool = getPool(),
  requireApiKey,
  logger = defaultLogger,
  sseManager = defaultSseManager
} = {}) {
  const router = Router();
  const requireApiKeyMiddleware = requireApiKey ?? createRequireApiKey({ pool });

  router.use(requireApiKeyMiddleware);

  router.get("/lists", async (req, res, next) => {
    try {
      const result = await pool.query(
        `
          SELECT l.id, l.name
          FROM lists l
          LEFT JOIN list_members lm
            ON lm.list_id = l.id
           AND lm.user_id = $1
          WHERE l.owner_id = $1 OR lm.user_id = $1
          ORDER BY l.created_at ASC
        `,
        [req.user.sub]
      );

      res.json({
        lists: result.rows.map((row) => ({
          id: row.id,
          name: row.name
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  // Entry rules (access, limits, last_updated_by, events, push) live in the entry service that the
  // app API shares; these routes only parse input and serialise the v1 item shape.
  const contextOf = (req) => ({
    pool,
    sseManager,
    logger,
    userId: req.user.sub,
    listId: req.params.listId
  });

  /** Passes the API error for a non-ok service result to `next`. Returns true when it did. */
  function respondToFailure(result, next) {
    if (result.status === "forbidden") {
      next(new ApiError(403, "list.forbidden", "You do not have access to this list."));
      return true;
    }

    if (result.status === "not_found") {
      next(new ApiError(404, "item.not_found", "Item not found."));
      return true;
    }

    if (result.status === "limit_open") {
      next(
        new ApiError(
          422,
          "entry.limit_open",
          "This list has reached the maximum of 1,000 open items. Please complete or remove some items first."
        )
      );
      return true;
    }

    return false;
  }

  /** A description must be a string or null; anything else is a client error. */
  function isValidDescription(description) {
    return description === undefined || description === null || typeof description === "string";
  }

  router.get("/lists/:listId/items", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      next(new ApiError(404, "list.not_found", "List not found."));
      return;
    }

    try {
      const result = await listEntries(contextOf(req));

      if (respondToFailure(result, next)) {
        return;
      }

      res.json({
        items: result.entries.map(serializeItem)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/lists/:listId/items", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      next(new ApiError(404, "list.not_found", "List not found."));
      return;
    }

    const { name, description } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      next(new ApiError(400, "validation.item_name_required", "Item name is required."));
      return;
    }

    if (!isValidDescription(description)) {
      next(new ApiError(400, "validation.item_description_invalid", "Item description must be a string."));
      return;
    }

    try {
      const result = await createEntry(contextOf(req), { text: name.trim(), details: description });

      if (respondToFailure(result, next)) {
        return;
      }

      res.status(201).json({
        item: serializeItem(result.entry)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/lists/:listId/items/:itemId/toggle", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      next(new ApiError(404, "list.not_found", "List not found."));
      return;
    }

    if (!isValidUuid(req.params.itemId)) {
      next(new ApiError(404, "item.not_found", "Item not found."));
      return;
    }

    try {
      const result = await updateEntry(contextOf(req), { entryId: req.params.itemId, toggle: true });

      if (respondToFailure(result, next)) {
        return;
      }

      res.json({
        item: serializeItem(result.entry)
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/lists/:listId/items/:itemId", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      next(new ApiError(404, "list.not_found", "List not found."));
      return;
    }

    if (!isValidUuid(req.params.itemId)) {
      next(new ApiError(404, "item.not_found", "Item not found."));
      return;
    }

    const { name, description } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      next(new ApiError(400, "validation.item_name_required", "Item name is required."));
      return;
    }

    if (!isValidDescription(description)) {
      next(new ApiError(400, "validation.item_description_invalid", "Item description must be a string."));
      return;
    }

    try {
      const result = await updateEntry(contextOf(req), {
        entryId: req.params.itemId,
        text: name,
        hasDetails: "description" in (req.body ?? {}),
        details: description
      });

      if (respondToFailure(result, next)) {
        return;
      }

      res.json({
        item: serializeItem(result.entry)
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/lists/:listId/items/:itemId", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      next(new ApiError(404, "list.not_found", "List not found."));
      return;
    }

    if (!isValidUuid(req.params.itemId)) {
      next(new ApiError(404, "item.not_found", "Item not found."));
      return;
    }

    try {
      const result = await deleteEntry(contextOf(req), { entryId: req.params.itemId });

      if (respondToFailure(result, next)) {
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createV1Router;
