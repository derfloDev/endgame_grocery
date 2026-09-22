// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const srcDir = path.resolve(import.meta.dirname, "..");
const indexCssSource = readFileSync(path.resolve(srcDir, "index.css"), "utf8");
const htmlSource = readFileSync(path.resolve(srcDir, "../index.html"), "utf8");
const fontsCssSource = readFileSync(path.resolve(srcDir, "styles/fonts.css"), "utf8");
const fontDir = path.resolve(srcDir, "../public/fonts");
const fontFiles = ["exo-2-latin.woff2", "exo-2-latin-ext.woff2", "orbitron-latin.woff2", "jetbrains-mono-latin.woff2", "jetbrains-mono-latin-ext.woff2"];
const nonEmptyLines = indexCssSource.split(/\r?\n/).filter((line) => line.trim().length > 0);

describe("global stylesheet cleanup", () => {
  it("does not load Google Fonts from a render-blocking third-party stylesheet", () => {
    expect(htmlSource).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/i);
  });

  it("defines local swap font faces and ships each subset", () => {
    for (const family of ["Exo 2", "Orbitron", "JetBrains Mono"]) {
      expect(fontsCssSource).toContain(`font-family: "${family}";`);
    }
    expect(fontsCssSource.match(/font-display: swap;/g)).toHaveLength(5);
    for (const file of fontFiles) {
      expect(fontsCssSource).toContain(`/fonts/${file}`);
      expect(existsSync(path.join(fontDir, file))).toBe(true);
    }
  });

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
    expect(indexCssSource).toContain('@import "./styles/fonts.css";');

    for (const keyframeName of ["shimmer", "slideUp", "fadeIn", "spin"]) {
      expect(indexCssSource).toContain(`@keyframes ${keyframeName}`);
    }
  });
});
