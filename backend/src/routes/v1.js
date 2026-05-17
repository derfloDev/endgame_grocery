import { Router } from "express";
import { getPool } from "../db/client.js";
import { createRequireApiKey } from "../middleware/auth.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === "string" && UUID_RE.test(id);
}

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

function serializeItem(row) {
  return {
    id: row.id,
    name: row.text,
    status: row.status
  };
}

export function createV1Router({ pool = getPool(), requireApiKey } = {}) {
  const router = Router();
  const requireApiKeyMiddleware = requireApiKey ?? createRequireApiKey({ pool });

  router.use(requireApiKeyMiddleware);

  router.get("/lists", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

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

  router.get("/lists/:listId/items", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      res.status(404).json({ error: "List not found." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.listId, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const result = await pool.query(
        `
          SELECT id, text, status
          FROM entries
          WHERE list_id = $1
          ORDER BY status ASC, created_at ASC
        `,
        [req.params.listId]
      );

      res.json({
        items: result.rows.map(serializeItem)
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/lists/:listId/items", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      res.status(404).json({ error: "List not found." });
      return;
    }

    const { name } = req.body ?? {};

    if (!name?.trim()) {
      res.status(400).json({ error: "Item name is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.listId, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const result = await pool.query(
        `
          INSERT INTO entries (list_id, text, status)
          VALUES ($1, $2, 'open')
          RETURNING id, text, status
        `,
        [req.params.listId, name.trim()]
      );

      res.status(201).json({
        item: serializeItem(result.rows[0])
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/lists/:listId/items/:itemId/toggle", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      res.status(404).json({ error: "List not found." });
      return;
    }

    if (!isValidUuid(req.params.itemId)) {
      res.status(404).json({ error: "Item not found." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.listId, req.user.sub);

      if (!hasAccess) {
        res.status(403).json({ error: "You do not have access to this list." });
        return;
      }

      const currentResult = await pool.query(
        `
          SELECT id, text, status
          FROM entries
          WHERE id = $1 AND list_id = $2
          LIMIT 1
        `,
        [req.params.itemId, req.params.listId]
      );
      const currentItem = currentResult.rows[0];

      if (!currentItem) {
        res.status(404).json({ error: "Item not found." });
        return;
      }

      const nextStatus = currentItem.status === "done" ? "open" : "done";
      const updateResult = await pool.query(
        `
          UPDATE entries
          SET status = $1, updated_at = NOW()
          WHERE id = $2 AND list_id = $3
          RETURNING id, text, status
        `,
        [nextStatus, req.params.itemId, req.params.listId]
      );

      res.json({
        item: serializeItem(updateResult.rows[0])
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/lists/:listId/items/:itemId", async (req, res, next) => {
    if (!isValidUuid(req.params.listId)) {
      res.status(404).json({ error: "List not found." });
      return;
    }

    if (!isValidUuid(req.params.itemId)) {
      res.status(404).json({ error: "Item not found." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const hasAccess = await ensureListAccess(pool, req.params.listId, req.user.sub);

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
        [req.params.itemId, req.params.listId]
      );

      if (!result.rows[0]) {
        res.status(404).json({ error: "Item not found." });
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
