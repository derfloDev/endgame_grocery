import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthExpiredError, sendJsonRequest } from "./client";
import { getIsOnline, reportRequestOutcome, resetConnectivityForTests } from "./connectivity";
import { enqueueOfflineMutation, readCachedResource, writeCachedResource } from "./offlineStore";
import { fetchEntries } from "./entries";
import { fetchLists } from "./lists";

vi.mock("./offlineStore", () => ({
  enqueueOfflineMutation: vi.fn(async () => undefined),
  readCachedResource: vi.fn(),
  writeCachedResource: vi.fn(async () => undefined)
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("cache-first reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readCachedResource).mockReset();
    vi.mocked(writeCachedResource).mockResolvedValue(undefined);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetConnectivityForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetConnectivityForTests();
  });

  it("delivers cached data while the network is pending, then returns the fresh response", async () => {
    const network = deferred<unknown>();
    const cached = { lists: [{ id: "cached" }] };
    const fresh = { lists: [{ id: "fresh" }] };
    const onCachedValue = vi.fn();
    vi.mocked(readCachedResource).mockResolvedValue(cached);
    fetchMock.mockReturnValue(network.promise);
    const pending = sendJsonRequest("/api/lists", { cacheKey: "lists", onCachedValue });
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.waitFor(() => { expect(onCachedValue).toHaveBeenCalledWith(cached); });
    network.resolve({ ok: true, status: 200, json: async () => fresh });
    expect(await pending).toEqual(fresh);
    expect(writeCachedResource).toHaveBeenCalledWith("lists", fresh);
    expect(onCachedValue).toHaveBeenCalledOnce();
  });

  it("never delivers a late cache read after a successful network response", async () => {
    const cache = deferred<unknown>();
    vi.mocked(readCachedResource).mockReturnValue(cache.promise);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ lists: [] }) });
    const onCachedValue = vi.fn();
    expect(await sendJsonRequest("/api/lists", { cacheKey: "lists", onCachedValue })).toEqual({ lists: [] });
    cache.resolve({ lists: [{ id: "stale" }] });
    await cache.promise;
    expect(readCachedResource).toHaveBeenCalledOnce();
    expect(onCachedValue).not.toHaveBeenCalled();
  });

  it("stops cache delivery as soon as the server responds, even while cache persistence is pending", async () => {
    const cache = deferred<unknown>();
    const write = deferred<void>();
    vi.mocked(readCachedResource).mockReturnValue(cache.promise);
    vi.mocked(writeCachedResource).mockReturnValueOnce(write.promise);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ lists: [] }) });
    const onCachedValue = vi.fn();
    const pending = sendJsonRequest("/api/lists", { cacheKey: "lists", onCachedValue });
    await vi.waitFor(() => { expect(writeCachedResource).toHaveBeenCalled(); });
    cache.resolve({ lists: [{ id: "stale" }] });
    await cache.promise;
    expect(onCachedValue).not.toHaveBeenCalled();
    write.resolve();
    await pending;
  });

  it.each([401, 403])("does not deliver cached data after HTTP %s rejects access", async (status) => {
    const cache = deferred<unknown>();
    vi.mocked(readCachedResource).mockReturnValue(cache.promise);
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({ error: "Denied" }) });
    const onCachedValue = vi.fn();
    await expect(sendJsonRequest("/api/lists", { token: "token", cacheKey: "lists", onCachedValue })).rejects.toThrow();
    cache.resolve({ lists: [{ id: "stale" }] });
    await cache.promise;
    expect(onCachedValue).not.toHaveBeenCalled();
  });

  it.each([null, "read-error"])("continues the network request when cache lookup yields %s", async (cached) => {
    if (cached === "read-error") vi.mocked(readCachedResource).mockRejectedValue(new Error("Cache unavailable"));
    else vi.mocked(readCachedResource).mockResolvedValue(cached);
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ lists: [] }) });
    const onCachedValue = vi.fn();
    expect(await sendJsonRequest("/api/lists", { cacheKey: "lists", onCachedValue })).toEqual({ lists: [] });
    expect(onCachedValue).not.toHaveBeenCalled();
  });

  it("keeps offline fallback and its offline marker with the callback enabled", async () => {
    vi.mocked(readCachedResource).mockResolvedValue({ lists: [{ id: "cached" }] });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sendJsonRequest("/api/lists", { cacheKey: "lists", onCachedValue: vi.fn() })).toEqual({ lists: [{ id: "cached" }], offline: true });
  });

  it("does not read the cache for ordinary online GETs or writes", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    await sendJsonRequest("/api/lists", { cacheKey: "lists" });
    await sendJsonRequest("/api/lists", { method: "POST", cacheKey: "lists", onCachedValue: vi.fn() });
    expect(readCachedResource).not.toHaveBeenCalled();
  });

  it("exposes cache-first reads through the list and entry APIs", async () => {
    const network = deferred<unknown>();
    fetchMock.mockReturnValue(network.promise);
    vi.mocked(readCachedResource).mockImplementation(async (key) => key === "lists" ? { lists: [] } : { entries: [] });
    const onLists = vi.fn();
    const onEntries = vi.fn();
    const requests = [fetchLists("token", { onCachedValue: onLists }), fetchEntries("list-1", "token", { onCachedValue: onEntries })];
    await vi.waitFor(() => {
      expect(onLists).toHaveBeenCalledWith({ lists: [] });
      expect(onEntries).toHaveBeenCalledWith({ entries: [] });
    });
    expect(readCachedResource).toHaveBeenCalledWith("lists");
    expect(readCachedResource).toHaveBeenCalledWith("entries:list-1");
    network.resolve({ ok: true, status: 200, json: async () => ({}) });
    await Promise.all(requests);
  });
});

describe("sendJsonRequest auth expiry handling", () => {
  beforeEach(() => {
    resetConnectivityForTests();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("dispatches auth:expired and throws AuthExpiredError for a 401 response with a token", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "jwt expired" })
    });

    await expect(sendJsonRequest("/api/lists", { token: "expired-token" })).rejects.toBeInstanceOf(
      AuthExpiredError
    );

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "auth:expired" }));
  });

  it("keeps unauthenticated 401 responses as normal request errors", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials." })
    });

    await expect(sendJsonRequest("/api/auth/login", { method: "POST" })).rejects.toThrow(
      "Invalid credentials."
    );

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "auth:expired" }));
  });

  it("does not dispatch auth:expired for 403 responses", async () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden." })
    });

    await expect(sendJsonRequest("/api/lists/list-1", { token: "valid-token" })).rejects.toThrow(
      "Forbidden."
    );

    expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "auth:expired" }));
  });
});

describe("request reachability reporting", () => {
  beforeEach(() => {
    resetConnectivityForTests();
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    resetConnectivityForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([200, 204, 404, 503])("reports HTTP %s as a reachable server", async (status) => {
    fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => ({}) });
    await sendJsonRequest("/api/lists").catch(() => undefined);
    expect(getIsOnline()).toBe(true);
  });

  it("reports network errors before returning cached reads", async () => {
    const connectivity = await import("./connectivity");
    const report = vi.spyOn(connectivity, "reportRequestOutcome");
    reportRequestOutcome("ok");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    vi.mocked(readCachedResource).mockResolvedValue({ lists: [] });
    expect(await sendJsonRequest("/api/lists", { cacheKey: "lists" })).toEqual({ lists: [], offline: true });
    expect(report).toHaveBeenLastCalledWith("network-error");
  });

  it("reports network errors while keeping the existing write queue fallback", async () => {
    const connectivity = await import("./connectivity");
    const report = vi.spyOn(connectivity, "reportRequestOutcome");
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await sendJsonRequest("/api/lists", { method: "POST", payload: { name: "Milk" }, queueable: true })).toEqual({ queued: true });
    expect(report).toHaveBeenCalledWith("network-error");
    expect(enqueueOfflineMutation).toHaveBeenCalledOnce();
  });
});

describe("request deadlines", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    resetConnectivityForTests();
    vi.mocked(readCachedResource).mockResolvedValue({ lists: [{ id: "cached" }] });
  });
  afterEach(() => {
    resetConnectivityForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("aborts a hanging read after ten seconds and returns cached data", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const pending = sendJsonRequest("/api/lists", { cacheKey: "lists" });
    const signal = fetchMock.mock.calls[0][1]!.signal!;
    await vi.advanceTimersByTimeAsync(9999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ lists: [{ id: "cached" }], offline: true });
    expect(signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("queues a timed-out write once and ignores a late response", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    const pending = sendJsonRequest("/api/lists", { method: "POST", payload: { name: "Milk" }, queueable: true, timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    expect(await pending).toEqual({ queued: true });
    resolve({ ok: true, status: 200, json: async () => ({}) });
    await Promise.resolve();
    expect(enqueueOfflineMutation).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["AbortError", "TimeoutError"])("treats %s as a network failure", async (name) => {
    fetchMock.mockRejectedValue(new DOMException("Request interrupted", name));
    expect(await sendJsonRequest("/api/lists", { cacheKey: "lists" })).toHaveProperty("offline", true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds response-body reads too", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => new Promise(() => {}) });
    const pending = sendJsonRequest("/api/lists", { cacheKey: "lists", timeoutMs: 25 });
    await vi.advanceTimersByTimeAsync(25);
    expect(await pending).toHaveProperty("offline", true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([200, 204, 401, 503])("clears deadlines after a fast HTTP %s response", async (status) => {
    fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => ({}) });
    await sendJsonRequest("/api/lists", { token: "token" }).catch(() => undefined);
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(false);
  });
});
