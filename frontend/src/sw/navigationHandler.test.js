import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNavigationHandler, NAVIGATION_NETWORK_TIMEOUT_MS, RECONNECT_PARAM } from "./navigationHandler.js";
import { RECONNECT_PARAM as APP_RECONNECT_PARAM } from "../api/reconnect";

let fallback, fetchImpl, setTimer, clearTimer, options;
beforeEach(() => {
  vi.useFakeTimers();
  fallback = vi.fn().mockResolvedValue(new Response("shell"));
  fetchImpl = vi.fn();
  setTimer = vi.fn(setTimeout);
  clearTimer = vi.fn(clearTimeout);
  options = { request: {}, url: new URL("https://grocery.example/lists/list-1") };
  // Navigation handling must never open or write a runtime cache.
  vi.stubGlobal("caches", new Proxy({}, { get() { throw new Error("Unexpected cache API use"); } }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function handle() {
  return createNavigationHandler({ fetchImpl, fallback, setTimer, clearTimer })(options);
}
function expectCleared() {
  expect(clearTimer).toHaveBeenCalledTimes(1);
  expect(clearTimer).toHaveBeenCalledWith(setTimer.mock.results[0].value);
  expect(vi.getTimerCount()).toBe(0);
}

describe("network-first navigations", () => {
  it("uses the same reconnect parameter as the app", () => {
    expect(RECONNECT_PARAM).toBe(APP_RECONNECT_PARAM);
  });
  it.each([200, 204, 302, 401, 403])("passes status %s through", async status => {
    const response = new Response(null, { status });
    fetchImpl.mockResolvedValue(response);
    expect(await handle()).toBe(response);
    expect(fetchImpl).toHaveBeenCalledWith(options.request);
    expect(fallback).not.toHaveBeenCalled();
    expectCleared();
  });
  it.each([
    { type: "opaqueredirect" },
    new Response(null, { status: 503, headers: { "cf-mitigated": "challenge" } })
  ])("passes redirects and challenges through", async response => {
    fetchImpl.mockResolvedValue(response);
    expect(await handle()).toBe(response);
    expect(fallback).not.toHaveBeenCalled();
    expectCleared();
  });
  it.each([500, 502, 522, 404])("falls back for status %s", async status => {
    fetchImpl.mockResolvedValue(new Response(null, { status }));
    expect(await (await handle()).text()).toBe("shell");
    expect(fallback).toHaveBeenCalledWith(options);
    expectCleared();
  });
  it("falls back on rejection", async () => {
    fetchImpl.mockRejectedValue(new TypeError("offline"));
    expect(await (await handle()).text()).toBe("shell");
    expectCleared();
  });
  it("falls back at 3000 ms and ignores a late response", async () => {
    let resolve;
    fetchImpl.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = handle();
    expect(NAVIGATION_NETWORK_TIMEOUT_MS).toBe(3000);
    await vi.advanceTimersByTimeAsync(2999);
    expect(fallback).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await pending).text()).toBe("shell");
    resolve(new Response("late login"));
    await vi.runAllTimersAsync();
    expect(fallback).toHaveBeenCalledTimes(1);
    expectCleared();
  });
  it("honors a configured timeout", async () => {
    fetchImpl.mockReturnValue(new Promise(() => {}));
    const pending = createNavigationHandler({ fetchImpl, fallback, timeoutMs: 10 })(options);
    await vi.advanceTimersByTimeAsync(10);
    expect(await (await pending).text()).toBe("shell");
  });
  it("waits without a timer when reconnect is present", async () => {
    options.url.searchParams.set(RECONNECT_PARAM, "");
    let resolve;
    fetchImpl.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = handle();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fallback).not.toHaveBeenCalled();
    const response = new Response("login");
    resolve(response);
    expect(await pending).toBe(response);
    expect(setTimer).not.toHaveBeenCalled();
    expect(clearTimer).not.toHaveBeenCalled();
  });
  it.each(["reject", 503])("still falls back during reconnect for %s", async failure => {
    options.url.searchParams.set(RECONNECT_PARAM, "1");
    if (failure === "reject") fetchImpl.mockRejectedValue(new TypeError("offline"));
    else fetchImpl.mockResolvedValue(new Response(null, { status: failure }));
    expect(await (await handle()).text()).toBe("shell");
    expect(setTimer).not.toHaveBeenCalled();
  });
  it("clears the timer even if fallback fails", async () => {
    fetchImpl.mockRejectedValue(new TypeError("offline"));
    fallback.mockRejectedValue(new Error("missing dev precache"));
    await expect(handle()).rejects.toThrow("missing dev precache");
    expect(fallback).toHaveBeenCalledTimes(1);
    expectCleared();
  });
});
