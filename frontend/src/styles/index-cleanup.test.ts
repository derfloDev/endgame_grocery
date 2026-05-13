// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = path.resolve(import.meta.dirname, "..");
const indexCssSource = readFileSync(path.resolve(srcDir, "index.css"), "utf8");
const nonEmptyLines = indexCssSource.split(/\r?\n/).filter((line) => line.trim().length > 0);

describe("global stylesheet cleanup", () => {
  it("keeps index.css compact after component extraction", () => {
    expect(nonEmptyLines.length).toBeLessThanOrEqual(40);
  });

  it("only keeps imports, base selectors, and keyframes in index.css", () => {
    const bodyWithoutImports = indexCssSource
      .split(/\r?\n/)
      .filter((line) => !line.trim().startsWith("@import"))
      .join("\n");
    const disallowedClassSelectors = bodyWithoutImports.match(/(?<!:)\.[_a-zA-Z][-_a-zA-Z0-9]*/g) ?? [];

    expect(disallowedClassSelectors).toEqual([]);
    expect(indexCssSource).toContain('@import "./styles/tokens.css";');
    expect(indexCssSource).toContain('@import "./styles/shared.css";');

    for (const keyframeName of ["shimmer", "slideUp", "fadeIn", "spin"]) {
      expect(indexCssSource).toContain(`@keyframes ${keyframeName}`);
    }
  });
});
