import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestIconMatch } from "../workers/iconWorkerClient";
import { useIconSuggestion } from "./useIconSuggestion";

vi.mock("../workers/iconWorkerClient", () => ({
  primeIconWorker: vi.fn(),
  requestIconMatch: vi.fn()
}));

function HookHarness({ text }) {
  const { icon, loading } = useIconSuggestion(text);

  return [
    createElement("span", { "data-testid": "icon", key: "icon" }, icon ?? ""),
    createElement("span", { "data-testid": "loading", key: "loading" }, String(loading))
  ];
}

describe("useIconSuggestion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    requestIconMatch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("returns an exact match immediately without calling the worker", () => {
    render(createElement(HookHarness, { text: "Milch" }));

    expect(screen.getByTestId("icon").textContent).toBe("🥛");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns null and not loading for empty input", () => {
    render(createElement(HookHarness, { text: "   " }));

    expect(screen.getByTestId("icon").textContent).toBe("");
    expect(screen.getByTestId("loading").textContent).toBe("false");
    expect(requestIconMatch).not.toHaveBeenCalled();
  });

  it("returns null when the worker reports a below-threshold match", async () => {
    requestIconMatch.mockResolvedValue({ icon: null, score: 0.49 });

    render(createElement(HookHarness, { text: "dairy product" }));

    expect(screen.getByTestId("loading").textContent).toBe("true");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(requestIconMatch).toHaveBeenCalledWith("dairy product");
    expect(screen.getByTestId("icon").textContent).toBe("");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("returns the worker icon when the score is above the threshold", async () => {
    requestIconMatch.mockResolvedValue({ icon: "🧀", score: 0.82 });

    render(createElement(HookHarness, { text: "dairy product" }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(requestIconMatch).toHaveBeenCalledWith("dairy product");
    expect(screen.getByTestId("icon").textContent).toBe("🧀");
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });
});
