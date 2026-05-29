import express from "express";
import { createRequireApiKey, createRequireAuthFn } from "./middleware/auth.js";
import pinoHttp from "pino-http";
import authRoutes from "./routes/auth.js";
import docsRoutes from "./routes/docs.js";
import createEventsRouter from "./routes/events.js";
import { getPool } from "./db/client.js";
import entryRoutes from "./routes/entries.js";
import historyRoutes from "./routes/history.js";
import invitesRoutes from "./routes/invites.js";
import { getConfig } from "./env.js";
import { logger as defaultLogger } from "./logger.js";
import listRoutes from "./routes/lists.js";
import pushRoutes from "./routes/push.js";
import suggestionRoutes from "./routes/suggestions.js";
import sharingRoutes from "./routes/sharing.js";
import { sseManager as defaultSseManager } from "./sseManager.js";
import testRoutes from "./routes/testRouter.js";
import v1Routes from "./routes/v1.js";
import { getMissingVapidConfigFields, startPushWorker } from "./workers/pushWorker.js";

export function createApp(options = {}) {
  const app = express();
  const logger = options.logger ?? defaultLogger;
  const config = {
    ...getConfig(),
    ...(options.config ?? {})
  };
  const pool = "pool" in options ? options.pool : getPool();
  const shouldStartWorkers = options.startWorkers ?? !("pool" in options);
  const sseManager = options.sseManager ?? defaultSseManager;
  const requireAuthFn =
    options.requireAuthFn ??
    createRequireAuthFn({
      jwtLib: options.jwtLib,
      config
    });
  const requireApiKey =
    options.requireApiKey ??
    createRequireApiKey({
      pool
    });
  const routerOptions = {
    ...options,
    config,
    pool,
    requireApiKey,
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

  app.get("/api/config", (_req, res) => {
    res.json({ registrationEnabled: config.registrationEnabled });
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
  app.get("/api/docs", (req, res, next) => {
    if (req.path === "/api/docs") {
      res.redirect(301, "/api/docs/");
      return;
    }

    next();
  });
  app.use("/api/docs", docsRoutes(routerOptions));
  app.use("/api/v1", v1Routes(routerOptions));
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
    const missingConfig = getMissingVapidConfigFields(config);

    if (missingConfig.length) {
      logger.warn(
        { missingConfig },
        "Push notifications disabled because VAPID configuration is incomplete"
      );
    }

    startPushWorker({
      ...options,
      config,
      logger,
      pool
    });
  }

  return app;
}
