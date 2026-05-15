// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesDir = import.meta.dirname;
const srcDir = path.resolve(stylesDir, "..");
const indexCssSource = readFileSync(path.resolve(srcDir, "index.css"), "utf8");

const readStyleFile = (fileName: string) => {
  const filePath = path.resolve(stylesDir, fileName);

  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
};

const sharedCssSource = readStyleFile("shared.css");
const authCssSource = readStyleFile("auth.module.css");

const sharedClasses = [
  "button-primary",
  "button-row",
  "button-secondary",
  "card-title",
  "destructive-button",
  "detail-banner",
  "detail-section-label",
  "detail-section-label-done",
  "detail-section-label-share",
  "detail-title",
  "eg-btn",
  "eg-btn-danger",
  "eg-btn-ghost",
  "eg-btn-primary",
  "eg-btn-secondary",
  "eg-card",
  "eg-card-overlay",
  "eg-chip-cyan",
  "eg-chip-member-initial",
  "eg-chip-purple",
  "eg-chip-queued",
  "eg-chip-success",
  "eg-error-banner",
  "eg-field",
  "eg-gradient-text",
  "eg-icon-btn",
  "eg-input",
  "eg-input-anchor",
  "eg-input-wrap",
  "eg-link",
  "eg-mono",
  "eg-offline-banner",
  "eg-orbitron",
  "eg-success-banner",
  "entry-card",
  "entry-card-done",
  "entry-copy",
  "entry-section",
  "entry-section-collapse",
  "entry-section-header",
  "entry-text",
  "entry-text-done",
  "entry-toggle",
  "error-banner",
  "field",
  "icon-picker-btn",
  "icon-picker-grid",
  "icon-picker-search",
  "icon-picker-sheet",
  "link-button",
  "list-card",
  "list-card-chips",
  "list-grid",
  "member-card",
  "member-name",
  "muted-link",
  "muted-text",
  "pill",
  "shared-pill",
  "stack",
  "tight-stack",
  "visually-hidden",
];

const authClasses = [
  "auth-brand",
  "auth-brand-sub",
  "auth-brand-title",
  "auth-card",
  "auth-form",
  "auth-layout",
  "auth-logo",
  "compact-form",
];

describe("shared stylesheet foundation", () => {
  it("imports shared styles from the global entry stylesheet", () => {
    expect(indexCssSource).toContain('@import "./styles/tokens.css";');
    expect(indexCssSource).toContain('@import "./styles/shared.css";');
    expect(indexCssSource).not.toContain('@import "./styles/auth.module.css";');
  });

  it.each(sharedClasses)("keeps .%s in shared.css", (className) => {
    expect(sharedCssSource).toMatch(new RegExp(`\\.${className}\\b`));
  });

  it.each(authClasses)("keeps .%s in auth.module.css", (className) => {
    expect(authCssSource).toMatch(new RegExp(`\\.${className}\\b`));
  });

  it("aligns shared text and icon buttons with inline-flex", () => {
    expect(sharedCssSource).toMatch(
      /\.button-primary,\s*\.eg-btn,\s*\.eg-btn-primary,\s*\.button-secondary,\s*\.eg-btn-secondary,\s*\.eg-btn-ghost,\s*\.eg-btn-danger\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/s
    );
  });
});
