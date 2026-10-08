import { Router } from "express";
import { createRequireAuthFn } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";
import { sseTickets as defaultSseTickets } from "../sseTickets.js";

/**
 * Creates the SSE router.
 *
 * `POST /ticket` (Bearer auth) issues a single-use, 30 s ticket. `GET /` opens the stream with
 * either that ticket (`?ticket=`, what browsers use because `EventSource` cannot set headers) or
 * an `Authorization` header. The JWT is never accepted in the query string, so it cannot leak
 * into access logs or browser history.
 *
 * @param {object} [options] Router dependencies.
 * @returns {import("express").Router} Configured events router.
 */
export function createEventsRouter({
  requireAuthFn = createRequireAuthFn(),
  sseManager = defaultSseManager,
  sseTickets = defaultSseTickets,
  heartbeatIntervalMs = 30_000
} = {}) {
  const router = Router();

  router.post("/ticket", async (req, res) => {
    const token = getBearerToken(req);

    if (!token) {
      res.status(401).json({ error: "Authentication token is required." });
      return;
    }

    let user;

    try {
      // Also rejects tokens revoked by a password reset (token version check).
      user = await requireAuthFn(token);
    } catch {
      res.status(401).json({ error: "Authentication token is invalid." });
      return;
    }

    res.set("Cache-Control", "no-store");
    res.json({ ticket: sseTickets.issue(user.sub) });
  });

  router.get("/", async (req, res) => {
    let user;

    if (typeof req.query.ticket === "string" && req.query.ticket) {
      const userId = sseTickets.consume(req.query.ticket);

      if (!userId) {
        res.status(401).json({ error: "Authentication ticket is invalid." });
        return;
      }

      user = { sub: userId };
    } else {
      const token = getBearerToken(req);

      if (!token) {
        res.status(401).json({ error: "Authentication token is required." });
        return;
      }

      try {
        user = await requireAuthFn(token);
      } catch {
        res.status(401).json({ error: "Authentication token is invalid." });
        return;
      }
    }

    req.user = user;
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    sseManager.add(user.sub, res);

    const cleanup = createCleanup(() => {
      clearInterval(heartbeatInterval);
      sseManager.remove(user.sub, res);
    });

    const heartbeatInterval = setInterval(() => {
      if (res.destroyed || res.writableEnded) {
        cleanup();
        return;
      }

      try {
        // A named event reaches the mobile client's watchdog; SSE comments are invisible to JS.
        res.write(`event: ping\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`);
      } catch {
        cleanup();
      }
    }, heartbeatIntervalMs);

    req.on("close", cleanup);
  });

  return router;
}

function getBearerToken(req) {
  const header = req.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return null;
}

function createCleanup(callback) {
  let cleanedUp = false;

  return () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    callback();
  };
}

export default createEventsRouter;
