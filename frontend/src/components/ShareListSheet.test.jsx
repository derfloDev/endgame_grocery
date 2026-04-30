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
        isSubmitting={false}
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

  it("disables the invite button and shows a spinner while submitting", () => {
    const { container } = render(
      <ShareListSheet
        isSharingLoading={false}
        isSubmitting
        members={[]}
        open
        shareEmail="sam@example.com"
        shareError=""
        shareNotice=""
        onClose={vi.fn()}
        onEmailChange={vi.fn()}
        onRevoke={vi.fn()}
        onShareSubmit={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Send Invite" }).hasAttribute("disabled")).toBe(true);
    expect(container.querySelector(".share-invite-spinner")).toBeTruthy();
    expect(cssSource).toMatch(
      /\.share-invite-spinner\s*\{[^}]*width:\s*1rem;[^}]*height:\s*1rem;[^}]*animation:\s*spin 0\.75s linear infinite;/s
    );
  });
});
