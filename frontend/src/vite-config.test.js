// @vitest-environment node
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

describe("vite worker config", () => {
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
});
