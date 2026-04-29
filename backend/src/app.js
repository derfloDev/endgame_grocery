import express from "express";
import pinoHttp from "pino-http";
import authRoutes from "./routes/auth.js";
import entryRoutes from "./routes/entries.js";
import historyRoutes from "./routes/history.js";
import invitesRoutes from "./routes/invites.js";
import { logger as defaultLogger } from "./logger.js";
import listRoutes from "./routes/lists.js";
import pushRoutes from "./routes/push.js";
import suggestionRoutes from "./routes/suggestions.js";
import sharingRoutes from "./routes/sharing.js";
import testRoutes from "./routes/testRouter.js";
import { startPushWorker } from "./workers/pushWorker.js";

export function createApp(options = {}) {
  const app = express();
  const logger = options.logger ?? defaultLogger;
  const shouldStartWorkers = options.startWorkers ?? !("pool" in options);

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

  app.use("/api/auth", authRoutes(options));
  app.use("/api/invites", invitesRoutes(options));
  app.use("/api/push", pushRoutes(options));
  if (process.env.NODE_ENV !== "production") {
    app.use("/api/test", testRoutes(options));
  }
  app.use("/api/lists", listRoutes(options));
  app.use("/api/lists/:id/history", historyRoutes(options));
  app.use("/api/lists/:id/suggestions", suggestionRoutes(options));
  app.use("/api/lists/:id/entries", entryRoutes(options));
  app.use("/api/lists/:id/members", sharingRoutes(options));

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
