import { Router } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import path from "node:path";
import swaggerUi from "swagger-ui-express";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openApiPath = path.join(__dirname, "../openapi/v1.yaml");
const spec = load(readFileSync(openApiPath, "utf8"));

export function createDocsRouter() {
  const router = Router();

  router.get("/openapi.yaml", (_req, res) => {
    res.setHeader("Content-Type", "application/yaml");
    res.sendFile(openApiPath);
  });
  router.get("/", swaggerUi.setup(spec));
  router.use("/", swaggerUi.serve);

  return router;
}

export default createDocsRouter;
