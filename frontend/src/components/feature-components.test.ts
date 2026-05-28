// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const componentsDir = import.meta.dirname;

const moduleComponents = [
  "AddItemSheet",
  "AutocompleteSuggestions",
  "EntryTile",
  "InfoSheet",
  "LanguageSwitcher",
  "ListCardHome",
  "ListOptionsSheet",
  "NewListSheet",
  "RecentlyUsedSection",
  "RenameListSheet",
  "ShareListSheet",
  "UpdateBanner"
];

const moduleClasses = {
  AddItemSheet: ["add-item-form", "add-item-form--browser-open", "add-item-icon-browser-grid--browser-open"],
  AutocompleteSuggestions: ["autocomplete-suggestions", "autocomplete-chip"],
  EntryTile: ["entry-tile", "entry-tile--done", "entry-tile-chip"],
  InfoSheet: ["info-sheet-section", "info-sheet-logout", "info-sheet-donate"],
  LanguageSwitcher: ["language-switcher", "language-switcher-button", "language-switcher-button-active"],
  ListCardHome: ["list-card-home", "list-card-row", "list-card-menu-actions"],
  ListOptionsSheet: ["list-options-sheet", "list-option-row", "list-option-icon-share"],
  NewListSheet: ["new-list-form"],
  RecentlyUsedSection: ["recently-used-section", "recently-used-grid", "recently-used-chip"],
  RenameListSheet: ["rename-list-form"],
  ShareListSheet: ["share-list-form", "member-row", "share-invite-spinner"],
  UpdateBanner: ["update-banner", "update-banner-actions", "update-banner-dismiss"]
} as const;

describe("feature component CSS module layout", () => {
  it.each(moduleComponents)("keeps %s source and CSS module in a component folder", (componentName) => {
    expect(existsSync(path.resolve(componentsDir, componentName, `${componentName}.tsx`))).toBe(true);
    expect(existsSync(path.resolve(componentsDir, componentName, `${componentName}.module.css`))).toBe(true);
  });

  it("moves components with no private styles without creating CSS modules", () => {
    expect(existsSync(path.resolve(componentsDir, "OfflineBanner", "OfflineBanner.tsx"))).toBe(true);
    expect(existsSync(path.resolve(componentsDir, "ProtectedRoute", "ProtectedRoute.tsx"))).toBe(true);
    expect(existsSync(path.resolve(componentsDir, "OfflineBanner", "OfflineBanner.module.css"))).toBe(false);
    expect(existsSync(path.resolve(componentsDir, "ProtectedRoute", "ProtectedRoute.module.css"))).toBe(false);
  });

  it.each(Object.entries(moduleClasses))("defines expected private classes for %s", (componentName, classNames) => {
    const cssSource = readFileSync(
      path.resolve(componentsDir, componentName, `${componentName}.module.css`),
      "utf8"
    );

    for (const className of classNames) {
      expect(cssSource).toMatch(new RegExp(`\\.${className}\\b`));
    }
  });
});
