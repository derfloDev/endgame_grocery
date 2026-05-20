import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { ensureListAccess } from "../middleware/listAccess.js";
import { requireAuth } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { enqueuePushJob } from "../workers/pushWorker.js";

const MAX_OPEN_ENTRIES_PER_LIST = 1000;
const MAX_DONE_ENTRIES_PER_LIST = 200;

function upsertAutocompleteHistory(pool, { userId, listId, text, icon }) {
  return pool.query(
    `
      INSERT INTO autocomplete_history (user_id, list_id, text, icon, use_count, last_used_at)
      VALUES ($1, $2, $3, $4, 1, NOW())
      ON CONFLICT (user_id, list_id, text)
      DO UPDATE SET
        icon = EXCLUDED.icon,
        use_count = autocomplete_history.use_count + 1,
        last_used_at = NOW()
    `,
    [userId, listId, text, icon]
  );
}

function normalizeDetails(details) {
  if (typeof details !== "string") {
    return null;
  }

  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

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
          SELECT id, list_id, text, status, icon, details, created_at, updated_at
          FROM entries
          WHERE list_id = $1
          ORDER BY status ASC, created_at ASC
        `,
        [req.params.id]
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
          INSERT INTO entries (list_id, text, status, icon, details)
          VALUES ($1, $2, 'open', $3, $4)
          RETURNING id, list_id, text, status, icon, details, created_at, updated_at
        `,
        [req.params.id, text.trim(), icon ?? null, normalizeDetails(details)]
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
            updated_at = NOW()
          WHERE id = $6 AND list_id = $7
          RETURNING id, list_id, text, status, icon, details, created_at, updated_at
        `,
        [
          text?.trim() || null,
          status ?? null,
          icon ?? null,
          hasDetails,
          hasDetails ? normalizeDetails(details) : null,
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

      if (result.rows[0].status === "done") {
        void upsertAutocompleteHistory(pool, {
          userId: req.user.sub,
          listId: req.params.id,
          text: result.rows[0].text,
          icon: result.rows[0].icon
        }).catch((historyError) => {
          logger.error({ err: historyError }, "Failed to upsert autocomplete history");
        });
      }

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

      const entryResult = await pool.query(
        `
          SELECT text, icon
          FROM entries
          WHERE id = $1 AND list_id = $2
          LIMIT 1
        `,
        [req.params.entryId, req.params.id]
      );

      if (!entryResult.rows[0]) {
        res.status(404).json({ error: "Entry not found." });
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

      void upsertAutocompleteHistory(pool, {
        userId: req.user.sub,
        listId: req.params.id,
        text: entryResult.rows[0].text,
        icon: entryResult.rows[0].icon
      }).catch((historyError) => {
        logger.error({ err: historyError }, "Failed to upsert autocomplete history");
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createEntryRouter;
