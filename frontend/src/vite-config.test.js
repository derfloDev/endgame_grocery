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
});
