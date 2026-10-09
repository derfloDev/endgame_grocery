import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { requireAuth } from "../middleware/auth.js";
import { acceptInviteForUser, getPendingInviteByToken, isInviteForEmail } from "../inviteService.js";
import { sseManager as defaultSseManager } from "../sseManager.js";

export function createInvitesRouter({
  pool = getPool(),
  requireAuthMiddleware = requireAuth,
  logger = defaultLogger,
  sseManager = defaultSseManager,
  now = () => new Date()
} = {}) {
  const router = Router({ mergeParams: true });

  router.use(requireAuthMiddleware);

  router.get("/:token", async (req, res, next) => {
    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      const invite = await getPendingInviteByToken(pool, req.params.token, now());

      if (!invite) {
        res.status(400).json({ error: "Invitation link is invalid or has expired." });
        return;
      }

      // An invite is only valid for the address it was sent to, so a forwarded link cannot be
      // used by another account.
      const userResult = await pool.query("SELECT email FROM users WHERE id = $1 LIMIT 1", [req.user.sub]);

      if (!isInviteForEmail(invite.invited_email, userResult.rows[0]?.email)) {
        res.status(403).json({ error: "This invitation was sent to a different email address." });
        return;
      }

      // The owner already has full access; leave the invite pending for the person it was meant for.
      const listResult = await pool.query("SELECT owner_id FROM lists WHERE id = $1 LIMIT 1", [invite.list_id]);

      if (listResult.rows[0]?.owner_id === req.user.sub) {
        res.status(409).json({ error: "You already own this list." });
        return;
      }

      const accepted = await acceptInviteForUser({
        pool,
        invite,
        userId: req.user.sub,
        now: now()
      });

      if (!accepted) {
        res.status(400).json({ error: "Invitation link is invalid or has expired." });
        return;
      }

      const { listId, memberAdded } = accepted;

      if (memberAdded) {
        void sseManager
          .broadcastToList(pool, listId, "member:added", {
            listId,
            userId: req.user.sub
          })
          .catch((broadcastError) => {
            logger.error({ err: broadcastError }, "Failed to broadcast SSE event");
          });
      }

      res.json({ listId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createInvitesRouter;
