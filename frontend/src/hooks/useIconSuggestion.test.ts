import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestIconMatch } from "../workers/iconWorkerClient";
import { useIconSuggestion } from "./useIconSuggestion";

vi.mock("../workers/iconWorkerClient", () => ({
  primeIconWorker: vi.fn(),
  requestIconMatch: vi.fn()
}));

const requestIconMatchMock = vi.mocked(requestIconMatch);

interface HookHarnessProps {
  text: string;
}

function HookHarness({ text }: HookHarnessProps) {
  const { iconName, topMatches, loading } = useIconSuggestion(text);

  return [
    createElement("span", { "data-testid": "icon-name", key: "icon-name" }, iconName ?? ""),
    createElement("span", { "data-testid": "top-matches", key: "top-matches" }, JSON.stringify(topMatches)),
    createElement("span", { "data-testid": "loading", key: "loading" }, String(loading))
  ];
}

describe("useIconSuggestion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestIconMatchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("returns an exact match immediately without calling the worker", () => {
    render(createElement(HookHarness, { text: "Milch" }));

    expect(screen.getByTestId("icon-name").textContent).toBe("IconMilk");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns the banana exact match immediately without calling the worker", () => {
    render(createElement(HookHarness, { text: "Banane" }));

    expect(screen.getByTestId("icon-name").textContent).toBe("Banana");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns the bell-pepper icon for compound input containing paprika without calling the worker", () => {
    render(createElement(HookHarness, { text: "Spritzpaprika" }));

    expect(screen.getByTestId("icon-name").textContent).toBe("CustomBellPepper");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns the carrot icon for compound input containing moehren without calling the worker", () => {
    render(createElement(HookHarness, { text: "Minimöhren" }));

    expect(screen.getByTestId("icon-name").textContent).toBe("IconCarrot");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns null and not loading for empty input", () => {
    render(createElement(HookHarness, { text: "   " }));

    expect(screen.getByTestId("icon-name").textContent).toBe("");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns null when the worker reports a below-threshold match", async () => {
    requestIconMatchMock.mockResolvedValue({ iconName: null, score: 0.49, topMatches: [] });

    render(createElement(HookHarness, { text: "dairy product" }));

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(requestIconMatch).toHaveBeenCalledWith("dairy product");
    expect(screen.getByTestId("icon-name").textContent).toBe("");
    expect(screen.getByTestId("top-matches").textContent).toBe("[]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("returns the worker icon and top matches when the score is above the threshold", async () => {
    requestIconMatchMock.mockResolvedValue({
      iconName: "IconCheese",
      score: 0.82,
      topMatches: [
        { iconName: "IconCheese", score: 0.82 },
        { iconName: "IconMilk", score: 0.65 }
      ]
    });

    render(createElement(HookHarness, { text: "dairy product" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(requestIconMatch).toHaveBeenCalledWith("dairy product");
    expect(screen.getByTestId("icon-name").textContent).toBe("IconCheese");
    expect(screen.getByTestId("top-matches").textContent).toBe("[\"IconCheese\",\"IconMilk\"]");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
