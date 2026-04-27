import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../index.css";
import AutocompleteSuggestions from "./AutocompleteSuggestions";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");

describe("AutocompleteSuggestions", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when there are no suggestions", () => {
    const { container } = render(<AutocompleteSuggestions suggestions={[]} onSelect={vi.fn()} />);

    expect(container.firstChild).toBeNull();
  });

  it("renders one chip per suggestion", () => {
    render(
      <AutocompleteSuggestions
        suggestions={[
          { text: "Tomaten", icon: "IconSalad" },
          { text: "Tomatenmark", icon: "IconBottle" }
        ]}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByRole("listbox", { name: "Autocomplete suggestions" })).toBeTruthy();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("option", { name: "Tomaten" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Tomatenmark" })).toBeTruthy();
  });

  it("calls onSelect with the selected text and icon", async () => {
    const onSelect = vi.fn();
    render(
      <AutocompleteSuggestions
        suggestions={[{ text: "Tomaten", icon: "IconSalad" }]}
        onSelect={onSelect}
      />
    );

    await userEvent.click(screen.getByRole("option", { name: "Tomaten" }));

    expect(onSelect).toHaveBeenCalledWith("Tomaten", "IconSalad");
  });

  it("renders a suggestion without an icon and keeps the dropdown row full-width with a 44px touch target", () => {
    const { container } = render(
      <AutocompleteSuggestions suggestions={[{ text: "Milch", icon: null }]} onSelect={vi.fn()} />
    );

    expect(screen.getByRole("option", { name: "Milch" })).toBeTruthy();
    expect(container.querySelector(".autocomplete-chip svg")).toBeNull();
    expect(cssSource).toMatch(/\.autocomplete-chip\s*\{[^}]*min-height:\s*44px;[^}]*width:\s*100%;/s);
  });
});
