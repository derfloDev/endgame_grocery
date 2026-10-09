import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { requireAuth } from "../middleware/auth.js";
import { uuidParam } from "../middleware/validateUuid.js";
import { createEntry, deleteEntry, listEntries, updateEntry } from "../services/entryService.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { ApiError } from "../errors.js";

const forbidden = () => new ApiError(403, "list.forbidden", "You do not have access to this list.");
const openLimit = () =>
  new ApiError(422, "entry.limit_open", "This list has reached the maximum of 1,000 open entries. Please complete or remove some items first.");

/**
 * Creates the authenticated list entry router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {import("express").RequestHandler} [options.requireAuthMiddleware] Auth middleware.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {typeof defaultSseManager} [options.sseManager] SSE broadcaster.
 * @returns {import("express").Router} Configured entry router.
 */
export function createEntryRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth,
  logger = defaultLogger,
  sseManager = defaultSseManager
} = {}) {
  const router = Router({ mergeParams: true });

  router.use(requireAuthMiddleware);
  router.param("entryId", uuidParam("entry.not_found", "Entry not found."));

  // Business rules (access, limits, events, push) live in the entry service, which the v1 API
  // shares; the routes only parse input and serialise output.
  const contextOf = (req) => ({ pool, sseManager, logger, userId: req.user.sub, listId: req.params.id });

  router.get("/", async (req, res, next) => {
    try {
      const result = await listEntries(contextOf(req));

      if (result.status === "forbidden") {
        next(forbidden());
        return;
      }

      res.json({ entries: result.entries });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const { text, icon, details } = req.body ?? {};

    if (!text?.trim()) {
      next(new ApiError(400, "validation.entry_text_required", "Entry text is required."));
      return;
    }

    try {
      const result = await createEntry(contextOf(req), { text: text.trim(), icon, details });

      if (result.status === "forbidden") {
        next(forbidden());
        return;
      }

      if (result.status === "limit_open") {
        next(openLimit());
        return;
      }

      res.status(201).json({ entry: result.entry });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:entryId", async (req, res, next) => {
    const { text, status, icon, details } = req.body ?? {};
    const hasDetails = "details" in (req.body ?? {});
    // `icon: null` is a deliberate "remove the icon"; an absent key leaves it alone.
    const hasIcon = "icon" in (req.body ?? {});

    if (!text?.trim() && !status && icon === undefined) {
      next(new ApiError(400, "validation.entry_update_required", "At least one entry update field is required."));
      return;
    }

    if (status && !["open", "done"].includes(status)) {
      next(new ApiError(400, "validation.entry_status_invalid", "Entry status must be open or done."));
      return;
    }

    try {
      const result = await updateEntry(contextOf(req), {
        entryId: req.params.entryId,
        text,
        status,
        hasIcon,
        icon,
        hasDetails,
        details
      });

      if (result.status === "forbidden") {
        next(forbidden());
        return;
      }

      if (result.status === "not_found") {
        next(new ApiError(404, "entry.not_found", "Entry not found."));
        return;
      }

      res.json({ entry: result.entry });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:entryId", async (req, res, next) => {
    try {
      const result = await deleteEntry(contextOf(req), { entryId: req.params.entryId });

      if (result.status === "forbidden") {
        next(forbidden());
        return;
      }

      if (result.status === "not_found") {
        next(new ApiError(404, "entry.not_found", "Entry not found."));
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createEntryRouter;
