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
          SELECT text, icon, use_count
          FROM autocomplete_history
          WHERE user_id = $1
            AND list_id = $2
            AND (
              text ILIKE $3
              OR similarity(text, $4) > 0.25
            )
          ORDER BY use_count DESC, last_used_at DESC
          LIMIT 5
        `,
        [req.user.sub, req.params.id, `%${query}%`, query]
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
