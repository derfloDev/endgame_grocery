import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../index.css";
import AddItemSheet from "./AddItemSheet";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

vi.mock("../hooks/useIconSuggestion", () => ({
  useIconSuggestion: vi.fn((text) => {
    if (text === "Milch") {
      return { iconName: "IconMilk", topMatches: [], loading: false };
    }

    if (text === "Banane") {
      return { iconName: "Banana", topMatches: [], loading: false };
    }

    if (text === "Gemüse") {
      return {
        iconName: "IconSalad",
        topMatches: ["IconSalad", "IconLeaf", "IconCarrot"],
        loading: false
      };
    }

    if (text === "Mil") {
      return { iconName: null, topMatches: [], loading: true };
    }

    return { iconName: null, topMatches: [], loading: false };
  })
}));

describe("AddItemSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the resolved icon preview and submits it with the item text", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Milch");

    expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeTruthy();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "IconMilk");
  });

  it("expands the inline icon browser, filters icons, and submits the manually selected icon", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Gemüse");

    expect(screen.getByRole("group", { name: "Suggested icons" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose IconLeaf" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Choose IconLeaf" }));
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(screen.getByRole("dialog", { name: "Add Item" }).className).toContain("bottom-sheet--browser-open");
    expect(screen.queryByRole("dialog", { name: "Choose Icon" })).toBeNull();
    expect(screen.getByLabelText("Add item")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Item" })).toBeTruthy();
    expect(screen.getByLabelText("Search icons")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Weniger anzeigen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Zurück" })).toBeNull();
    expect(container.querySelectorAll(".add-item-icon-browser-grid").length).toBe(1);

    await userEvent.type(screen.getByLabelText("Search icons"), "trash");
    expect(screen.queryByRole("button", { name: "Browse IconMilk" })).toBeNull();
    expect(screen.getByRole("button", { name: "Browse IconTrash" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Browse IconTrash" }));

    expect(screen.queryByLabelText("Search icons")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Add Item" }).className).not.toContain("bottom-sheet--browser-open");
    expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeTruthy();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Gemüse", "IconTrash");
  });

  it("supports edit mode with prefilled text and icon state", async () => {
    const onAdd = vi.fn();
    const { container } = render(
      <AddItemSheet
        initialIconName="IconMilk"
        initialText="Milch"
        mode="edit"
        open
        onAdd={onAdd}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: "Edit Item" })).toBeTruthy();
    expect(screen.getByLabelText("Edit item").value).toBe("Milch");
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Item" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(screen.getByLabelText("Edit item").value).toBe("Milch");
    expect(screen.getByRole("button", { name: "Save Item" })).toBeTruthy();
    expect(screen.getByLabelText("Search icons")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Weniger anzeigen" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Search icons"), "banana");
    await userEvent.click(screen.getByRole("button", { name: "Browse Banana" }));

    expect(screen.queryByLabelText("Search icons")).toBeNull();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Save Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "Banana");
  });

  it("shows a loading indicator while the icon suggestion is resolving", async () => {
    render(<AddItemSheet open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Mil");

    expect(screen.getByLabelText("Loading icon suggestion")).toBeTruthy();
    expect(screen.queryByTestId("add-item-icon-preview")).toBeNull();
  });

  it("uses a not-allowed cursor for the disabled submit button", () => {
    render(<AddItemSheet open onAdd={vi.fn()} onClose={vi.fn()} />);

    const submitButton = screen.getByRole("button", { name: "Add Item" });

    expect(submitButton.disabled).toBe(true);
    expect(cssSource).toMatch(
      /\.button-primary:disabled,\s*\.eg-btn-primary:disabled\s*\{[^}]*cursor:\s*not-allowed;/s
    );
  });
});
