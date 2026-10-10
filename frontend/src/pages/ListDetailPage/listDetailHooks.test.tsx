import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchEntries } from "../../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../../api/history";
import { fetchList, markListViewed } from "../../api/lists";
import { writeCachedResource } from "../../api/offlineStore";
import { createMembersCacheKey, fetchListMembers, revokeListMember, shareListWithMember } from "../../api/sharing";
import type { Entry, Member } from "../../types";
import { useActiveList } from "./useActiveList";
import { useListDetailData } from "./useListDetailData";
import { useListEntries } from "./useListEntries";
import { useListMembers } from "./useListMembers";
import { useRecentlyUsed } from "./useRecentlyUsed";

vi.mock("../../api/entries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/entries")>()),
  createEntry: vi.fn(),
  fetchEntries: vi.fn(),
  updateEntry: vi.fn()
}));
vi.mock("../../api/history", () => ({ deleteFromHistory: vi.fn(), fetchRecentlyUsed: vi.fn() }));
vi.mock("../../api/lists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/lists")>()),
  fetchList: vi.fn(),
  markListViewed: vi.fn(),
  renameList: vi.fn()
}));
vi.mock("../../api/offlineStore", () => ({
  listOfflineMutations: vi.fn(async () => []),
  writeCachedResource: vi.fn(async () => undefined)
}));
vi.mock("../../api/sharing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/sharing")>()),
  fetchListMembers: vi.fn(),
  revokeListMember: vi.fn(),
  shareListWithMember: vi.fn()
}));

const fetchEntriesMock = vi.mocked(fetchEntries);
const fetchRecentlyUsedMock = vi.mocked(fetchRecentlyUsed);
const deleteFromHistoryMock = vi.mocked(deleteFromHistory);
const fetchListMock = vi.mocked(fetchList);
const markListViewedMock = vi.mocked(markListViewed);
const fetchListMembersMock = vi.mocked(fetchListMembers);
const revokeListMemberMock = vi.mocked(revokeListMember);
const shareListWithMemberMock = vi.mocked(shareListWithMember);
const writeCachedResourceMock = vi.mocked(writeCachedResource);

const owner: Member = { user_id: "user-1", display_name: "Owner", email: "owner@example.com", is_owner: true };
const guest: Member = { user_id: "user-2", display_name: "Guest", email: "guest@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
  fetchEntriesMock.mockResolvedValue({ entries: [] });
  fetchRecentlyUsedMock.mockResolvedValue({ history: [] });
  fetchListMock.mockResolvedValue({ list: { id: "list-1", name: "Weekly", is_owner: true } });
  fetchListMembersMock.mockResolvedValue({ members: [owner, guest] });
  markListViewedMock.mockResolvedValue(undefined);
  deleteFromHistoryMock.mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
});

const settersIn = (value: object) => Object.keys(value).filter((key) => /^set[A-Z]/.test(key));

describe("no hook hands out raw state setters", () => {
  it("useListDetailData exposes state and commands only", async () => {
    const view = renderHook(() => useListDetailData({ listId: "list-1", token: "t", syncVersion: 0 }));
    await waitFor(() => { expect(view.result.current.isLoading).toBe(false); });

    expect(settersIn(view.result.current)).toEqual([]);
    for (const command of ["addEntry", "toggleEntry", "editEntry", "renameList", "revokeMember", "shareWithMember", "refreshList", "resync"]) {
      expect(view.result.current).toHaveProperty(command);
      expect(typeof view.result.current[command as keyof typeof view.result.current]).toBe("function");
    }
  });

  it("the focused hooks expose commands only", async () => {
    const active = renderHook(() => useActiveList("list-1")).result.current;
    const members = renderHook(() => useListMembers({ active, listId: "list-1", reportError: vi.fn(), token: "t" }));
    const recent = renderHook(() => useRecentlyUsed({ active, getEntries: () => [], listId: "list-1", token: "t" }));
    const entries = renderHook(() =>
      useListEntries({ active, clearError: vi.fn(), history: recent.result.current.commands, listId: "list-1", reportError: vi.fn(), token: "t" })
    );

    expect(settersIn(members.result.current)).toEqual([]);
    expect(settersIn(recent.result.current)).toEqual([]);
    expect(settersIn(recent.result.current.commands)).toEqual([]);
    expect(settersIn(entries.result.current)).toEqual([]);
  });
});

describe("useListDetailData errors", () => {
  it("reports a missing list as an access error that is translated when rendered", async () => {
    fetchListMock.mockRejectedValue(Object.assign(new Error("Forbidden"), { name: "ApiError", status: 403, code: "list.forbidden" }));
    const { ApiError } = await import("../../api/errors");
    fetchListMock.mockRejectedValue(new ApiError("Forbidden", 403, "list.forbidden"));

    const view = renderHook(() => useListDetailData({ listId: "list-1", token: "t", syncVersion: 0 }));

    await waitFor(() => { expect(view.result.current.isLoading).toBe(false); });
    expect(view.result.current.error).toEqual({ kind: "access", message: "detail.accessError" });
    expect(view.result.current.list).toBeNull();
  });

  it("reports other load failures as typed request errors", async () => {
    const { ApiError } = await import("../../api/errors");
    fetchEntriesMock.mockRejectedValue(new ApiError("Database busy", 503, "server.unavailable"));

    const view = renderHook(() => useListDetailData({ listId: "list-1", token: "t", syncVersion: 0 }));

    await waitFor(() => { expect(view.result.current.error).toEqual({ kind: "request", code: "server.unavailable", message: "Database busy" }); });
  });

  it("reportError and clearError drive the error state", async () => {
    const view = renderHook(() => useListDetailData({ listId: "list-1", token: "t", syncVersion: 0 }));
    await waitFor(() => { expect(view.result.current.isLoading).toBe(false); });

    act(() => { view.result.current.reportError(new Error("Push failed")); });
    expect(view.result.current.error).toEqual({ kind: "request", message: "Push failed" });

    act(() => { view.result.current.clearError(); });
    expect(view.result.current.error).toBeNull();
  });
});

describe("useListMembers", () => {
  function setup(reportError = vi.fn()) {
    const active = renderHook(() => useActiveList("list-1")).result.current;
    const view = renderHook(() => useListMembers({ active, listId: "list-1", reportError, token: "t" }));
    return { view, reportError };
  }

  it("loads members for an owner and nothing for anyone else", async () => {
    const { view } = setup();

    await act(async () => { await view.result.current.loadMembers({ isOwner: false }); });
    expect(fetchListMembersMock).not.toHaveBeenCalled();
    expect(view.result.current.members).toEqual([]);

    await act(async () => { await view.result.current.loadMembers({ isOwner: true }); });
    expect(view.result.current.members).toEqual([owner, guest]);
    expect(view.result.current.isSharingLoading).toBe(false);
  });

  it("revokes a member on the server, then in the list and in the offline cache", async () => {
    const { view } = setup();
    await act(async () => { await view.result.current.loadMembers({ isOwner: true }); });
    revokeListMemberMock.mockResolvedValue(null);

    await act(async () => { await view.result.current.revokeMember("user-2"); });

    expect(revokeListMemberMock).toHaveBeenCalledWith("list-1", "user-2", "t");
    expect(view.result.current.members).toEqual([owner]);
    expect(writeCachedResourceMock).toHaveBeenCalledWith(createMembersCacheKey("list-1"), { members: [owner] });
  });

  it("keeps the members when revoking fails and lets the caller handle the error", async () => {
    const { view } = setup();
    await act(async () => { await view.result.current.loadMembers({ isOwner: true }); });
    revokeListMemberMock.mockRejectedValue(new Error("Only the owner can do that."));

    await expect(act(async () => { await view.result.current.revokeMember("user-2"); })).rejects.toThrow("Only the owner");

    expect(view.result.current.members).toEqual([owner, guest]);
  });

  it("passes the invitation through to the sharing API", async () => {
    const { view } = setup();
    shareListWithMemberMock.mockResolvedValue({ invite: { invited_email: "new@example.com" } });

    await expect(view.result.current.shareWithMember("new@example.com")).resolves.toEqual({ invite: { invited_email: "new@example.com" } });
    expect(shareListWithMemberMock).toHaveBeenCalledWith("list-1", "t", { email: "new@example.com" });
  });

  it("reports a failed load instead of throwing", async () => {
    const { view, reportError } = setup();
    fetchListMembersMock.mockRejectedValue(new Error("offline"));

    await act(async () => { await view.result.current.loadMembers({ isOwner: true }); });

    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ message: "offline" }));
    expect(view.result.current.isSharingLoading).toBe(false);
  });
});

describe("useRecentlyUsed", () => {
  const entry = (id: string, text: string, status: Entry["status"] = "open"): Entry => ({ id, text, status });

  function setup(entries: Entry[] = []) {
    const active = renderHook(() => useActiveList("list-1")).result.current;
    const view = renderHook(() => useRecentlyUsed({ active, getEntries: () => entries, listId: "list-1", token: "t" }));
    return view;
  }

  it("hides history items that are open entries again", async () => {
    fetchRecentlyUsedMock.mockResolvedValue({ history: [{ text: "Milk" }, { text: "Eggs" }] });
    const view = setup([entry("e1", "Milk")]);

    await act(async () => { await view.result.current.commands.reload(); });

    expect(view.result.current.items.map((item) => item.text)).toEqual(["Eggs"]);
  });

  it("removes a dismissed item and tells the server", async () => {
    const view = setup();
    act(() => { view.result.current.commands.replaceFromServer([{ text: "Milk" }, { text: "Eggs" }], []); });

    act(() => { view.result.current.commands.dismiss("Milk"); });

    expect(view.result.current.items.map((item) => item.text)).toEqual(["Eggs"]);
    expect(deleteFromHistoryMock).toHaveBeenCalledWith("list-1", "Milk", "t");
  });

  it("puts a reserved item back when re-adding it failed, but not twice", () => {
    const view = setup();
    act(() => { view.result.current.commands.replaceFromServer([{ text: "Milk" }, { text: "Eggs" }], []); });

    let restore = () => {};
    act(() => { restore = view.result.current.commands.reserve("Milk"); });
    expect(view.result.current.items.map((item) => item.text)).toEqual(["Eggs"]);

    act(() => { restore(); restore(); });
    expect(view.result.current.items.map((item) => item.text)).toEqual(["Milk", "Eggs"]);
  });

  it("shows a completed entry as a suggestion and takes it back", () => {
    const view = setup();

    act(() => { view.result.current.commands.markCompleted(entry("e1", "Bread", "done")); });
    expect(view.result.current.items.map((item) => item.text)).toEqual(["Bread"]);

    act(() => { view.result.current.commands.unmarkCompleted("Bread"); });
    expect(view.result.current.items).toEqual([]);
  });

  it("reloads once after a burst of scheduled reloads", async () => {
    const view = setup();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    act(() => {
      view.result.current.commands.scheduleReload();
      view.result.current.commands.scheduleReload();
      view.result.current.commands.scheduleReload();
    });
    expect(fetchRecentlyUsedMock).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(250); });

    expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(1);
  });

  it("drops a pending reload when it unmounts", () => {
    const view = setup();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    act(() => { view.result.current.commands.scheduleReload(); });

    view.unmount();
    vi.advanceTimersByTime(1000);

    expect(fetchRecentlyUsedMock).not.toHaveBeenCalled();
  });
});

describe("useActiveList", () => {
  it("knows the current list and the mount state", () => {
    const view = renderHook(({ listId }) => useActiveList(listId), { initialProps: { listId: "list-1" } });
    const active = view.result.current;

    expect(active.isMounted()).toBe(true);
    expect(active.isCurrent("list-1")).toBe(true);
    view.rerender({ listId: "list-2" });
    expect(active.isCurrent("list-1")).toBe(false);
    expect(active.isCurrent("list-2")).toBe(true);
    view.unmount();
    expect(active.isMounted()).toBe(false);
  });
});
