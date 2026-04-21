import express from "express";
import authRoutes from "./routes/auth.js";
import entryRoutes from "./routes/entries.js";
import listRoutes from "./routes/lists.js";
import sharingRoutes from "./routes/sharing.js";

export function createApp(options = {}) {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes(options));
  app.use("/api/lists", listRoutes(options));
  app.use("/api/lists/:id/entries", entryRoutes(options));
  app.use("/api/sharing", sharingRoutes);

  app.use((error, _req, res, _next) => {
    void _next;
    console.error(error);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
