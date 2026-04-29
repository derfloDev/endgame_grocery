import { Router } from "express";
import { createRequireAuthFn } from "../middleware/auth.js";
import { sseManager as defaultSseManager } from "../sseManager.js";

const HEARTBEAT_MESSAGE = ":heartbeat\n\n";

export function createEventsRouter({
  requireAuthFn = createRequireAuthFn(),
  sseManager = defaultSseManager,
  heartbeatIntervalMs = 30_000
} = {}) {
  const router = Router();

  router.get("/", (req, res) => {
    const token = getTokenFromRequest(req);

    if (!token) {
      res.status(401).json({ error: "Authentication token is required." });
      return;
    }

    let user;

    try {
      user = requireAuthFn(token);
    } catch {
      res.status(401).json({ error: "Authentication token is invalid." });
      return;
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
        res.write(HEARTBEAT_MESSAGE);
      } catch {
        cleanup();
      }
    }, heartbeatIntervalMs);

    req.on("close", cleanup);
  });

  return router;
}

function getTokenFromRequest(req) {
  if (typeof req.query.token === "string" && req.query.token.trim()) {
    return req.query.token;
  }

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
