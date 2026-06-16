// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const pagesDir = import.meta.dirname;
const srcDir = path.resolve(pagesDir, "..");

const authPages = [
  "LoginPage",
  "RegisterPage",
  "ForgotPasswordPage",
  "ResetPasswordPage",
  "VerifyEmailPage",
  "InviteAcceptPage"
];

const moduleClasses = {
  OverviewPage: [
    "overview-topbar",
    "overview-brand",
    "overview-brand-left",
    "overview-sort-row",
    "overview-content",
    "overview-header"
  ],
  ListDetailPage: ["detail-content", "detail-meta", "detail-member-badges", "entry-tile-grid"]
} as const;

describe("page CSS module layout", () => {
  it.each([...authPages, ...Object.keys(moduleClasses)])("keeps %s source in a page folder", (pageName) => {
    expect(existsSync(path.resolve(pagesDir, pageName, `${pageName}.tsx`))).toBe(true);
  });

  it.each(authPages)("uses the shared auth module from %s", (pageName) => {
    const pageSource = readFileSync(path.resolve(pagesDir, pageName, `${pageName}.tsx`), "utf8");

    expect(pageSource).toContain('from "../../styles/auth.module.css"');
    expect(pageSource).toContain('styles["auth-layout"]');
    expect(pageSource).toContain('styles["auth-card"]');
    expect(pageSource).toContain('styles["auth-form"]');
  });

  it.each(Object.entries(moduleClasses))("defines expected private classes for %s", (pageName, classNames) => {
    const cssSource = readFileSync(path.resolve(pagesDir, pageName, `${pageName}.module.css`), "utf8");

    for (const className of classNames) {
      expect(cssSource).toMatch(new RegExp(`\\.${className}\\b`));
    }
  });

  it("keeps the overview sort control in its own row below the brand actions", () => {
    const pageSource = readFileSync(path.resolve(pagesDir, "OverviewPage", "OverviewPage.tsx"), "utf8");
    const cssSource = readFileSync(path.resolve(pagesDir, "OverviewPage", "OverviewPage.module.css"), "utf8");

    expect(pageSource).toContain('className={styles["overview-brand-left"]}');
    expect(pageSource).toContain('className={styles["overview-sort-row"]}');
    expect(pageSource).toMatch(/styles\["overview-actions"\][\s\S]*overview-logo[\s\S]*settings\.open[\s\S]*<\/div>\s*<\/div>\s*<div className={styles\["overview-sort-row"\]}>/);
    expect(cssSource).toMatch(/\.overview-brand-left\s*{[^}]*min-width:\s*0;[^}]*flex-shrink:\s*1;/s);
    expect(cssSource).toMatch(/\.overview-actions\s*{[^}]*flex-shrink:\s*0;/s);
    expect(cssSource).toMatch(/\.overview-sort-row\s*{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;[^}]*margin-bottom:\s*12px;/s);
    expect(cssSource).not.toMatch(/\.overview-sort-control\b/);
    expect(cssSource).not.toMatch(/@media\s*\(max-width:\s*480px\)/);
  });

  it("keeps cross-component detail and entry section classes shared", () => {
    const sharedSource = readFileSync(path.resolve(srcDir, "styles", "shared.css"), "utf8");
    const listDetailSource = readFileSync(path.resolve(pagesDir, "ListDetailPage", "ListDetailPage.module.css"), "utf8");

    for (const className of ["entry-section", "entry-section-header", "detail-section-label", "detail-banner"]) {
      expect(sharedSource).toMatch(new RegExp(`\\.${className}\\b`));
      expect(listDetailSource).not.toMatch(new RegExp(`\\.${className}\\b`));
    }
  });

  it("uses an app shell CSS module in App.tsx", () => {
    const appSource = readFileSync(path.resolve(srcDir, "App.tsx"), "utf8");
    const cssSource = readFileSync(path.resolve(srcDir, "App.module.css"), "utf8");

    expect(appSource).toContain('import styles from "./App.module.css"');
    expect(appSource).toContain('className={styles["app-shell"]}');
    expect(cssSource).toMatch(/\.app-shell\b/);
  });
});
