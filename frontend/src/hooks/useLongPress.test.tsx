import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./useLongPress";

function LongPressHarness({ ms = 500, onLongPress = vi.fn() }) {
  const { pressing, longPressHandlers } = useLongPress(onLongPress, ms);

  return (
    <button data-pressing={pressing ? "true" : "false"} type="button" {...longPressHandlers}>
      Hold
    </button>
  );
}

describe("useLongPress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not call onLongPress on a short tap", async () => {
    const onLongPress = vi.fn();
    render(<LongPressHarness onLongPress={onLongPress} />);

    fireEvent.mouseDown(screen.getByRole("button", { name: "Hold" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    fireEvent.mouseUp(screen.getByRole("button", { name: "Hold" }));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("calls onLongPress after a 500 ms hold", async () => {
    const onLongPress = vi.fn();
    render(<LongPressHarness onLongPress={onLongPress} />);

    fireEvent.mouseDown(screen.getByRole("button", { name: "Hold" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("sets pressing while held and clears it after release", () => {
    render(<LongPressHarness />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.mouseDown(button);
    expect(button.getAttribute("data-pressing")).toBe("true");

    fireEvent.mouseUp(button);
    expect(button.getAttribute("data-pressing")).toBe("false");
  });

  it("does not call onLongPress if pointer leaves before the threshold", async () => {
    const onLongPress = vi.fn();
    render(<LongPressHarness onLongPress={onLongPress} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.mouseDown(button);
    fireEvent.mouseLeave(button);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});
