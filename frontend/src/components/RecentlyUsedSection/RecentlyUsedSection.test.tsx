import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecentlyUsedSection from "./RecentlyUsedSection";

describe("RecentlyUsedSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the item count and triggers add and dismiss actions separately", async () => {
    const onAdd = vi.fn();
    const onDismiss = vi.fn();

    render(
      <RecentlyUsedSection
        items={[
          { text: "Tomatoes", icon: "IconSalad", useCount: 7 },
          { text: "Bread", icon: "IconBread", useCount: 4 }
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
    expect(onAdd).toHaveBeenCalledWith("Tomatoes", "IconSalad");
    expect(onDismiss).not.toHaveBeenCalled();

    await userEvent.click(within(section).getByRole("button", { name: "Dismiss Bread" }));
    expect(onDismiss).toHaveBeenCalledWith("Bread");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("renders the fallback icon when an item has no saved icon", () => {
    render(
      <RecentlyUsedSection items={[{ text: "Bread", icon: null, useCount: 4 }]} onAdd={vi.fn()} onDismiss={vi.fn()} />
    );

    expect(screen.getByRole("button", { name: "Bread" })).toBeTruthy();
    const icon = screen.getByRole("button", { name: "Bread" }).querySelector("[data-icon-name]");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("data-icon-name")).toBe("IconShoppingCart");
  });
});
