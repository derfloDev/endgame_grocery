import { Router } from "express";
import { getPool } from "../db/client.js";
import { logger as defaultLogger } from "../logger.js";
import { requireAuth } from "../middleware/auth.js";
import { acceptInviteForUser, getPendingInviteByToken } from "../inviteService.js";
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

      const { listId, memberAdded } = await acceptInviteForUser({
        pool,
        invite,
        userId: req.user.sub
      });

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
