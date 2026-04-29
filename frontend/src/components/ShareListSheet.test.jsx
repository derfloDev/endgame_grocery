import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../index.css";
import ShareListSheet from "./ShareListSheet";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

describe("ShareListSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders invite feedback inside a dedicated spacing wrapper", () => {
    const { container } = render(
      <ShareListSheet
        isSharingLoading={false}
        members={[]}
        open
        shareEmail="sam@example.com"
        shareError=""
        shareNotice="Invitation sent to sam@example.com."
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onRevoke={vi.fn()}
        onShareSubmit={vi.fn()}
      />
    );

    expect(screen.getByText("Invitation sent to sam@example.com.")).toBeTruthy();
    expect(container.querySelector(".share-list-sheet-feedback")).toBeTruthy();
    expect(cssSource).toMatch(
      /\.share-list-sheet-feedback\s*\{[^}]*display:\s*grid;[^}]*gap:\s*var\(--space-3\);[^}]*margin-top:\s*var\(--space-3\);/s
    );
  });
});
