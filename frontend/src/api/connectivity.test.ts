import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIsOnline, reportStreamState, resetConnectivityForTests, subscribe } from "./connectivity";

describe("shared connectivity state", () => {
  beforeEach(resetConnectivityForTests);

  it("starts unknown and does not treat a lost stream as proof of offline status", () => {
    expect(getIsOnline()).toBeNull();
    reportStreamState("lost");
    expect(getIsOnline()).toBeNull();
  });

  it("reports an open stream online without issuing a request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      reportStreamState("open");
      expect(getIsOnline()).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("notifies on stream transitions, keeps the last known reachability and supports unsubscribe", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    reportStreamState("open");
    reportStreamState("open");
    expect(listener).toHaveBeenCalledTimes(1);
    reportStreamState("lost");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getIsOnline()).toBe(true);
    unsubscribe();
    reportStreamState("open");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("resets both cached state and listeners for isolated provider tests", () => {
    const listener = vi.fn();
    subscribe(listener);
    reportStreamState("open");
    resetConnectivityForTests();
    expect(getIsOnline()).toBeNull();
    reportStreamState("open");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
