import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthExpiredError, sendJsonRequest } from "./client";
import { getIsOnline, reportRequestOutcome, resetConnectivityForTests } from "./connectivity";
import { enqueueOfflineMutation, readCachedResource } from "./offlineStore";

vi.mock("./offlineStore", () => ({
  enqueueOfflineMutation: vi.fn(async () => undefined),
  readCachedResource: vi.fn(),
  writeCachedResource: vi.fn(async () => undefined)
}));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>();

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
