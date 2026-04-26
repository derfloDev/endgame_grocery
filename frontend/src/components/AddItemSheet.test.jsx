import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddItemSheet from "./AddItemSheet";

vi.mock("../hooks/useIconSuggestion", () => ({
  useIconSuggestion: vi.fn((text) => {
    if (text === "Milch") {
      return { iconName: "IconMilk", topMatches: [], loading: false };
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

  it("shows alternative icons, opens the full picker, and submits the manually selected icon", async () => {
    const onAdd = vi.fn();
    const { container } = render(<AddItemSheet open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Gemüse");

    expect(screen.getByRole("group", { name: "Suggested icons" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose IconLeaf" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Choose IconLeaf" }));
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mehr anzeigen" }));
    expect(await screen.findByRole("dialog", { name: "Choose Icon" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Select IconTrash" }));

    expect(screen.queryByRole("dialog", { name: "Choose Icon" })).toBeNull();
    expect(container.querySelector("[data-testid='add-item-icon-preview'] svg")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Gemüse", "IconTrash");
  });

  it("shows a loading indicator while the icon suggestion is resolving", async () => {
    render(<AddItemSheet open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Mil");

    expect(screen.getByLabelText("Loading icon suggestion")).toBeTruthy();
    expect(screen.queryByTestId("add-item-icon-preview")).toBeNull();
  });
});
