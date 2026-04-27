import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../index.css";
import AddItemSheet from "./AddItemSheet";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    token: "token-1"
  }))
}));

vi.mock("../hooks/useAutocomplete", () => ({
  useAutocomplete: vi.fn((listId, text) => {
    if (listId === "list-1" && text === "Tom") {
      return {
        suggestions: [
          { text: "Tomaten", icon: "IconSalad" },
          { text: "Tomatenmark", icon: "IconBottle" }
        ],
        loading: false
      };
    }

    return {
      suggestions: [],
      loading: false
    };
  })
}));

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
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Milch");

    expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeTruthy();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "IconMilk");
  });

  it("expands the inline icon browser, filters icons, and submits the manually selected icon", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

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
        listId="list-1"
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
    render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Mil");

    expect(screen.getByLabelText("Loading icon suggestion")).toBeTruthy();
    expect(screen.queryByTestId("add-item-icon-preview")).toBeNull();
  });

  it("uses a not-allowed cursor for the disabled submit button", () => {
    render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    const submitButton = screen.getByRole("button", { name: "Add Item" });

    expect(submitButton.disabled).toBe(true);
    expect(cssSource).toMatch(
      /\.button-primary:disabled,\s*\.eg-btn-primary:disabled\s*\{[^}]*cursor:\s*not-allowed;/s
    );
  });

  it("renders autocomplete chips for typed input and adds the selected suggestion without closing the sheet", async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Tom");

    const inputWrap = container.querySelector(".eg-input-wrap");
    const inputAnchor = container.querySelector(".eg-input-anchor");
    expect(inputWrap).toBeTruthy();
    expect(inputAnchor).toBeTruthy();
    expect(screen.getByLabelText("Add item").getAttribute("autocomplete")).toBe("off");
    expect(within(inputAnchor).getByRole("listbox", { name: "Autocomplete suggestions" })).toBeTruthy();
    expect(within(inputAnchor).getByRole("option", { name: "Tomaten" })).toBeTruthy();

    await userEvent.click(within(inputAnchor).getByRole("option", { name: "Tomaten" }));

    expect(onAdd).toHaveBeenCalledWith("Tomaten", "IconSalad");
    expect(screen.getByRole("dialog", { name: "Add Item" })).toBeTruthy();
    expect(screen.getByLabelText("Add item").value).toBe("");
    expect(screen.queryByRole("listbox", { name: "Autocomplete suggestions" })).toBeNull();
    expect(cssSource).toMatch(
      /\.eg-input-wrap\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;[^}]*gap:\s*10px;/s
    );
    expect(cssSource).toMatch(/\.eg-input-anchor\s*\{[^}]*flex:\s*1;[^}]*position:\s*relative;/s);
    expect(cssSource).toMatch(/\.autocomplete-suggestions\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100%\s*\+\s*2px\);[^}]*left:\s*0;[^}]*right:\s*0;/s);
  });

  it("closes the dropdown when clicking outside the input anchor", async () => {
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Tom");

    const inputAnchor = container.querySelector(".eg-input-anchor");
    expect(within(inputAnchor).getByRole("listbox", { name: "Autocomplete suggestions" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));

    expect(screen.queryByRole("listbox", { name: "Autocomplete suggestions" })).toBeNull();
  });

  it("keeps the preview icon outside the dropdown anchor and inline to the right of the input", async () => {
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Milch");

    const inputWrap = container.querySelector(".eg-input-wrap");
    const inputAnchor = container.querySelector(".eg-input-anchor");
    const preview = container.querySelector("[data-testid='add-item-icon-preview']");

    expect(inputWrap).toBeTruthy();
    expect(inputAnchor).toBeTruthy();
    expect(preview).toBeTruthy();
    expect(inputWrap.children[0]).toBe(inputAnchor);
    expect(inputWrap.children[1]).toBe(preview);
    expect(inputAnchor.contains(preview)).toBe(false);
    expect(cssSource).toMatch(
      /\.eg-input-wrap\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;/s
    );
    expect(cssSource).toMatch(/\.eg-input-anchor\s*\{[^}]*flex:\s*1;[^}]*position:\s*relative;/s);
  });
});
