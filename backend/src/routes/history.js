import { Router } from "express";
import { getPool } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureListAccess } from "../middleware/listAccess.js";

/**
 * Creates the authenticated autocomplete history router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {import("express").RequestHandler} [options.requireAuthMiddleware] Auth middleware.
 * @returns {import("express").Router} Configured history router.
 */
export function createHistoryRouter({
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
          SELECT ah.text, ah.icon, ah.use_count
          FROM autocomplete_history ah
          WHERE ah.user_id = $1
            AND ah.list_id = $2
            AND NOT EXISTS (
              SELECT 1
              FROM entries e
              WHERE e.list_id = $2
                AND e.text = ah.text
                AND e.status = 'open'
            )
          ORDER BY ah.use_count DESC, ah.last_used_at DESC
          LIMIT 20
        `,
        [req.user.sub, req.params.id]
      );

      res.json({
        history: result.rows.map(({ text, icon, use_count: useCount }) => ({
          text,
          icon,
          useCount
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/", async (req, res, next) => {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      res.status(400).json({ error: "History text is required." });
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

      await pool.query(
        `
          DELETE FROM autocomplete_history
          WHERE user_id = $1 AND list_id = $2 AND text = $3
        `,
        [req.user.sub, req.params.id, text]
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createHistoryRouter;
