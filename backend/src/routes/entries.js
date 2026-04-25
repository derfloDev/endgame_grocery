import { Router } from "express";
import { getPool } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

async function ensureListAccess(pool, listId, userId) {
  const result = await pool.query(
    `
      SELECT l.id
      FROM lists l
      LEFT JOIN list_members lm
        ON lm.list_id = l.id
       AND lm.user_id = $2
      WHERE l.id = $1
        AND (l.owner_id = $2 OR lm.user_id = $2)
      LIMIT 1
    `,
    [listId, userId]
  );

  return Boolean(result.rows[0]);
}

export function createEntryRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth
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
          SELECT id, list_id, text, status, icon, created_at, updated_at
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
    const { text, icon } = req.body ?? {};

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

      const result = await pool.query(
        `
          INSERT INTO entries (list_id, text, status, icon)
          VALUES ($1, $2, 'open', $3)
          RETURNING id, list_id, text, status, icon, created_at, updated_at
        `,
        [req.params.id, text.trim(), icon ?? null]
      );

      res.status(201).json({
        entry: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:entryId", async (req, res, next) => {
    const { text, status, icon } = req.body ?? {};

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

      const result = await pool.query(
        `
          UPDATE entries
          SET
            text = COALESCE($1, text),
            status = COALESCE($2, status),
            icon = COALESCE($3, icon),
            updated_at = NOW()
          WHERE id = $4 AND list_id = $5
          RETURNING id, list_id, text, status, icon, created_at, updated_at
        `,
        [text?.trim() || null, status ?? null, icon ?? null, req.params.entryId, req.params.id]
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: "Entry not found." });
        return;
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

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createEntryRouter;
