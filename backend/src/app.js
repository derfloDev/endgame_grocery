import express from "express";
import { createRequireAuthFn } from "./middleware/auth.js";
import pinoHttp from "pino-http";
import authRoutes from "./routes/auth.js";
import createEventsRouter from "./routes/events.js";
import entryRoutes from "./routes/entries.js";
import historyRoutes from "./routes/history.js";
import invitesRoutes from "./routes/invites.js";
import { logger as defaultLogger } from "./logger.js";
import listRoutes from "./routes/lists.js";
import pushRoutes from "./routes/push.js";
import suggestionRoutes from "./routes/suggestions.js";
import sharingRoutes from "./routes/sharing.js";
import { sseManager as defaultSseManager } from "./sseManager.js";
import testRoutes from "./routes/testRouter.js";
import { startPushWorker } from "./workers/pushWorker.js";

export function createApp(options = {}) {
  const app = express();
  const logger = options.logger ?? defaultLogger;
  const shouldStartWorkers = options.startWorkers ?? !("pool" in options);
  const sseManager = options.sseManager ?? defaultSseManager;
  const requireAuthFn =
    options.requireAuthFn ??
    createRequireAuthFn({
      jwtLib: options.jwtLib,
      config: options.config
    });
  const routerOptions = {
    ...options,
    sseManager
  };

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore(req) {
          return req.url === "/api/health";
        }
      }
    })
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use(
    "/api/events",
    createEventsRouter({
      requireAuthFn,
      sseManager,
      heartbeatIntervalMs: options.sseHeartbeatIntervalMs
    })
  );
  app.use("/api/auth", authRoutes(routerOptions));
  app.use("/api/invites", invitesRoutes(routerOptions));
  app.use("/api/push", pushRoutes(routerOptions));
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/test", testRoutes(routerOptions));
  }
  app.use("/api/lists", listRoutes(routerOptions));
  app.use("/api/lists/:id/history", historyRoutes(routerOptions));
  app.use("/api/lists/:id/suggestions", suggestionRoutes(routerOptions));
  app.use("/api/lists/:id/entries", entryRoutes(routerOptions));
  app.use("/api/lists/:id/members", sharingRoutes(routerOptions));

  app.use((error, req, res, _next) => {
    void _next;
    (req.log ?? logger).error({ err: error }, "Unhandled error");
    res.status(500).json({ error: "Internal server error." });
  });

  if (shouldStartWorkers) {
    startPushWorker(options);
  }

  return app;
}
