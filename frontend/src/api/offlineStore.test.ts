import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeOfflineMutation, enqueueOfflineMutation, listOfflineMutations, resetOfflineStateForTests } from "./offlineStore";
import type { OfflineMutation } from "../types";

const mutation = (id: string, createdAt: string): OfflineMutation => ({ id, createdAt, url: "/api/lists", method: "POST", token: "token" });

describe("accepted queue mutations", () => {
  beforeEach(async () => { vi.stubGlobal("indexedDB", undefined); await resetOfflineStateForTests(); });
  afterEach(() => vi.unstubAllGlobals());

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
