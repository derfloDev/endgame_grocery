import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { requireAuth } from "../middleware/auth.js";

export function createPushRouter({
  pool = getPool(),
  config = getConfig(),
  requireAuthMiddleware = requireAuth
} = {}) {
  const router = Router();

  router.get("/vapid-public-key", (_req, res) => {
    res.json({ publicKey: config.vapidPublicKey });
  });

  router.post("/subscribe", requireAuthMiddleware, async (req, res, next) => {
    const endpoint = req.body?.endpoint?.trim();
    const p256dh = req.body?.keys?.p256dh?.trim();
    const auth = req.body?.keys?.auth?.trim();

    if (!endpoint || !p256dh || !auth) {
      res.status(400).json({ error: "endpoint, keys.p256dh, and keys.auth are required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      await pool.query(
        `
          INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (user_id, endpoint)
          DO UPDATE SET
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth
        `,
        [req.user.sub, endpoint, p256dh, auth]
      );

      res.status(201).json({ message: "Push subscription saved." });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/subscribe", requireAuthMiddleware, async (req, res, next) => {
    const endpoint = req.body?.endpoint?.trim();

    if (!endpoint) {
      res.status(400).json({ error: "endpoint is required." });
      return;
    }

    if (!pool) {
      next(new Error("Database connection is not configured."));
      return;
    }

    try {
      await pool.query(
        `
          DELETE FROM push_subscriptions
          WHERE user_id = $1 AND endpoint = $2
        `,
        [req.user.sub, endpoint]
      );

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createPushRouter;
