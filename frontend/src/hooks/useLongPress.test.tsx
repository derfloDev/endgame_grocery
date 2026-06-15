import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "./useLongPress";

function LongPressHarness({ ms = 500, onClick = vi.fn(), onLongPress = vi.fn() }) {
  const { pressing, longPressHandlers } = useLongPress(onLongPress, ms);

  return (
    <button
      data-pressing={pressing ? "true" : "false"}
      type="button"
      {...longPressHandlers}
      onClick={(event) => {
        longPressHandlers.onClick(event);
        if (!event.defaultPrevented) {
          onClick();
        }
      }}
    >
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

  it("cancels the long press after vertical touch movement reaches 8 px", async () => {
    const onLongPress = vi.fn();
    render(<LongPressHarness onLongPress={onLongPress} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 10, clientY: 28 }] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(button.getAttribute("data-pressing")).toBe("false");
  });

  it("blocks the synthetic click after vertical scrolling", () => {
    const onClick = vi.fn();
    render(<LongPressHarness onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 10, clientY: 29 }] });
    fireEvent.touchEnd(button);
    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });

  it("allows a click after vertical touch movement stays below 8 px", () => {
    const onClick = vi.fn();
    render(<LongPressHarness onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 10, clientY: 27 }] });
    fireEvent.touchEnd(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("allows a click after horizontal touch movement", () => {
    const onClick = vi.fn();
    render(<LongPressHarness onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchMove(button, { touches: [{ clientX: 50, clientY: 20 }] });
    fireEvent.touchEnd(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("allows a click after a short touch tap", () => {
    const onClick = vi.fn();
    render(<LongPressHarness onClick={onClick} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchEnd(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onLongPress after a stationary 500 ms touch hold", async () => {
    const onLongPress = vi.fn();
    render(<LongPressHarness onLongPress={onLongPress} />);
    const button = screen.getByRole("button", { name: "Hold" });

    fireEvent.touchStart(button, { touches: [{ clientX: 10, clientY: 20 }] });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
