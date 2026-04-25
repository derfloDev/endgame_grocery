import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ICON_REGISTRY_KEYS } from "../data/iconRegistry";
import IconPickerSheet from "./IconPickerSheet";

describe("IconPickerSheet", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the full icon registry when search is empty", () => {
    const { container } = render(
      <IconPickerSheet open selectedIconName="IconMilk" onClose={vi.fn()} onSelect={vi.fn()} />
    );

    expect(container.querySelectorAll(".icon-picker-btn")).toHaveLength(ICON_REGISTRY_KEYS.length);
    expect(screen.getByRole("button", { name: "Select IconMilk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select IconTrash" })).toBeTruthy();
  });

  it("filters icons by search text and highlights the selected icon", async () => {
    render(<IconPickerSheet open selectedIconName="IconMilk" onClose={vi.fn()} onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Search icons"), "milk");

    const selectedButton = screen.getByRole("button", { name: "Select IconMilk" });

    expect(selectedButton.className).toContain("icon-picker-btn--selected");
    expect(screen.queryByRole("button", { name: "Select IconTrash" })).toBeNull();
  });

  it("selects an icon and closes the sheet", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<IconPickerSheet open selectedIconName={null} onClose={onClose} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: "Select IconMilk" }));

    expect(onSelect).toHaveBeenCalledWith("IconMilk");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
