import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import EntryRow from "./EntryRow";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

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

  it("renders a subordinate details line when details are present", () => {
    render(
      <EntryRow
        entry={{ id: "entry-2b", text: "Bread", status: "open", icon: null, details: "Whole grain" }}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByText("Whole grain").className).toContain("entry-row-details");
    expect(cssSource).toMatch(
      /\.entry-row-details\s*\{[^}]*font-size:\s*0\.8rem;[^}]*color:\s*var\(--text-secondary\);[^}]*margin:\s*0;/s
    );
  });

  it("omits the details line when details are empty", () => {
    render(
      <EntryRow
        entry={{ id: "entry-2c", text: "Bread", status: "open", icon: null, details: null }}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    expect(screen.queryByText("Whole grain")).toBeNull();
  });

  it("calls onEdit when the edit button is pressed", async () => {
    const onEdit = vi.fn();
    render(
      <EntryRow
        entry={{ id: "entry-3", text: "Coffee", status: "open", icon: "IconMilk" }}
        onDelete={vi.fn()}
        onEdit={onEdit}
        onToggle={vi.fn()}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: "Edit Coffee" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
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

  it("applies enter and exit animation classes and disables pointer events while exiting", () => {
    render(
      <EntryRow
        entry={{ id: "entry-4", text: "Juice", status: "open", icon: null }}
        isEntering
        isExiting
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
      />
    );

    const row = screen.getByTestId("entry-row-entry-4");

    expect(row.className).toContain("entry-entering");
    expect(row.className).toContain("entry-exiting");
    expect(row.style.pointerEvents).toBe("none");
    expect(cssSource).toMatch(/@keyframes entryFadeIn/s);
    expect(cssSource).toMatch(/@keyframes entryFadeOut/s);
    expect(cssSource).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/s);
  });
});
