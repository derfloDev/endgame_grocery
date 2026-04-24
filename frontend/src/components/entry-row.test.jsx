import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EntryRow from "./EntryRow";

describe("EntryRow", () => {
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
