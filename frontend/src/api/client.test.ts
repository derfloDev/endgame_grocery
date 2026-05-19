import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthExpiredError, sendJsonRequest } from "./client";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<unknown>>();

describe("sendJsonRequest auth expiry handling", () => {
  beforeEach(() => {
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
