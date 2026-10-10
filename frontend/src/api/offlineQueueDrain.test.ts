import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthSessionForTests, setAuthSession } from "./authSession";
import { drainOfflineQueue, replaceTemporaryIds } from "./offlineQueueDrain";
import type { AcceptedMutations } from "./offlineQueueDrain";
import { enqueueOfflineMutation, listOfflineMutations, resetOfflineStateForTests } from "./offlineStore";
import type { OfflineMutation } from "../types";
import { createFetchRoutes } from "../test/fetchRoutes";

const routes = createFetchRoutes();
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

let sequence = 0;
function queued(overrides: Partial<OfflineMutation> & Pick<OfflineMutation, "url" | "method">): OfflineMutation {
  sequence += 1;
  return {
    id: `m${sequence}`,
    createdAt: `2026-01-01T00:00:${String(sequence).padStart(2, "0")}Z`,
    userId: "user-1",
    ...overrides
  };
}

async function drain(accepted: AcceptedMutations = new Map()) {
  return drainOfflineQueue(new AbortController().signal, 1000, accepted);
}

describe("drainOfflineQueue", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    routes.reset();
    sequence = 0;
    setAuthSession("current-jwt", "user-1");
    await resetOfflineStateForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthSessionForTests();
    routes.assertAllMatched();
  });

  const sentRequests = () => fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init as RequestInit }));

  describe("authentication", () => {
    it("sends the token that is current when draining, not one stored with the mutation", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "A" }, token: "stale-stored-jwt" }));
      fetchMock.mockResolvedValue(jsonResponse(200, {}));

      await drain();

      expect((sentRequests()[0].init.headers as Record<string, string>).Authorization).toBe("Bearer current-jwt");
    });

    it("pauses on a 401, keeps every mutation and sends nothing further", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "A" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "B" } }));
      fetchMock.mockResolvedValue(jsonResponse(401, { error: "Authentication token is invalid." }));

      const result = await drain();

      expect(result).toEqual({ count: 0, authExpired: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect((await listOfflineMutations()).map((mutation) => mutation.payload)).toEqual([{ name: "A" }, { name: "B" }]);
    });

    it("pauses without a request when there is no session token", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST" }));
      setAuthSession("", "user-1");

      const result = await drain();

      expect(result).toEqual({ count: 0, authExpired: true });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("keeps counting what was accepted before the 401", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "A" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "B" } }));
      routes.on("POST", "/api/lists", (_input, init) => jsonResponse(JSON.parse(String(init.body)).name === "A" ? 200 : 401, {}));
      fetchMock.mockImplementation(routes.fetch);

      const result = await drain();

      expect(result).toEqual({ count: 1, authExpired: true });
      expect((await listOfflineMutations()).map((mutation) => mutation.payload)).toEqual([{ name: "B" }]);
    });

    it("still reports other client errors as failed mutations that need a discard", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: {} }));
      fetchMock.mockResolvedValue(jsonResponse(422, { error: "Name is required." }));

      const result = await drain();

      expect(result.failed).toEqual({ id: "m1", error: "Name is required." });
      expect(result.authExpired).toBeUndefined();
    });

    it("passes the server's error code along so the banner can translate it", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: {} }));
      fetchMock.mockResolvedValue(jsonResponse(400, { error: "List name is required.", code: "validation.list_name_required" }));

      const result = await drain();

      expect(result.failed).toEqual({
        id: "m1",
        error: "List name is required.",
        apiCode: "validation.list_name_required"
      });
    });
  });

  describe("user scoping", () => {
    it("never replays the mutations of another user", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "mine" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "theirs" }, userId: "user-2" }));
      fetchMock.mockResolvedValue(jsonResponse(200, {}));

      const result = await drain();

      expect(result.count).toBe(1);
      expect(sentRequests().map((request) => request.init.body)).toEqual([JSON.stringify({ name: "mine" })]);
      setAuthSession("jwt-2", "user-2");
      expect((await listOfflineMutations()).map((mutation) => mutation.payload)).toEqual([{ name: "theirs" }]);
    });
  });

  describe("temporary ids", () => {
    it("resolves temp-1 and temp-10 independently", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "one" }, queueMeta: { resourceType: "list", tempId: "temp-1" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: { name: "ten" }, queueMeta: { resourceType: "list", tempId: "temp-10" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists/temp-10/entries", method: "POST", payload: { text: "for ten", listId: "temp-10" } }));
      await enqueueOfflineMutation(queued({ url: "/api/lists/temp-1/entries", method: "POST", payload: { text: "for one", listId: "temp-1" } }));
      routes.on("POST", "/api/lists", (_input, init) => jsonResponse(201, {
        list: { id: JSON.parse(String(init.body)).name === "one" ? "real-A" : "real-B" }
      }));
      routes.on("POST", "/api/lists/real-A/entries", () => jsonResponse(201, {}));
      routes.on("POST", "/api/lists/real-B/entries", () => jsonResponse(201, {}));
      fetchMock.mockImplementation(routes.fetch);

      const result = await drain();

      expect(result.failed).toBeUndefined();
      const [, , third, fourth] = sentRequests();
      expect(third.url).toBe("/api/lists/real-B/entries");
      expect(JSON.parse(third.init.body as string)).toEqual({ text: "for ten", listId: "real-B" });
      expect(fourth.url).toBe("/api/lists/real-A/entries");
      expect(JSON.parse(fourth.init.body as string)).toEqual({ text: "for one", listId: "real-A" });
      expect(result.resolvedIds).toEqual({ "temp-1": "real-A", "temp-10": "real-B" });
    });

    it("fails a mutation that still points at an unresolved temporary id, without sending it", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists/temp-list-1700000000000-abc123/entries", method: "POST", payload: { text: "orphan" } }));

      const result = await drain();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.failed).toMatchObject({ id: "m1", code: "dependency" });
      expect(result.failed?.error).toMatch(/discarded/i);
      expect((await listOfflineMutations()).map((mutation) => mutation.id)).toEqual(["m1"]);
    });

    it("also catches an unresolved temporary id inside the payload", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists/real-list/entries/abc", method: "PATCH", payload: { entryId: "temp-entry-1700000000000-xyz789" } }));

      const result = await drain();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.failed?.code).toBe("dependency");
    });

    it("sends free text that merely looks like the start of a temporary id", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists/real-list/entries", method: "POST", payload: { text: "temp-probe", details: "temp-1 spare" } }));
      fetchMock.mockResolvedValue(jsonResponse(201, {}));

      const result = await drain();

      expect(result.failed).toBeUndefined();
      expect(JSON.parse(sentRequests()[0].init.body as string)).toEqual({ text: "temp-probe", details: "temp-1 spare" });
    });

    it("reports every id resolved by this drain", async () => {
      await enqueueOfflineMutation(queued({ url: "/api/lists", method: "POST", payload: {}, queueMeta: { resourceType: "list", tempId: "temp-list-1" } }));
      fetchMock.mockResolvedValue(jsonResponse(201, { list: { id: "real-list" } }));

      const result = await drain();

      expect(result).toEqual({ count: 1, resolvedIds: { "temp-list-1": "real-list" } });
    });
  });
});

describe("replaceTemporaryIds", () => {
  const ids = { "temp-1": "real-1", "temp-10": "real-10" };

  it("replaces whole path segments only", () => {
    expect(replaceTemporaryIds("/api/lists/temp-1/entries/temp-10", ids)).toBe("/api/lists/real-1/entries/real-10");
    expect(replaceTemporaryIds("/api/lists/temp-100/entries", ids)).toBe("/api/lists/temp-100/entries");
    expect(replaceTemporaryIds("/api/lists/xtemp-1/entries", ids)).toBe("/api/lists/xtemp-1/entries");
  });

  it("replaces whole string values only, at any depth", () => {
    expect(replaceTemporaryIds({ listId: "temp-1", note: "buy temp-1 later", nested: [{ id: "temp-10" }] }, ids)).toEqual({
      listId: "real-1",
      note: "buy temp-1 later",
      nested: [{ id: "real-10" }]
    });
  });

  it("leaves non-strings alone", () => {
    expect(replaceTemporaryIds({ count: 1, flag: true, none: null }, ids)).toEqual({ count: 1, flag: true, none: null });
  });
});
