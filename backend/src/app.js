import express from "express";
import authRoutes from "./routes/auth.js";
import entryRoutes from "./routes/entries.js";
import listRoutes from "./routes/lists.js";
import sharingRoutes from "./routes/sharing.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/lists", listRoutes);
  app.use("/api/entries", entryRoutes);
  app.use("/api/sharing", sharingRoutes);

  return app;
}
