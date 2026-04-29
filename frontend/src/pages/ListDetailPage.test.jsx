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

  it("defines owner-member badge styles for the detail meta area", () => {
    expect(cssSource).toMatch(
      /\.detail-member-badges\s*\{[^}]*display:\s*flex;[^}]*gap:\s*8px;[^}]*flex-wrap:\s*wrap;/s
    );
    expect(cssSource).toMatch(
      /\.eg-chip-member-initial\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*999px;/s
    );
  });
});
