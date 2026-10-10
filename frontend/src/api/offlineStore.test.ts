import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAuthSessionForTests, setAuthSession } from "./authSession";
import {
  clearCachedResources,
  completeOfflineMutation,
  enqueueOfflineMutation,
  listOfflineMutations,
  readCachedResource,
  resetOfflineStateForTests,
  writeCachedResource
} from "./offlineStore";
import type { OfflineMutation } from "../types";

const mutation = (id: string, createdAt: string, userId = "user-1"): OfflineMutation => ({
  id,
  createdAt,
  url: "/api/lists",
  method: "POST",
  userId
});

describe("accepted queue mutations", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    setAuthSession("jwt-1", "user-1");
    await resetOfflineStateForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthSessionForTests();
  });

  it("removes the accepted mutation and keeps its ID mappings on every remaining mutation", async () => {
    await enqueueOfflineMutation(mutation("parent", "2026-01-01T00:00:00Z"));
    await enqueueOfflineMutation(mutation("third", "2026-01-01T00:00:02Z"));
    await enqueueOfflineMutation(mutation("child", "2026-01-01T00:00:01Z"));
    await completeOfflineMutation("parent", { "temp-list": "real-list" });
    expect(await listOfflineMutations()).toEqual([
      { ...mutation("child", "2026-01-01T00:00:01Z"), resolvedIds: { "temp-list": "real-list" } },
      { ...mutation("third", "2026-01-01T00:00:02Z"), resolvedIds: { "temp-list": "real-list" } }
    ]);
    await completeOfflineMutation("child", { "temp-entry": "real-entry" });
    expect((await listOfflineMutations())[0].resolvedIds).toEqual({ "temp-list": "real-list", "temp-entry": "real-entry" });
  });
});

describe("per-user queue scoping", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    setAuthSession("jwt-1", "user-1");
    await resetOfflineStateForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthSessionForTests();
  });

  it("stamps the signed-in user on a mutation that has no owner yet", async () => {
    await enqueueOfflineMutation({ id: "a", createdAt: "2026-01-01T00:00:00Z", url: "/api/lists", method: "POST" });

    expect(await listOfflineMutations()).toEqual([
      { id: "a", createdAt: "2026-01-01T00:00:00Z", url: "/api/lists", method: "POST", userId: "user-1" }
    ]);
  });

  it("only lists the mutations of the signed-in user", async () => {
    await enqueueOfflineMutation(mutation("mine", "2026-01-01T00:00:00Z", "user-1"));
    await enqueueOfflineMutation(mutation("theirs", "2026-01-01T00:00:01Z", "user-2"));

    expect((await listOfflineMutations()).map((entry) => entry.id)).toEqual(["mine"]);

    setAuthSession("jwt-2", "user-2");
    expect((await listOfflineMutations()).map((entry) => entry.id)).toEqual(["theirs"]);

    setAuthSession("", "");
    expect(await listOfflineMutations()).toEqual([]);
  });

  it("carries resolved IDs only to the mutations of the same user", async () => {
    await enqueueOfflineMutation(mutation("parent", "2026-01-01T00:00:00Z", "user-1"));
    await enqueueOfflineMutation(mutation("child", "2026-01-01T00:00:01Z", "user-1"));
    await enqueueOfflineMutation(mutation("other", "2026-01-01T00:00:02Z", "user-2"));

    await completeOfflineMutation("parent", { "temp-1": "real-1" });

    expect((await listOfflineMutations())[0].resolvedIds).toEqual({ "temp-1": "real-1" });
    setAuthSession("jwt-2", "user-2");
    expect((await listOfflineMutations())[0].resolvedIds).toBeUndefined();
  });
});

describe("per-user read cache", () => {
  beforeEach(async () => {
    vi.stubGlobal("indexedDB", undefined);
    setAuthSession("jwt-1", "user-1");
    await resetOfflineStateForTests();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAuthSessionForTests();
  });

  it("keeps the cached resources of every user apart", async () => {
    await writeCachedResource("lists", { lists: [{ id: "a" }] });

    setAuthSession("jwt-2", "user-2");
    expect(await readCachedResource("lists")).toBeNull();
    await writeCachedResource("lists", { lists: [{ id: "b" }] });

    setAuthSession("jwt-1", "user-1");
    expect(await readCachedResource("lists")).toEqual({ lists: [{ id: "a" }] });
  });

  it("serves nothing to a signed-out visitor", async () => {
    await writeCachedResource("lists", { lists: [{ id: "a" }] });

    setAuthSession("", "");

    expect(await readCachedResource("lists")).toBeNull();
  });

  it("clears the cache of every user on demand", async () => {
    await writeCachedResource("lists", { lists: [{ id: "a" }] });
    setAuthSession("jwt-2", "user-2");
    await writeCachedResource("lists", { lists: [{ id: "b" }] });

    await clearCachedResources();

    expect(await readCachedResource("lists")).toBeNull();
    setAuthSession("jwt-1", "user-1");
    expect(await readCachedResource("lists")).toBeNull();
  });

  it("keeps queued mutations when the cache is cleared", async () => {
    await enqueueOfflineMutation(mutation("keep", "2026-01-01T00:00:00Z"));

    await clearCachedResources();

    expect((await listOfflineMutations()).map((entry) => entry.id)).toEqual(["keep"]);
  });
});
