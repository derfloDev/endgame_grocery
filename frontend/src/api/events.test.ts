import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchEventTicket } from "./events";
import { AuthExpiredError } from "./client";

function respond(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("fetchEventTicket", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("POSTs with the bearer token and returns the ticket", async () => {
    const fetchMock = vi.fn(() => respond(200, { ticket: "ticket-abc" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEventTicket("jwt-123")).resolves.toBe("ticket-abc");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/events/ticket");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-123");
  });

  it("dispatches auth:expired and throws AuthExpiredError on 401", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond(401, { error: "Authentication token is invalid." })));
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    await expect(fetchEventTicket("jwt-123")).rejects.toBeInstanceOf(AuthExpiredError);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "auth:expired" }));
  });

  it("rejects when the response has no ticket", async () => {
    vi.stubGlobal("fetch", vi.fn(() => respond(200, {})));

    await expect(fetchEventTicket("jwt-123")).rejects.toThrow(/ticket/i);
  });
});
