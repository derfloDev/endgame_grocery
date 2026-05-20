// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

const viteConfigSource = readFileSync(path.resolve(import.meta.dirname, "../vite.config.ts"), "utf8");
const serviceWorkerSource = readFileSync(
  path.resolve(import.meta.dirname, "./sw/service-worker.js"),
  "utf8"
);

describe("vite worker config", () => {
  it("sends credentials with the PWA manifest request", () => {
    expect(viteConfigSource).toMatch(/useCredentials:\s*true/);
  });

  it("keeps transformers and onnxruntime out of optimizeDeps", () => {
    expect(viteConfig.optimizeDeps?.exclude).toEqual(
      expect.arrayContaining(["@huggingface/transformers", "onnxruntime-web"])
    );
  });

  it("bundles workers as ES modules", () => {
    expect(viteConfig.worker).toEqual({ format: "es" });
  });

  it("aliases onnxruntime-web to the self-contained ort.min.js build", () => {
    // ort-web.min.js (the default browser entry) depends on onnxruntime-common as an
    // external UMD parameter that does not exist in Worker module context, causing the
    // registerBackend crash. ort.min.js bundles everything inline with no external deps.
    expect(viteConfigSource).toContain("find: /^onnxruntime-web$/");
    expect(viteConfigSource).toMatch(/replacement:\s*["']onnxruntime-web\/dist\/ort\.min\.js["']/);
  });

  it("defines the app version from the root package.json", () => {
    expect(String(viteConfig.define?.__APP_VERSION__)).toMatch(/^"\d+\.\d+\.\d+"$/);
  });

  it("registers svgr for custom SVG React icon imports", () => {
    expect(viteConfigSource).toMatch(/from\s+["']vite-plugin-svgr["']/);
    expect(viteConfigSource).toMatch(/svgr\(\)/);
  });

  it("uses injectManifest for the custom push-aware service worker", () => {
    expect(viteConfigSource).toMatch(/strategies:\s*["']injectManifest["']/);
    expect(viteConfigSource).toMatch(/srcDir:\s*["']src\/sw["']/);
    expect(viteConfigSource).toMatch(/filename:\s*["']service-worker\.js["']/);
  });

  it("precaches JSON assets for offline locale delivery", () => {
    expect(viteConfigSource).toMatch(/globPatterns:\s*\[[^\]]*json[^\]]*\]/);
  });

  it("enables the module service worker in Vite dev mode", () => {
    expect(viteConfigSource).toMatch(/devOptions:\s*\{/);
    expect(viteConfigSource).toMatch(/enabled:\s*true/);
    expect(viteConfigSource).toMatch(/type:\s*["']module["']/);
  });

  it("registers precaching and push handlers in the custom service worker", () => {
    expect(serviceWorkerSource).toMatch(/precacheAndRoute/);
    expect(serviceWorkerSource).toMatch(/const precacheManifest = self\.__WB_MANIFEST/);
    expect(serviceWorkerSource).toMatch(/precacheAndRoute\(precacheManifest \|\| \[\]\)/);
    expect(serviceWorkerSource).toMatch(/addEventListener\(["']push["']/);
    expect(serviceWorkerSource).toMatch(/showNotification/);
    expect(serviceWorkerSource).toMatch(/addEventListener\(["']notificationclick["']/);
  });
});
