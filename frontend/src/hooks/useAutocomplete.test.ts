import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSuggestions } from "../api/suggestions";
import { useAutocomplete } from "./useAutocomplete";

vi.mock("../api/suggestions", () => ({
  fetchSuggestions: vi.fn()
}));

const fetchSuggestionsMock = vi.mocked(fetchSuggestions);

interface HookHarnessProps {
  listId?: string;
  inputText?: string;
  token?: string;
}

function HookHarness({ listId = "list-1", inputText = "", token = "token-1" }: HookHarnessProps) {
  const { suggestions, loading } = useAutocomplete(listId, inputText, token);

  return [
    createElement("span", { "data-testid": "suggestions", key: "suggestions" }, JSON.stringify(suggestions)),
    createElement("span", { "data-testid": "loading", key: "loading" }, String(loading))
  ];
}

describe("useAutocomplete", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchSuggestionsMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("returns no suggestions for input shorter than two characters", () => {
    render(createElement(HookHarness, { inputText: "a" }));

    expect(screen.getByTestId("suggestions").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(fetchSuggestions).not.toHaveBeenCalled();
  });

  it("debounces requests so only the latest input in a burst is fetched", async () => {
    fetchSuggestionsMock.mockResolvedValue({
      suggestions: [{ text: "Tomaten", icon: "IconSalad", useCount: 7 }]
    });

    const { rerender } = render(createElement(HookHarness, { inputText: "to" }));

    rerender(createElement(HookHarness, { inputText: "tom" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });

    expect(fetchSuggestions).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchSuggestions).toHaveBeenCalledWith("list-1", "token-1", "tom");
    expect(screen.getByTestId("suggestions").textContent).toBe(
      '[{"text":"Tomaten","icon":"IconSalad","useCount":7}]'
    );
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("filters offline cached suggestions with fuzzy matching before returning them", async () => {
    fetchSuggestionsMock.mockResolvedValue({
      offline: true,
      suggestions: [
        { text: "Schokolade", icon: "IconCandy", useCount: 8 },
        { text: "Schokolade", icon: "IconCookie", useCount: 3 },
        { text: "Milch", icon: "IconMilk", useCount: 12 }
      ]
    });

    render(createElement(HookHarness, { inputText: "Schokollade" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(fetchSuggestions).toHaveBeenCalledWith("list-1", "token-1", "Schokollade");
    expect(screen.getByTestId("suggestions").textContent).toBe(
      '[{"text":"Schokolade","icon":"IconCandy","useCount":8},{"text":"Schokolade","icon":"IconCookie","useCount":3}]'
    );
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("clears suggestions when the input is cleared", async () => {
    fetchSuggestionsMock.mockResolvedValue({
      suggestions: [{ text: "Tomaten", icon: "IconSalad", useCount: 7 }]
    });

    const { rerender } = render(createElement(HookHarness, { inputText: "tom" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId("suggestions").textContent).toBe(
      '[{"text":"Tomaten","icon":"IconSalad","useCount":7}]'
    );

    rerender(createElement(HookHarness, { inputText: "" }));

    expect(screen.getByTestId("suggestions").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
