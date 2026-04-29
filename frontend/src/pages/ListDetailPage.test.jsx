import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

describe("ListDetailPage layout styles", () => {
  it("stacks the owner chips and notifications button with a dedicated gap", () => {
    expect(cssSource).toMatch(
      /\.detail-meta\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--space-3\);/s
    );
  });
});
