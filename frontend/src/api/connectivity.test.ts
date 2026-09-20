import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureFreshState, getIsOnline, probeReachability, reportRequestOutcome, reportStreamState, resetConnectivityForTests, subscribe } from "./connectivity";

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

describe("reachability probes", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    resetConnectivityForTests();
    vi.useFakeTimers();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => {
    resetConnectivityForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("probes health without using the cache and reports success even when the browser says offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await ensureFreshState()).toBe(true);
    expect(getIsOnline()).toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/health", { cache: "no-store", signal: expect.any(AbortSignal) });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["network", "http"])("reports offline for a %s probe failure even when the browser says online", async (failure) => {
    if (failure === "network") fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    else fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    expect(await ensureFreshState()).toBe(false);
    expect(getIsOnline()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one in-flight probe and caches its result for the five second window", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const first = probeReachability();
    const second = probeReachability();
    const fresh = ensureFreshState();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response(null, { status: 200 }));
    expect(await Promise.all([first, second, fresh])).toEqual([true, true, true]);
    await vi.advanceTimersByTimeAsync(4999);
    expect(await ensureFreshState()).toBe(true);
    expect(await probeReachability()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not bypass the rate limit on failed probes or browser hint changes", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await ensureFreshState()).toBe(false);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(await ensureFreshState()).toBe(false);
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    expect(await ensureFreshState()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("aborts and settles a hanging probe at the deadline, ignoring a late success", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const pending = ensureFreshState();
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    await vi.advanceTimersByTimeAsync(4999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(false);
    expect(signal.aborted).toBe(true);
    resolve(new Response(null, { status: 200 }));
    await Promise.resolve();
    expect(getIsOnline()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses injected probe timings", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const pending = ensureFreshState({ REACHABILITY_PROBE_TIMEOUT_MS: 20, REACHABILITY_PROBE_MIN_INTERVAL_MS: 100 });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses an open stream without probing, then rechecks after the stream is lost", async () => {
    reportStreamState("open");
    await vi.advanceTimersByTimeAsync(10000);
    expect(await ensureFreshState()).toBe(true);
    expect(await probeReachability()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    reportStreamState("lost");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await ensureFreshState()).toBe(false);
  });

  it.each(["stream", "request"])("keeps newer %s success when an older probe fails", async (source) => {
    let reject!: (error: Error) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((_resolve, fail) => { reject = fail; }));
    const pending = ensureFreshState();
    if (source === "stream") reportStreamState("open");
    else reportRequestOutcome("ok");
    reject(new TypeError("Failed to fetch"));
    expect(await pending).toBe(true);
    expect(getIsOnline()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses successful requests as reachability evidence and verifies network failures", async () => {
    reportRequestOutcome("ok");
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    reportRequestOutcome("network-error");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await ensureFreshState()).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rechecks a failed probe after expiry even if the stream has not reported its loss yet", async () => {
    reportStreamState("open");
    reportRequestOutcome("network-error");
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await ensureFreshState()).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes stale browser hints without directly setting offline", async () => {
    reportRequestOutcome("ok");
    await ensureFreshState();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(getIsOnline()).toBe(true);
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reset aborts an in-flight probe and prevents its result from leaking into the next test", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const pending = ensureFreshState();
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    resetConnectivityForTests();
    expect(signal.aborted).toBe(true);
    expect(await pending).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    resolve(new Response(null, { status: 200 }));
    await Promise.resolve();
    expect(getIsOnline()).toBeNull();
    expect(await ensureFreshState()).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
