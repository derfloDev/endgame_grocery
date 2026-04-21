import { Router } from "express";
import { getPool } from "../db/client.js";
import { requireAuth } from "../middleware/auth.js";

export function createSharingRouter({
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
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      const membersResult = await pool.query(
        `
          SELECT
            u.id AS user_id,
            u.display_name,
            u.email,
            lm.joined_at
          FROM list_members lm
          JOIN users u ON u.id = lm.user_id
          WHERE lm.list_id = $1
          ORDER BY lm.joined_at ASC
        `,
        [req.params.id]
      );

      res.json({
        members: [
          {
            user_id: list.owner_id,
            display_name: list.owner_display_name,
            email: list.owner_email,
            joined_at: list.created_at,
            is_owner: true
          },
          ...membersResult.rows.map((row) => ({
            user_id: row.user_id,
            display_name: row.display_name,
            email: row.email,
            joined_at: row.joined_at,
            is_owner: false
          }))
        ]
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    const email = req.body?.email?.trim();

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      const userResult = await pool.query(
        `
          SELECT id, display_name, email
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
        `,
        [email]
      );

      const user = userResult.rows[0];

      if (!user) {
        res.status(404).json({ error: "No user found for that email address." });
        return;
      }

      if (user.id === list.owner_id) {
        res.status(409).json({ error: "That user already has access to this list." });
        return;
      }

      const existingMemberResult = await pool.query(
        `
          SELECT user_id
          FROM list_members
          WHERE list_id = $1 AND user_id = $2
          LIMIT 1
        `,
        [req.params.id, user.id]
      );

      if (existingMemberResult.rows[0]) {
        res.status(409).json({ error: "That user already has access to this list." });
        return;
      }

      const insertResult = await pool.query(
        `
          INSERT INTO list_members (list_id, user_id)
          VALUES ($1, $2)
          RETURNING joined_at
        `,
        [req.params.id, user.id]
      );

      res.status(201).json({
        member: {
          user_id: user.id,
          display_name: user.display_name,
          email: user.email,
          joined_at: insertResult.rows[0].joined_at,
          is_owner: false
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:uid", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const list = await getOwnedList(pool, req.params.id, req.user.sub);

      if (!list) {
        res.status(403).json({ error: "Only the list owner can manage sharing." });
        return;
      }

      if (req.params.uid === list.owner_id) {
        res.status(400).json({ error: "The list owner cannot be removed." });
        return;
      }

      const deleteResult = await pool.query(
        `
          DELETE FROM list_members
          WHERE list_id = $1 AND user_id = $2
          RETURNING user_id
        `,
        [req.params.id, req.params.uid]
      );

      if (!deleteResult.rows[0]) {
        res.status(404).json({ error: "That member does not have access to this list." });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function getOwnedList(pool, listId, ownerId) {
  const result = await pool.query(
    `
      SELECT
        l.id,
        l.owner_id,
        l.created_at,
        owner.display_name AS owner_display_name,
        owner.email AS owner_email
      FROM lists l
      JOIN users owner ON owner.id = l.owner_id
      WHERE l.id = $1 AND l.owner_id = $2
      LIMIT 1
    `,
    [listId, ownerId]
  );

  return result.rows[0] ?? null;
}

export default createSharingRouter;
