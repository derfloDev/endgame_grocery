import express from "express";
import authRoutes from "./routes/auth.js";
import entryRoutes from "./routes/entries.js";
import historyRoutes from "./routes/history.js";
import invitesRoutes from "./routes/invites.js";
import listRoutes from "./routes/lists.js";
import pushRoutes from "./routes/push.js";
import suggestionRoutes from "./routes/suggestions.js";
import sharingRoutes from "./routes/sharing.js";
import { startPushWorker } from "./workers/pushWorker.js";

export function createApp(options = {}) {
  const app = express();
  const shouldStartWorkers = options.startWorkers ?? !("pool" in options);

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes(options));
  app.use("/api/invites", invitesRoutes(options));
  app.use("/api/push", pushRoutes(options));
  app.use("/api/lists", listRoutes(options));
  app.use("/api/lists/:id/history", historyRoutes(options));
  app.use("/api/lists/:id/suggestions", suggestionRoutes(options));
  app.use("/api/lists/:id/entries", entryRoutes(options));
  app.use("/api/lists/:id/members", sharingRoutes(options));

  app.use((error, _req, res, _next) => {
    void _next;
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  });

  if (shouldStartWorkers) {
    startPushWorker(options);
  }

  return app;
}
