import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RecentlyUsedSection from "./RecentlyUsedSection";

describe("RecentlyUsedSection", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the item count and triggers add actions without a dismiss control", async () => {
    const onAdd = vi.fn();

    render(
      <RecentlyUsedSection
        items={[
          { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes" },
          { text: "Bread", icon: "IconBread" }
        ]}
        onAdd={onAdd}
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
    expect(within(section).queryByRole("button", { name: "Dismiss Bread" })).toBeNull();
  });

  it("renders the fallback icon when an item has no saved icon", () => {
    render(<RecentlyUsedSection items={[{ text: "Bread", icon: null }]} onAdd={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Bread" })).toBeTruthy();
    const icon = screen.getByRole("button", { name: "Bread" }).querySelector("[data-icon-name]");
    expect(icon).toBeTruthy();
    expect(icon?.getAttribute("data-icon-name")).toBe("IconShoppingCart");
  });
});
