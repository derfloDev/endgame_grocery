import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecentlyUsedSection from "./RecentlyUsedSection";

describe("RecentlyUsedSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the item count, triggers add actions, and exposes dismiss controls", async () => {
    const onAdd = vi.fn();
    const onDismiss = vi.fn();

    render(
      <RecentlyUsedSection
        items={[
          { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes" },
          { text: "Bread", icon: "IconBread" }
        ]}
        onAdd={onAdd}
        onDismiss={onDismiss}
      />
    );

    const section = screen.getByRole("region", { name: "Recently Used" });
    expect(within(section).getByText("RECENTLY USED")).toBeTruthy();
    expect(within(section).getByText("2")).toBeTruthy();
    expect(screen.getByTestId("recently-used-grid")).toBeTruthy();
    expect(screen.getAllByTestId("recently-used-cell")).toHaveLength(2);

    await userEvent.click(within(section).getByRole("button", { name: "Tomatoes" }));
    expect(onAdd).toHaveBeenCalledWith("Tomatoes", "IconSalad", "Cherry tomatoes");
    expect(onAdd).toHaveBeenCalledTimes(1);

    await userEvent.click(within(section).getByRole("button", { name: "Dismiss Bread" }));
    expect(onDismiss).toHaveBeenCalledWith("Bread");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders the fallback icon when an item has no saved icon", () => {
    render(<RecentlyUsedSection items={[{ text: "Bread", icon: null }]} onAdd={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Bread" })).toBeTruthy();
    const icon = screen.getByRole("button", { name: "Bread" }).querySelector("[data-icon-name]");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("data-icon-name")).toBe("IconShoppingCart");
  });

  it("renders changed done badges inside recently used chips", () => {
    render(
      <RecentlyUsedSection
        changedDoneTexts={new Set(["Bread"])}
        items={[{ text: "Bread", icon: "IconBread" }]}
        onAdd={vi.fn()}
      />
    );

    const chip = screen.getByRole("button", { name: "Bread" });
    expect(within(chip).getByText("Done").className).toContain("recently-used-change-badge");
  });

  it("hides dismiss controls while changed done badges are visible", () => {
    render(
      <RecentlyUsedSection
        changedDoneTexts={new Set(["Bread"])}
        items={[{ text: "Bread", icon: "IconBread" }]}
        onAdd={vi.fn()}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Dismiss Bread" })).toBeNull();
  });

  it("positions changed badges inside recently used chip corners", () => {
    const cssSource = readFileSync(resolve(import.meta.dirname, "RecentlyUsedSection.module.css"), "utf8");

    expect(cssSource).toMatch(/\.recently-used-chip\s*\{[^}]*position:\s*relative;[^}]*overflow:\s*hidden;/s);
    expect(cssSource).toMatch(
      /\.recently-used-change-badge\s*\{[^}]*top:\s*0;[^}]*right:\s*0;[^}]*border-radius:\s*0 calc\(var\(--radius-md\) - 1px\) 0 0;/s
    );
  });
});
