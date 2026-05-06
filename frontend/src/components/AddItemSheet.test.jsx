import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("renders the optional details field with the expected placeholder", () => {
    render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByLabelText("Details (optional)")).toBeTruthy();
    expect(screen.getByPlaceholderText("Description, amount...")).toBeTruthy();
    expect(cssSource).toMatch(
      /\.bottom-sheet\s*\{[^}]*padding:\s*var\(--space-5\)\s+var\(--space-4\)\s+var\(--space-5\);/s
    );
    expect(cssSource).toMatch(
      /\.add-item-disclosure\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0;[^}]*\}/s
    );
    expect(cssSource).toMatch(
      /\.add-item-disclosure--open\s*\{[^}]*gap:\s*var\(--space-2\);[^}]*\}/s
    );
    expect(cssSource).toMatch(
      /\.add-item-actions\s*\{[^}]*margin-top:\s*-8px;[^}]*\}/s
    );
  });

  it("shows the resolved icon preview and submits it with the item text", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Milch" } });

    expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeTruthy();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "IconMilk", "");
  }, 10000);

  it("expands the inline icon browser, filters icons, and submits the manually selected icon", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Gemüse" } });

    expect(screen.getByRole("group", { name: "Suggested icons" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose Leaf" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Choose Leaf" }));
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(screen.getByRole("dialog", { name: "Add Item" }).className).toContain("bottom-sheet--browser-open");
    expect(screen.queryByRole("dialog", { name: "Choose Icon" })).toBeNull();
    expect(screen.getByLabelText("Add item")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add Item" })).toBeTruthy();
    const iconBrowser = container.querySelector(".add-item-icon-browser");
    const iconBrowserInner = container.querySelector(".add-item-icon-browser-inner");
    const iconSearchInput = screen.getByLabelText("Search icons");
    expect(iconBrowser).toBeTruthy();
    expect(iconBrowserInner).toBeTruthy();
    expect(iconBrowser.className).toContain("add-item-icon-browser--open");
    expect(iconBrowser.getAttribute("aria-hidden")).toBe("false");
    expect(iconBrowser.hasAttribute("inert")).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(iconSearchInput);
    });
    expect(screen.getByRole("button", { name: "Weniger anzeigen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Zurück" })).toBeNull();
    expect(container.querySelectorAll(".add-item-icon-browser-grid").length).toBe(1);

    fireEvent.change(iconSearchInput, { target: { value: "trash" } });
    expect(screen.queryByRole("button", { name: "Browse Milk" })).toBeNull();
    expect(screen.getByRole("button", { name: "Browse Trash" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Browse Trash" }));

    expect(screen.getByLabelText("Search icons")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Add Item" }).className).not.toContain("bottom-sheet--browser-open");
    expect(iconBrowser.className).not.toContain("add-item-icon-browser--open");
    expect(iconBrowser.getAttribute("aria-hidden")).toBe("true");
    expect(iconBrowser.getAttribute("inert")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Mehr anzeigen" })).toBeTruthy();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Gemüse", "IconTrash", "");
  }, 10000);

  it("submits typed details as the third onAdd argument", async () => {
    const onAdd = vi.fn();
    render(<AddItemSheet listId="list-1" open onAdd={onAdd} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Reis" } });
    fireEvent.change(screen.getByLabelText("Details (optional)"), { target: { value: "500 g" } });
    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Reis", null, "500 g");
  });

  it("supports edit mode with prefilled text and icon state", async () => {
    const onAdd = vi.fn();
    const { container } = render(
      <AddItemSheet
        initialDetails="2L"
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
    expect(screen.getByLabelText("Details (optional)").value).toBe("2L");
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Item" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(screen.getByLabelText("Edit item").value).toBe("Milch");
    expect(screen.getByRole("button", { name: "Save Item" })).toBeTruthy();
    const iconBrowser = container.querySelector(".add-item-icon-browser");
    const iconSearchInput = screen.getByLabelText("Search icons");
    expect(iconBrowser.className).toContain("add-item-icon-browser--open");
    expect(screen.getByRole("button", { name: "Weniger anzeigen" })).toBeTruthy();
    await waitFor(() => {
      expect(document.activeElement).toBe(iconSearchInput);
    });
    fireEvent.change(iconSearchInput, { target: { value: "banana" } });
    await userEvent.click(screen.getByRole("button", { name: "Browse Banana" }));

    expect(screen.getByLabelText("Search icons")).toBeTruthy();
    expect(iconBrowser.className).not.toContain("add-item-icon-browser--open");
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Save Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "Banana", "2L");
  });

  it("shows a loading indicator while the icon suggestion is resolving", async () => {
    render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Mil" } });

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

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Tom" } });

    const inputWrap = container.querySelector(".eg-input-wrap");
    const inputAnchor = container.querySelector(".eg-input-anchor");
    expect(inputWrap).toBeTruthy();
    expect(inputAnchor).toBeTruthy();
    expect(screen.getByLabelText("Add item").getAttribute("autocomplete")).toBe("off");
    expect(within(inputAnchor).getByRole("listbox", { name: "Autocomplete suggestions" })).toBeTruthy();
    expect(within(inputAnchor).getByRole("option", { name: "Tomaten" })).toBeTruthy();

    await userEvent.click(within(inputAnchor).getByRole("option", { name: "Tomaten" }));

    expect(onAdd).toHaveBeenCalledWith("Tomaten", "IconSalad", "");
    expect(screen.getByRole("dialog", { name: "Add Item" })).toBeTruthy();
    expect(screen.getByLabelText("Add item").value).toBe("");
    expect(screen.getByLabelText("Details (optional)").value).toBe("");
    expect(screen.queryByRole("listbox", { name: "Autocomplete suggestions" })).toBeNull();
    expect(cssSource).toMatch(
      /\.eg-input-wrap\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;[^}]*gap:\s*10px;/s
    );
    expect(cssSource).toMatch(/\.eg-input-anchor\s*\{[^}]*flex:\s*1;[^}]*position:\s*relative;/s);
    expect(cssSource).toMatch(/\.autocomplete-suggestions\s*\{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100%\s*\+\s*2px\);[^}]*left:\s*0;[^}]*right:\s*0;/s);
  });

  it("closes the dropdown when clicking outside the input anchor", async () => {
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Tom" } });

    const inputAnchor = container.querySelector(".eg-input-anchor");
    expect(within(inputAnchor).getByRole("listbox", { name: "Autocomplete suggestions" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));

    expect(screen.queryByRole("listbox", { name: "Autocomplete suggestions" })).toBeNull();
  });

  it("keeps the preview icon outside the dropdown anchor and inline to the right of the input", async () => {
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Add item"), { target: { value: "Milch" } });

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

  it("keeps the icon browser mounted while collapsed and marks it inert until opened", async () => {
    const { container } = render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

    const iconBrowser = container.querySelector(".add-item-icon-browser");
    const iconBrowserInner = container.querySelector(".add-item-icon-browser-inner");
    const iconBrowserRule =
      cssSource.match(/\.add-item-icon-browser\s*\{[^}]*\}/s)?.[0] ?? "";
    const iconBrowserInnerRule =
      cssSource.match(/\.add-item-icon-browser-inner\s*\{[^}]*\}/s)?.[0] ?? "";

    expect(iconBrowser).toBeTruthy();
    expect(iconBrowserInner).toBeTruthy();
    expect(iconBrowser.className).not.toContain("add-item-icon-browser--open");
    expect(iconBrowser.getAttribute("aria-hidden")).toBe("true");
    expect(iconBrowser.getAttribute("inert")).not.toBeNull();
    expect(cssSource).toMatch(
      /\.add-item-icon-browser\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*0fr;[^}]*opacity:\s*0;[^}]*transition:\s*[^;]*grid-template-rows/s
    );
    expect(iconBrowserRule).toMatch(/overflow:\s*clip;/);
    expect(iconBrowserRule).toMatch(/contain:\s*layout;/);
    expect(iconBrowserInnerRule).toMatch(/overflow:\s*clip;/);
    expect(iconBrowserInnerRule).toMatch(/overflow-clip-margin:\s*12px;/);
    expect(iconBrowserInnerRule).toMatch(/display:\s*grid;/);
    expect(iconBrowserInnerRule).toMatch(/gap:\s*16px;/);
    expect(iconBrowserInnerRule).toMatch(/padding:\s*4px 4px 0;/);
    expect(iconBrowserInnerRule).toMatch(/min-height:\s*0;/);
    expect(iconBrowserInnerRule).not.toMatch(/border-top:/);
    expect(cssSource).toMatch(/\.add-item-icon-browser--open\s*\{[^}]*grid-template-rows:\s*1fr;[^}]*opacity:\s*1;/s);
    expect(cssSource).toMatch(
      /\.bottom-sheet--browser-open\s+\.add-item-form\s*>\s*:not\(\.add-item-disclosure\)\s*\{[^}]*flex-shrink:\s*0;/s
    );
    expect(cssSource).toMatch(
      /\.bottom-sheet--browser-open\s+\.add-item-disclosure\s*\{[^}]*display:\s*flex;[^}]*flex:\s*1;[^}]*flex-direction:\s*column;[^}]*min-height:\s*0;/s
    );
    expect(cssSource).toMatch(
      /\.bottom-sheet--browser-open\s+\.add-item-icon-browser-inner\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*16px;[^}]*overflow:\s*clip;[^}]*min-height:\s*0;/s
    );
  });

  it("keeps the FAB inset on narrow screens and prevents icon-browser collapse overflow from reaching the viewport", () => {
    expect(cssSource).toMatch(/html\s*\{[^}]*overflow-x:\s*hidden;/s);
    expect(cssSource).toMatch(/\.fab\s*\{[^}]*right:\s*max\(calc\(50%\s*-\s*195px\),\s*16px\);/s);
  });

  it("scrolls the add-item input into view when it receives focus", async () => {
    const scrollIntoView = vi.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;

    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });

    try {
      render(<AddItemSheet listId="list-1" open onAdd={vi.fn()} onClose={vi.fn()} />);

      await userEvent.click(screen.getByLabelText("Add item"));

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "nearest"
      });
    } finally {
      Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView
      });
    }
  });
});
