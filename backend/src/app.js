import express from "express";
import { createRequireApiKey, createRequireAuth, createRequireAuthFn } from "./middleware/auth.js";
import { createRateLimiters } from "./middleware/rateLimit.js";
import pinoHttp from "pino-http";
import authRoutes from "./routes/auth.js";
import docsRoutes from "./routes/docs.js";
import createEventsRouter from "./routes/events.js";
import { getPool } from "./db/client.js";
import entryRoutes from "./routes/entries.js";
import historyRoutes from "./routes/history.js";
import invitesRoutes from "./routes/invites.js";
import { getConfig } from "./env.js";
import { logger as defaultLogger, serializeRequest } from "./logger.js";
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
      config,
      pool
    });
  // Every authenticated router shares this middleware, so the token version check (session
  // revocation) applies everywhere and uses the app's own config and pool.
  const requireAuthMiddleware =
    options.requireAuthMiddleware ??
    createRequireAuth({
      jwtLib: options.jwtLib,
      config,
      pool
    });
  const requireApiKey =
    options.requireApiKey ??
    createRequireApiKey({
      pool
    });
  // One set of in-memory counters per app instance (the deployment is single-instance).
  // The E2E suite (the only user of the opt-in test routes) registers and fails logins from a
  // single IP, so limiting is skipped there. Production never enables test routes.
  const rateLimiters =
    options.rateLimiters ??
    createRateLimiters(options.rateLimits, { disabled: config.enableTestRoutes === true });
  const routerOptions = {
    ...options,
    config,
    pool,
    rateLimiters,
    requireApiKey,
    requireAuthMiddleware,
    sseManager
  };

  // nginx is the only proxy in front of the backend; trusting exactly one hop makes req.ip the
  // address nginx saw, which the rate limiters key on. Clients cannot spoof it via X-Forwarded-For.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    pinoHttp({
      logger,
      // Log method, path and address only; never headers or query strings (see logger.js).
      serializers: { req: serializeRequest },
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
      sseTickets: options.sseTickets,
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
  if (config.enableTestRoutes) {
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
