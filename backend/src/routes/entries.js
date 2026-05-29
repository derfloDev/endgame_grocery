import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { ensureListAccess } from "../middleware/listAccess.js";
import { requireAuth } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { enqueuePushJob } from "../workers/pushWorker.js";

const MAX_OPEN_ENTRIES_PER_LIST = 1000;
const MAX_DONE_ENTRIES_PER_LIST = 200;

function normalizeDetails(details) {
  if (typeof details !== "string") {
    return null;
  }

  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

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

  router.get("/", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.id, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const result = await pool.query(
        `
          SELECT
            e.id,
            e.list_id,
            e.text,
            e.status,
            e.icon,
            e.details,
            e.created_at,
            e.updated_at,
            e.last_updated_by,
            (
              lv.last_viewed_at IS NOT NULL
              AND e.updated_at > lv.last_viewed_at
              AND (e.last_updated_by IS NULL OR e.last_updated_by <> $2)
            ) AS is_changed
          FROM entries e
          LEFT JOIN list_views lv
            ON lv.list_id = e.list_id
           AND lv.user_id = $2
          WHERE e.list_id = $1
          ORDER BY status ASC, created_at ASC
        `,
        [req.params.id, req.user.sub]
      );

      res.json({
        entries: result.rows
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const { text, icon, details } = req.body ?? {};

    if (!text?.trim()) {
      res.status(400).json({ error: "Entry text is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.id, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const openEntryCount = await pool.query(
        `
          SELECT COUNT(*) AS cnt
          FROM entries
          WHERE list_id = $1 AND status = 'open'
        `,
        [req.params.id]
      );

      if (Number(openEntryCount.rows[0]?.cnt) >= MAX_OPEN_ENTRIES_PER_LIST) {
        res.status(422).json({
          error:
            "This list has reached the maximum of 1,000 open entries. Please complete or remove some items first."
        });
        return;
      }

      const result = await pool.query(
        `
          INSERT INTO entries (list_id, text, status, icon, details, last_updated_by)
          VALUES ($1, $2, 'open', $3, $4, $5)
          RETURNING id, list_id, text, status, icon, details, created_at, updated_at, last_updated_by
        `,
        [req.params.id, text.trim(), icon ?? null, normalizeDetails(details), req.user.sub]
      );

      void sseManager
        .broadcastToList(pool, req.params.id, "entry:created", {
          listId: req.params.id,
          entryId: result.rows[0].id
        })
        .catch((broadcastError) => {
          logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
        });

      void enqueuePushJob({
        pool,
        listId: req.params.id,
        actorUserId: req.user.sub,
        entryText: result.rows[0].text,
        now: new Date()
      }).catch((pushError) => {
        logger.error({ err: pushError }, "Failed to enqueue push notification job");
      });

      res.status(201).json({
        entry: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:entryId", async (req, res, next) => {
    const { text, status, icon, details } = req.body ?? {};
    const hasDetails = "details" in (req.body ?? {});

    if (!text?.trim() && !status && icon === undefined) {
      res.status(400).json({ error: "At least one entry update field is required." });
      return;
    }

    if (status && !["open", "done"].includes(status)) {
      res.status(400).json({ error: "Entry status must be open or done." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.id, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      if (status === "done") {
        const doneEntryCount = await pool.query(
          `
            SELECT COUNT(*) AS cnt
            FROM entries
            WHERE list_id = $1 AND status = 'done'
          `,
          [req.params.id]
        );

        if (Number(doneEntryCount.rows[0]?.cnt) >= MAX_DONE_ENTRIES_PER_LIST) {
          await pool.query(
            `
              DELETE FROM entries
              WHERE id = (
                SELECT id
                FROM entries
                WHERE list_id = $1 AND status = 'done'
                ORDER BY updated_at ASC, created_at ASC
                LIMIT 1
              )
            `,
            [req.params.id]
          );
        }
      }

      const result = await pool.query(
        `
          UPDATE entries
          SET
            text = COALESCE($1, text),
            status = COALESCE($2, status),
            icon = COALESCE($3, icon),
            details = CASE WHEN $4 THEN $5 ELSE details END,
            last_updated_by = $6,
            updated_at = NOW()
          WHERE id = $7 AND list_id = $8
          RETURNING id, list_id, text, status, icon, details, created_at, updated_at, last_updated_by
        `,
        [
          text?.trim() || null,
          status ?? null,
          icon ?? null,
          hasDetails,
          hasDetails ? normalizeDetails(details) : null,
          req.user.sub,
          req.params.entryId,
          req.params.id
        ]
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: "Entry not found." });
        return;
      }

      void sseManager
        .broadcastToList(pool, req.params.id, "entry:updated", {
          listId: req.params.id,
          entryId: req.params.entryId
        })
        .catch((broadcastError) => {
          logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
        });

      res.json({
        entry: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:entryId", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.id, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const result = await pool.query(
        `
          DELETE FROM entries
          WHERE id = $1 AND list_id = $2
          RETURNING id
        `,
        [req.params.entryId, req.params.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: "Entry not found." });
        return;
      }

      void sseManager
        .broadcastToList(pool, req.params.id, "entry:deleted", {
          listId: req.params.id,
          entryId: req.params.entryId
        })
        .catch((broadcastError) => {
          logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
        });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createEntryRouter;
