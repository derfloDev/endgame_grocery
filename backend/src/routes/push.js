import { isIP } from "node:net";
import { Router } from "express";
import { getPool } from "../db/client.js";
import { getConfig } from "../env.js";
import { logger as defaultLogger } from "../logger.js";
import { requireAuth } from "../middleware/auth.js";

// Hostnames (and their subdomains) of the push services used by browsers. The server later POSTs
// to every stored endpoint, so accepting arbitrary URLs would turn the worker into an SSRF proxy.
const ALLOWED_PUSH_HOSTS = [
  "fcm.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
  "web.push.apple.com"
];

/**
 * Checks that a subscription endpoint points to a known browser push service.
 *
 * Only `https:` URLs without credentials, whose hostname is not an IP literal and equals or is a
 * subdomain of an allowed push service host, are accepted.
 *
 * @param {string} endpoint Endpoint submitted by the client.
 * @returns {boolean} Whether the endpoint may be stored.
 */
export function isAllowedPushEndpoint(endpoint) {
  let url;

  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    return false;
  }

  const hostname = url.hostname.toLowerCase();

  // URL keeps IPv6 literals in brackets; isIP covers IPv4 literals.
  if (hostname.startsWith("[") || isIP(hostname)) {
    return false;
  }

  return ALLOWED_PUSH_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

/**
 * Creates the push notification router.
 *
 * @param {object} [options] Router dependencies.
 * @param {import("pg").Pool} [options.pool] Database pool.
 * @param {ReturnType<typeof getConfig>} [options.config] Runtime configuration.
 * @param {typeof defaultLogger} [options.logger] Application logger.
 * @param {import("express").RequestHandler} [options.requireAuthMiddleware] Auth middleware.
 * @returns {import("express").Router} Configured push router.
 */
export function createPushRouter({
  pool = getPool(),
  config = getConfig(),
  logger = defaultLogger,
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

    if (!isAllowedPushEndpoint(endpoint)) {
      res.status(400).json({ error: "endpoint must be an https URL of a supported browser push service." });
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

      logger.info(
        { userId: req.user.sub, endpoint },
        "Push subscription saved"
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

      logger.info(
        { userId: req.user.sub, endpoint },
        "Push subscription removed"
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export default createPushRouter;
