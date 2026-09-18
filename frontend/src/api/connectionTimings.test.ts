import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimeoutSignal } from "./connectionTimings";

describe("createTimeoutSignal", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("aborts at the requested deadline", () => {
    const { signal } = createTimeoutSignal(100);
    vi.advanceTimersByTime(99);
    expect(signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels the deadline without aborting a completed request", () => {
    const { signal, cancel } = createTimeoutSignal(100);
    cancel();
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100);
    expect(signal.aborted).toBe(false);
  });
});
