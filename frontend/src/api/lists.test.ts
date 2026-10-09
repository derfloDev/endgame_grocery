import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchList } from "./lists";
import * as offlineStore from "./offlineStore";

describe("fetchList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("requests one list with the bearer token and caches it under list:<id>", async () => {
    const list = { id: "list-1", name: "Weekly", owner_id: "u1", owner_name: "Alex", is_owner: false };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ list }) });
    vi.stubGlobal("fetch", fetchMock);
    const write = vi.spyOn(offlineStore, "writeCachedResource").mockResolvedValue(undefined);

    const result = await fetchList("jwt", "list-1");

    expect(result).toEqual({ list });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/lists/list-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" })
      })
    );
    expect(write).toHaveBeenCalledWith("list:list-1", { list });
  });

  it("hands a cached value to onCachedValue while the request is pending", async () => {
    const cached = { list: { id: "list-1", name: "Cached title" } };
    vi.spyOn(offlineStore, "readCachedResource").mockResolvedValue(cached);
    vi.spyOn(offlineStore, "writeCachedResource").mockResolvedValue(undefined);
    let resolveFetch: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    );
    const onCachedValue = vi.fn();

    const pending = fetchList("jwt", "list-1", { onCachedValue });
    await vi.waitFor(() => expect(onCachedValue).toHaveBeenCalledWith(cached));
    resolveFetch({ ok: true, status: 200, json: async () => ({ list: { id: "list-1", name: "Fresh" } }) });

    await expect(pending).resolves.toEqual({ list: { id: "list-1", name: "Fresh" } });
  });

  it("falls back to the cached list when offline", async () => {
    const cached = { list: { id: "list-1", name: "Cached title" } };
    vi.spyOn(offlineStore, "readCachedResource").mockResolvedValue(cached);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchList("jwt", "list-1")).resolves.toEqual({ ...cached, offline: true });
  });
  it("falls back to the list from the overview cache when offline and the list itself was never cached", async () => {
    const overview = { lists: [{ id: "list-0", name: "Other" }, { id: "list-1", name: "From overview" }] };
    vi.spyOn(offlineStore, "readCachedResource").mockImplementation(async (key) => (key === "lists" ? overview : null));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(fetchList("jwt", "list-1")).resolves.toEqual({
      list: { id: "list-1", name: "From overview" },
      offline: true
    });
  });

  it("does not hide a 403 behind cached data", async () => {
    vi.spyOn(offlineStore, "readCachedResource").mockResolvedValue({ lists: [{ id: "list-1", name: "Stale" }] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: "You do not have access to this list." }) })
    );

    await expect(fetchList("jwt", "list-1")).rejects.toMatchObject({ status: 403 });
  });
});
