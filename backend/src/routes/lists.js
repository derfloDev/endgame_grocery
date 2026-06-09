import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { logger as defaultLogger } from "../logger.js";
import createMailer from "../mail/mailer.js";
import { ensureListAccess } from "../middleware/listAccess.js";
import { requireAuth } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";

/**
 * Creates the authenticated list router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {import("express").RequestHandler} [options.requireAuthMiddleware] Auth middleware.
 * @param {ReturnType<typeof getConfig>} [options.config] Runtime configuration.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {ReturnType<typeof createMailer>} [options.mailer] Mail delivery adapter.
 * @param {typeof defaultSseManager} [options.sseManager] SSE broadcaster.
 * @returns {import("express").Router} Configured list router.
 */
export function createListRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth,
  config = getConfig(),
  logger = defaultLogger,
  mailer = createMailer({ config }),
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
            (l.owner_id = $1) AS is_owner,
            COALESCE(changes.changed_count, 0)::int AS changed_count
          FROM lists l
          JOIN users owner ON owner.id = l.owner_id
          LEFT JOIN list_members lm
            ON lm.list_id = l.id
           AND lm.user_id = $1
          LEFT JOIN list_views lv
            ON lv.list_id = l.id
           AND lv.user_id = $1
          LEFT JOIN LATERAL (
            SELECT COUNT(*) AS changed_count
            FROM entries e
            WHERE e.list_id = l.id
              AND lv.last_viewed_at IS NOT NULL
              AND e.updated_at > lv.last_viewed_at
              AND (e.last_updated_by IS NULL OR e.last_updated_by <> $1)
          ) changes ON true
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
          is_owner: row.is_owner,
          changed_count: Number(row.changed_count ?? 0)
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

  router.post("/:id/mark-viewed", async (req, res, next) => {
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
          INSERT INTO list_views (user_id, list_id, last_viewed_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (user_id, list_id)
          DO UPDATE SET last_viewed_at = EXCLUDED.last_viewed_at
        `,
        [req.user.sub, req.params.id]
      );

      res.status(204).send();
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

  router.delete("/:id/leave", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const listResult = await pool.query(
        `
          SELECT
            l.id,
            l.name,
            l.owner_id,
            owner.display_name AS owner_display_name,
            owner.email AS owner_email
          FROM lists l
          JOIN users owner ON owner.id = l.owner_id
          WHERE l.id = $1
          LIMIT 1
        `,
        [req.params.id]
      );
      const list = listResult.rows[0];

      if (list?.owner_id === req.user.sub) {
        res.status(403).json({ error: "The list owner cannot leave their own list." });
        return;
      }

      const deleteResult = await pool.query(
        `
          DELETE FROM list_members lm
          USING users member
          WHERE lm.list_id = $1
            AND lm.user_id = $2
            AND member.id = lm.user_id
          RETURNING lm.user_id, member.display_name
        `,
        [req.params.id, req.user.sub]
      );
      const member = deleteResult.rows[0];

      if (!list || !member) {
        res.status(404).json({ error: "You do not have access to this list." });
        return;
      }

      void sseManager
        .broadcastToList(pool, req.params.id, "member:removed", {
          listId: req.params.id,
          userId: req.user.sub
        })
        .catch((broadcastError) => {
          logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
        });

      await sendMemberLeftEmail({ list, mailer, member });

      res.status(204).send();
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

/**
 * Sends an email to a list owner when a shared member leaves.
 *
 * @param {object} options Member-left email options.
 * @param {{ name: string, owner_display_name: string, owner_email: string }} options.list List row.
 * @param {ReturnType<typeof createMailer>} options.mailer Mail delivery adapter.
 * @param {{ display_name: string }} options.member Leaving member row.
 * @returns {Promise<void>} Resolves when the mailer accepts the message.
 */
async function sendMemberLeftEmail({ list, mailer, member }) {
  await mailer.send({
    to: list.owner_email,
    subject: `${member.display_name} left ${list.name}`,
    template: "member-left",
    context: {
      heading: "A member left your list",
      intro: `Hi ${list.owner_display_name},`,
      body: `${member.display_name} left the shared list "${list.name}".`,
      listName: list.name,
      memberName: member.display_name
    }
  });
}

export default createListRouter;
