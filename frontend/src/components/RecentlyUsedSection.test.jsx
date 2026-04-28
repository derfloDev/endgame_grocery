import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RecentlyUsedSection from "./RecentlyUsedSection";

describe("RecentlyUsedSection", () => {
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

    await userEvent.click(within(section).getByRole("button", { name: "Tomatoes" }));
    expect(onAdd).toHaveBeenCalledWith("Tomatoes", "IconSalad");
    expect(onDismiss).not.toHaveBeenCalled();

    await userEvent.click(within(section).getByRole("button", { name: "Dismiss Bread" }));
    expect(onDismiss).toHaveBeenCalledWith("Bread");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
