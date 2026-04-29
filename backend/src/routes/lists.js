import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { requireAuth } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";

export function createListRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth,
  logger = defaultLogger,
  sseManager = defaultSseManager
} = {}) {
  const router = Router();

  router.use(requireAuthMiddleware);

  router.get("/", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          SELECT
            l.id,
            l.name,
            l.owner_id,
            owner.display_name AS owner_name,
            (l.owner_id = $1) AS is_owner
          FROM lists l
          JOIN users owner ON owner.id = l.owner_id
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
          name: row.name,
          owner_id: row.owner_id,
          owner_name: row.owner_name,
          is_owner: row.is_owner
        }))
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const { name } = req.body ?? {};

    if (!name?.trim()) {
      res.status(400).json({ error: "List name is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const result = await pool.query(
        `
          INSERT INTO lists (name, owner_id)
          VALUES ($1, $2)
          RETURNING id, name, owner_id
        `,
        [name.trim(), req.user.sub]
      );

      res.status(201).json({
        list: {
          ...result.rows[0],
          is_owner: true
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    const { name } = req.body ?? {};

    if (!name?.trim()) {
      res.status(400).json({ error: "List name is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const ownershipResult = await pool.query(
        `
          SELECT id
          FROM lists
          WHERE id = $1 AND owner_id = $2
          LIMIT 1
        `,
        [req.params.id, req.user.sub]
      );

      if (!ownershipResult.rows[0]) {
        res.status(403).json({ error: "Only the list owner can rename this list." });
        return;
      }

      const result = await pool.query(
        `
          UPDATE lists
          SET name = $1
          WHERE id = $2
          RETURNING id, name, owner_id
        `,
        [name.trim(), req.params.id]
      );

      void sseManager
        .broadcastToList(pool, req.params.id, "list:updated", {
          listId: req.params.id
        })
        .catch((broadcastError) => {
          logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
        });

      res.json({
        list: {
          ...result.rows[0],
          is_owner: true
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const ownershipResult = await pool.query(
        `
          SELECT id
          FROM lists
          WHERE id = $1 AND owner_id = $2
          LIMIT 1
        `,
        [req.params.id, req.user.sub]
      );

      if (!ownershipResult.rows[0]) {
        res.status(403).json({ error: "Only the list owner can delete this list." });
        return;
      }

      await sseManager.broadcastToList(pool, req.params.id, "list:deleted", {
        listId: req.params.id
      });
      await pool.query("DELETE FROM lists WHERE id = $1", [req.params.id]);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createListRouter;
