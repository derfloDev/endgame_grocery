// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

const viteConfigSource = readFileSync(path.resolve(import.meta.dirname, "../vite.config.js"), "utf8");

describe("vite worker config", () => {
  it("sends credentials with the PWA manifest request", () => {
    expect(viteConfigSource).toMatch(/useCredentials:\s*true/);
  });

  it("keeps transformers and onnxruntime out of optimizeDeps", () => {
    expect(viteConfig.optimizeDeps.exclude).toEqual(
      expect.arrayContaining(["@xenova/transformers", "onnxruntime-web"])
    );
  });

  it("bundles workers as ES modules", () => {
    expect(viteConfig.worker).toEqual({ format: "es" });
  });

  it("aliases onnxruntime-web to the self-contained ort.min.js build", () => {
    // ort-web.min.js (the default browser entry) depends on onnxruntime-common as an
    // external UMD parameter that does not exist in Worker module context, causing the
    // registerBackend crash. ort.min.js bundles everything inline with no external deps.
    expect(viteConfig.resolve.alias["onnxruntime-web"]).toBe("onnxruntime-web/dist/ort.min.js");
  });

  it("defines the app version from the root package.json", () => {
    expect(viteConfig.define.__APP_VERSION__).toMatch(/^"\d+\.\d+\.\d+"$/);
  });
});
