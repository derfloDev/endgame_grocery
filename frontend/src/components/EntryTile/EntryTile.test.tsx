import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import EntryTile from "./EntryTile";

describe("EntryTile", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders the persisted icon when present", () => {
    render(<EntryTile entry={{ id: "entry-1", text: "Milk", status: "open", icon: "IconMilk" }} />);

    expect(screen.getByTestId("entry-tile-icon-entry-1").getAttribute("data-icon-name")).toBe("IconMilk");
  });

  it("renders the fallback cart icon when no persisted icon is set", () => {
    render(<EntryTile entry={{ id: "entry-2", text: "Bread", status: "open", icon: null }} />);

    expect(screen.getByTestId("entry-tile-icon-entry-2").getAttribute("data-icon-name")).toBe("IconShoppingCart");
  });

  it("renders a details line when details are present", () => {
    render(<EntryTile entry={{ id: "entry-2b", text: "Bread", status: "open", icon: null, details: "Whole grain" }} />);

    expect(screen.getByText("Whole grain").className).toContain("entry-tile-details");
  });

  it("omits the details line when details are absent", () => {
    render(<EntryTile entry={{ id: "entry-2c", text: "Bread", status: "open", icon: null }} />);

    expect(screen.queryByText("Whole grain")).toBeNull();
  });

  it("renders changed entry badges", () => {
    render(
      <EntryTile
        changeKind="edited"
        entry={{ id: "entry-2d", text: "Bread", status: "open", icon: null, is_changed: true }}
      />
    );

    expect(screen.getByText("Edited").className).toContain("entry-tile-change-badge");
  });

  it("calls onToggle on a short tap", async () => {
    const onToggle = vi.fn();
    render(<EntryTile entry={{ id: "entry-3", text: "Coffee", status: "open", icon: "IconMilk" }} onToggle={onToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark Coffee done" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("calls onEdit after a 500 ms hold and does not call onToggle", async () => {
    const onEdit = vi.fn();
    const onToggle = vi.fn();
    render(
      <EntryTile
        entry={{ id: "entry-4", text: "Coffee", status: "open", icon: "IconMilk" }}
        onEdit={onEdit}
        onToggle={onToggle}
      />
    );

    const tile = screen.getByRole("button", { name: "Mark Coffee done" });
    fireEvent.mouseDown(tile);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    fireEvent.mouseUp(tile);
    fireEvent.click(tile);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("adds entry-tile--pressing while held", () => {
    render(<EntryTile entry={{ id: "entry-5", text: "Coffee", status: "open", icon: "IconMilk" }} />);
    const tile = screen.getByRole("button", { name: "Mark Coffee done" });

    fireEvent.mouseDown(tile);
    expect(tile.className).toContain("entry-tile--pressing");

    fireEvent.mouseUp(tile);
    expect(tile.className).not.toContain("entry-tile--pressing");
  });
});
