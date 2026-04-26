import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import EntryRow from "./EntryRow";

describe("EntryRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the persisted icon when present", () => {
    render(
      <EntryRow
        entry={{ id: "entry-1", text: "Milk", status: "open", icon: "IconMilk" }}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("entry-row-icon-entry-1").getAttribute("data-icon-name")).toBe("IconMilk");
  });

  it("renders the fallback cart icon when no persisted icon is set", () => {
    render(
      <EntryRow
        entry={{ id: "entry-2", text: "Bread", status: "open", icon: null }}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("entry-row-icon-entry-2").getAttribute("data-icon-name")).toBe("IconShoppingCart");
  });

  it("shows the inline icon picker, opens the full picker, and saves the updated icon", async () => {
    const onEdit = vi.fn();
    const { container } = render(
      <EntryRow
        entry={{ id: "entry-3", text: "Coffee", status: "open", icon: "IconMilk" }}
        onDelete={vi.fn()}
        onEdit={onEdit}
        onToggle={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Coffee" }));

    expect(screen.getByRole("group", { name: "Entry icons" })).toBeTruthy();
    expect(container.querySelectorAll(".entry-row-icon-picker .add-item-icon-picker-btn")).toHaveLength(
      ICON_REGISTRY_KEYS.length
    );
    expect(screen.getByTestId("entry-edit-preview-entry-3").querySelector("svg")?.getAttribute("data-icon-name")).toBe(
      "IconMilk"
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose IconCoffee" }));

    expect(screen.getByTestId("entry-edit-preview-entry-3").querySelector("svg")?.getAttribute("data-icon-name")).toBe(
      "IconCoffee"
    );

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(await screen.findByRole("dialog", { name: "Choose Icon" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Select IconTrash" }));

    expect(screen.queryByRole("dialog", { name: "Choose Icon" })).toBeNull();
    expect(screen.getByTestId("entry-edit-preview-entry-3").querySelector("svg")?.getAttribute("data-icon-name")).toBe(
      "IconTrash"
    );

    const editInput = screen.getByLabelText("Edit Coffee");
    await userEvent.clear(editInput);
    await userEvent.type(editInput, "Ground coffee");
    await userEvent.click(screen.getByRole("button", { name: "Save item" }));

    expect(onEdit).toHaveBeenCalledWith("Ground coffee", "IconTrash");
  });

  it("deletes an entry after a left swipe beyond the threshold", () => {
    const onDelete = vi.fn();

    render(
      <EntryRow
        entry={{ id: "entry-1", text: "Milk", status: "open" }}
        onDelete={onDelete}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    const row = screen.getByTestId("entry-row-entry-1");

    fireEvent.touchStart(row, { touches: [{ clientX: 220 }] });
    fireEvent.touchMove(row, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(row);

    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
