import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AddItemSheet from "./AddItemSheet";

vi.mock("../hooks/useIconSuggestion", () => ({
  useIconSuggestion: vi.fn((text) => {
    if (text === "Milch") {
      return { iconName: "IconMilk", topMatches: [], loading: false };
    }

    if (text === "Mil") {
      return { iconName: null, topMatches: [], loading: true };
    }

    return { iconName: null, topMatches: [], loading: false };
  })
}));

describe("AddItemSheet", () => {
  it("shows the resolved icon preview and submits it with the item text", async () => {
    const onAdd = vi.fn();

    render(<AddItemSheet open onAdd={onAdd} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Milch");

    expect(screen.getByText("IconMilk")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(onAdd).toHaveBeenCalledWith("Milch", "IconMilk");
  });

  it("shows a loading indicator while the icon suggestion is resolving", async () => {
    render(<AddItemSheet open onAdd={vi.fn()} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Add item"), "Mil");

    expect(screen.getByLabelText("Loading icon suggestion")).toBeTruthy();
    expect(screen.queryByText("IconMilk")).toBeNull();
  });
});
