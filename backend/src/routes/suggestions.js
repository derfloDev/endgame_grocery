import { Router } from "express";
import { getPool } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";
import { ensureListAccess } from "../middleware/listAccess.js";

/**
 * Creates the authenticated autocomplete suggestions router backed by list entries.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {import("express").RequestHandler} [options.requireAuthMiddleware] Auth middleware.
 * @returns {import("express").Router} Configured suggestions router.
 */
export function createSuggestionsRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth
} = {}) {
  const router = Router({ mergeParams: true });

  router.use(requireAuthMiddleware);

  router.get("/", async (req, res, next) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (query.length < 2) {
      res.status(400).json({ error: "Suggestion query must be at least 2 characters." });
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
          SELECT text,
            (array_agg(icon ORDER BY updated_at DESC NULLS LAST))[1] AS icon,
            count(*) AS use_count
          FROM entries
          WHERE list_id = $1
            AND (
              text ILIKE $2
              OR similarity(text, $3) > 0.25
            )
          GROUP BY text
          ORDER BY use_count DESC, max(updated_at) DESC
          LIMIT 5
        `,
        [req.params.id, `%${query}%`, query]
      );

      res.json({
        suggestions: result.rows.map(({ text, icon, use_count: useCount }) => ({
          text,
          icon,
          useCount
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createSuggestionsRouter;
