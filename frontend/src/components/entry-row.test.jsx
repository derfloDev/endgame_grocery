import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntryRow from "./EntryRow";

describe("EntryRow", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the persisted icon when present", () => {
    render(
      <EntryRow
        entry={{ id: "entry-1", text: "Milk", status: "open", icon: "🥛" }}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("🥛")).toBeTruthy();
    expect(screen.queryByText("🛒")).toBeNull();
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

    expect(screen.getByText("🛒")).toBeTruthy();
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
