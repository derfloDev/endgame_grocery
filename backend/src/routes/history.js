import { Router } from "express";
import { getPool } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureListAccess } from "../middleware/listAccess.js";

/**
 * Creates the authenticated recently used history router backed by completed entries.
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
          SELECT text, icon, details
          FROM (
            SELECT DISTINCT ON (text) text, icon, details, updated_at
            FROM entries
            WHERE list_id = $1
              AND status = 'done'
              AND NOT EXISTS (
                SELECT 1
                FROM entries e2
                WHERE e2.list_id = $1
                  AND e2.text = entries.text
                  AND e2.status = 'open'
              )
            ORDER BY text, updated_at DESC
          ) ranked
          ORDER BY updated_at DESC
          LIMIT 20
        `,
        [req.params.id]
      );

      res.json({
        history: result.rows.map(({ text, icon, details }) => ({
          text,
          icon,
          details
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/", async (req, res, next) => {
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

      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

      if (!text) {
        res.status(400).json({ error: "History item text is required." });
        return;
      }

      await pool.query(
        `
          DELETE FROM entries
          WHERE list_id = $1
            AND text = $2
            AND status = 'done'
        `,
        [req.params.id, text]
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createHistoryRouter;
