import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createInstance } from "i18next";
import type { i18n, ReadCallback } from "i18next";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import enTranslations from "../locales/en/translation.json";
import deTranslations from "../locales/de/translation.json";
import { createEntry, fetchEntries, updateEntry } from "../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../api/history";
import { fetchLists, markListViewed } from "../api/lists";
import { fetchListMembers, leaveList } from "../api/sharing";
import { writeCachedResource } from "../api/offlineStore";
import { useListEvents } from "../hooks/useListEvents";
import ListDetailPage from "./ListDetailPage/ListDetailPage";
import { useListDetailData } from "./ListDetailPage/useListDetailData";
import type { Entry, List, Suggestion } from "../types";
import { primeIconWorker } from "../workers/iconWorkerClient";

vi.mock("../workers/iconWorkerClient", () => ({
  primeIconWorker: vi.fn(),
  requestIconMatch: vi.fn().mockResolvedValue({ iconName: null, score: 0, topMatches: [] })
}));

const streamState = vi.hoisted(() => ({ resyncVersion: 0 }));
const queueState = vi.hoisted(() => ({ syncVersion: 0 }));
vi.mock("../context/EventSourceContext", () => ({ useEventSource: () => streamState }));
beforeEach(() => { streamState.resyncVersion = 0; queueState.syncVersion = 0; });

const cssSource = [
  "./ListDetailPage/ListDetailPage.module.css",
  "../styles/shared.css",
  "../components/RecentlyUsedSection/RecentlyUsedSection.module.css"
]
  .map((filePath) => readFileSync(path.resolve(import.meta.dirname, filePath), "utf8"))
  .join("\n");
const pageSource = readFileSync(path.resolve(import.meta.dirname, "./ListDetailPage/ListDetailPage.tsx"), "utf8");
const hookSource = readFileSync(path.resolve(import.meta.dirname, "./ListDetailPage/useListDetailData.ts"), "utf8");

vi.mock("../api/entries", () => ({
  createEntry: vi.fn(),
  fetchEntries: vi.fn(),
  updateEntry: vi.fn()
}));

vi.mock("../api/history", () => ({
  deleteFromHistory: vi.fn(),
  fetchRecentlyUsed: vi.fn()
}));

vi.mock("../api/lists", () => ({
  fetchLists: vi.fn(),
  markListViewed: vi.fn(),
  renameList: vi.fn()
}));

vi.mock("../api/sharing", () => ({
  fetchListMembers: vi.fn(),
  leaveList: vi.fn(),
  revokeListMember: vi.fn(),
  shareListWithMember: vi.fn()
}));

vi.mock("../api/offlineStore", () => ({
  writeCachedResource: vi.fn()
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ token: "test-token" })
}));

vi.mock("../hooks/useListEvents", () => ({
  useListEvents: vi.fn()
}));

vi.mock("../hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => queueState
}));

vi.mock("../hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({
    isReady: false,
    isSubscribed: false,
    isSupported: false,
    subscribe: vi.fn(),
    unsubscribe: vi.fn()
  })
}));

const createEntryMock = vi.mocked(createEntry);
const deleteFromHistoryMock = vi.mocked(deleteFromHistory);
const fetchEntriesMock = vi.mocked(fetchEntries);
const fetchRecentlyUsedMock = vi.mocked(fetchRecentlyUsed);
const fetchListsMock = vi.mocked(fetchLists);
const markListViewedMock = vi.mocked(markListViewed);
const fetchListMembersMock = vi.mocked(fetchListMembers);
const leaveListMock = vi.mocked(leaveList);
const useListEventsMock = vi.mocked(useListEvents);
const updateEntryMock = vi.mocked(updateEntry);
const writeCachedResourceMock = vi.mocked(writeCachedResource);

function renderListDetailPage(translations?: i18n) {
  const tree = () => (
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={["/lists/list-1"]}
    >
      <Routes>
        <Route element={<ListDetailPage />} path="/lists/:id" />
        <Route element={<div>Overview landing</div>} path="/" />
      </Routes>
    </MemoryRouter>
  );
  const translatedTree = () => translations
    ? <I18nextProvider i18n={translations}>{tree()}</I18nextProvider>
    : tree();
  const view = render(translatedTree());
  return { ...view, rerenderPage: () => view.rerender(translatedTree()) };
}

interface TestEntry extends Entry {
  created_at?: string;
}

interface TestSuggestion extends Suggestion {
  last_used_at?: string;
}

interface MockListDetailDataOptions {
  entries?: TestEntry[];
  history?: TestSuggestion[];
}

function mockListDetailData({ entries = [], history = [] }: MockListDetailDataOptions = {}) {
  fetchListsMock.mockResolvedValue({
    lists: [
      { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: false } as List
    ]
  });
  fetchEntriesMock.mockResolvedValue({ entries });
  fetchRecentlyUsedMock.mockResolvedValue({ history });
  fetchListMembersMock.mockResolvedValue({ members: [] });
  markListViewedMock.mockResolvedValue(undefined);
  writeCachedResourceMock.mockResolvedValue(undefined);
  deleteFromHistoryMock.mockResolvedValue(null);
}

function getOpenItemsSection() {
  const section = screen.getByText("OPEN ITEMS").closest("section");

  if (!section) {
    throw new Error("Expected open items section to exist.");
  }

  return section;
}

function createDeferred<T = unknown>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

describe("ListDetailPage cache-first loading", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  function pendingDetail() {
    mockListDetailData();
    const lists = createDeferred<Awaited<ReturnType<typeof fetchLists>>>();
    const entries = createDeferred<Awaited<ReturnType<typeof fetchEntries>>>();
    fetchListsMock.mockReturnValue(lists.promise);
    fetchEntriesMock.mockReturnValue(entries.promise);
    return { lists, entries };
  }

  async function deliverCache(entries: Entry[] = [{ id: "cached-1", text: "Cached Milk", status: "open" }]) {
    await act(async () => {
      fetchListsMock.mock.calls[0][1]?.onCachedValue?.({ lists: [{ id: "list-1", name: "Cached pantry", is_owner: true }] });
      fetchEntriesMock.mock.calls[0][2]?.onCachedValue?.({ entries });
    });
  }

  it("renders cached content without a spinner while the network is pending, then replaces it", async () => {
    const network = pendingDetail();
    renderListDetailPage();
    await deliverCache();
    expect(screen.getByText("Cached Milk")).toBeTruthy();
    expect(screen.getByText("Cached pantry")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(markListViewedMock).not.toHaveBeenCalled();
    expect(fetchListMembersMock).not.toHaveBeenCalled();
    await act(async () => {
      network.lists.resolve({ lists: [{ id: "list-1", name: "Fresh pantry", is_owner: true }] });
      network.entries.resolve({ entries: [{ id: "fresh-1", text: "Fresh Bread", status: "open" }] });
    });
    expect(screen.getByText("Fresh Bread")).toBeTruthy();
    expect(screen.getByText("Fresh pantry")).toBeTruthy();
    expect(screen.queryByText("Cached Milk")).toBeNull();
    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(fetchListsMock).toHaveBeenCalledTimes(1);
    expect(fetchEntriesMock).toHaveBeenCalledTimes(1);
    expect(markListViewedMock).toHaveBeenCalledTimes(1);
    expect(fetchListMembersMock).toHaveBeenCalledTimes(1);
    await deliverCache();
    expect(screen.queryByText("Cached Milk")).toBeNull();
    expect(screen.getByText("Fresh pantry")).toBeTruthy();
  });

  it("keeps the loading state on a cache miss until network data arrives", async () => {
    const network = pendingDetail();
    renderListDetailPage();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
    await act(async () => {
      network.lists.resolve({ lists: [{ id: "list-1", name: "Fresh pantry", is_owner: false }] });
      network.entries.resolve({ entries: [{ id: "fresh-1", text: "Fresh Bread", status: "open" }] });
    });
    expect(screen.getByText("Fresh Bread")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();
  });

  it("preserves cached pending entries and filters history when fresh entries replace the cache", async () => {
    const network = pendingDetail();
    fetchRecentlyUsedMock.mockResolvedValue({ history: [{ text: "Queued Bread" }, { text: "Eggs" }] });
    renderListDetailPage();
    const pending = { id: "temp-entry", text: "Queued Bread", status: "open" as const, is_pending_sync: true, details: "Whole wheat" };
    await deliverCache([pending]);
    expect(screen.getByText("Queued Bread")).toBeTruthy();
    await act(async () => {
      network.lists.resolve({ lists: [{ id: "list-1", name: "Fresh pantry", is_owner: false }] });
      network.entries.resolve({ entries: [{ id: "fresh-1", text: "Fresh Milk", status: "open" }] });
    });
    expect(within(getOpenItemsSection()).getByText("Queued Bread")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Whole wheat")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Queued")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Recently Used" })).queryByText("Queued Bread")).toBeNull();
    expect(screen.getByText("Eggs")).toBeTruthy();
  });

  it("keeps the Done badge when a cached entry is completed before the initial network read settles", async () => {
    const network = pendingDetail();
    const doneEntry = { id: "cached-1", text: "Cached Milk", status: "done" as const };
    updateEntryMock.mockResolvedValue({ entry: doneEntry });
    renderListDetailPage();
    await deliverCache();
    await userEvent.click(screen.getByRole("button", { name: "Mark Cached Milk done" }));
    await screen.findByText("Done");
    await act(async () => {
      network.lists.resolve({ lists: [{ id: "list-1", name: "Fresh pantry", is_owner: false }] });
      network.entries.resolve({ entries: [doneEntry] });
    });
    expect(screen.getByText("Done")).toBeTruthy();
    expect(within(getOpenItemsSection()).queryByText("Cached Milk")).toBeNull();
  });

  it("clears cached content on access denial and ignores cache callbacks after failure", async () => {
    const network = pendingDetail();
    renderListDetailPage();
    await deliverCache();
    expect(screen.getByText("Cached Milk")).toBeTruthy();
    await act(async () => {
      network.lists.resolve({ lists: [] });
      network.entries.resolve({ entries: [] });
    });
    expect(screen.getByText(enTranslations["detail.accessError"])).toBeTruthy();
    await deliverCache();
    expect(screen.queryByText("Cached Milk")).toBeNull();
    expect(screen.queryByText("Cached pantry")).toBeNull();
  });

  it("ignores the old load's cache and network results after a queue-sync reload", async () => {
    const oldNetwork = pendingDetail();
    const view = renderListDetailPage();
    await deliverCache();
    expect(screen.getByText("Cached Milk")).toBeTruthy();
    mockListDetailData({ entries: [{ id: "fresh-1", text: "Fresh Bread", status: "open" }] });
    queueState.syncVersion += 1;
    view.rerenderPage();
    await screen.findByText("Fresh Bread");
    await deliverCache();
    await act(async () => {
      oldNetwork.lists.resolve({ lists: [{ id: "list-1", name: "Old pantry", is_owner: true }] });
      oldNetwork.entries.resolve({ entries: [{ id: "old-1", text: "Old Bread", status: "open" }] });
    });
    expect(screen.getByText("Fresh Bread")).toBeTruthy();
    expect(screen.queryByText("Cached Milk")).toBeNull();
    expect(screen.queryByText("Old Bread")).toBeNull();
    expect(markListViewedMock).toHaveBeenCalledTimes(1);
  });

  it("does not merge another list's queued entries when the route changes", async () => {
    pendingDetail();
    const view = renderHook(({ listId }) => useListDetailData({ listId, token: "test-token", syncVersion: 0 }), {
      initialProps: { listId: "list-1" }
    });
    const pending = { id: "temp-entry", text: "First list only", status: "open" as const, is_pending_sync: true };
    await deliverCache([pending]);
    expect(view.result.current.entries).toEqual([pending]);
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-2", name: "Other list", is_owner: false }] });
    fetchEntriesMock.mockResolvedValue({ entries: [] });
    view.rerender({ listId: "list-2" });
    await waitFor(() => { expect(view.result.current.list?.id).toBe("list-2"); });
    expect(view.result.current.entries).toEqual([]);
  });
});

describe("ListDetailPage initial loading", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  function expectOneLoad() {
    for (const request of [fetchListsMock, fetchEntriesMock, fetchRecentlyUsedMock, fetchListMembersMock, markListViewedMock]) {
      expect(request).toHaveBeenCalledTimes(1);
    }
  }

  it("loads each endpoint once when language resources arrive after mount", async () => {
    const translations = createInstance();
    const backendRead = vi.fn<(language: string, namespace: string, callback: ReadCallback) => void>();
    translations.use({ type: "backend", read: backendRead });
    const initialized = translations.init({ lng: "en", fallbackLng: false, react: { useSuspense: false } });
    mockListDetailData({ entries: [{ id: "entry-1", text: "Milk", status: "open" }] });
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Weekly groceries", is_owner: true }] });
    renderListDetailPage(translations);
    await screen.findByText("Milk");
    expect(translations.t("detail.accessError")).toBe("detail.accessError");
    expectOneLoad();

    await waitFor(() => { expect(backendRead).toHaveBeenCalled(); });
    await act(async () => {
      backendRead.mock.calls[0][2](null, enTranslations);
      await initialized;
    });
    expect(screen.getByText("OPEN ITEMS")).toBeTruthy();
    expect(translations.t("detail.accessError")).toBe(enTranslations["detail.accessError"]);
    expectOneLoad();
  });

  it("renders entries while members are pending and keeps the sharing spinner until they arrive", async () => {
    mockListDetailData({ entries: [{ id: "entry-1", text: "Milk", status: "open" }] });
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Weekly groceries", is_owner: true }] });
    const members = createDeferred<Awaited<ReturnType<typeof fetchListMembers>>>();
    fetchListMembersMock.mockReturnValue(members.promise);
    renderListDetailPage();
    await screen.findByText("Milk");
    expect(screen.queryByLabelText("Loading")).toBeNull();
    expectOneLoad();
    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    await userEvent.click(screen.getByRole("button", { name: /Share list/ }));
    expect(screen.getByLabelText("Loading")).toBeTruthy();

    const member = { id: "member-1", user_id: "member-1", display_name: "Jane Doe", email: "jane@example.com" };
    await act(async () => {
      members.resolve({ members: [member] });
    });
    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
    expectOneLoad();
  });

  it("translates a missing-list error at render time without fetching again on language change", async () => {
    const translations = createInstance();
    await translations.init({ lng: "en", resources: { en: { translation: enTranslations }, de: { translation: deTranslations } } });
    mockListDetailData();
    fetchListsMock.mockResolvedValue({ lists: [] });
    renderListDetailPage(translations);
    await screen.findByText(enTranslations["detail.accessError"]);

    await act(async () => { await translations.changeLanguage("de"); });
    expect(screen.getByText(deTranslations["detail.accessError"])).toBeTruthy();
    expect(screen.queryByText(enTranslations["detail.accessError"])).toBeNull();
    expect(fetchListsMock).toHaveBeenCalledTimes(1);
    expect(fetchEntriesMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(1);
    expect(fetchListMembersMock).not.toHaveBeenCalled();
    expect(markListViewedMock).not.toHaveBeenCalled();
  });

  it("shows member-load errors without clearing entries or the list", async () => {
    mockListDetailData({ entries: [{ id: "entry-1", text: "Milk", status: "open" }] });
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Weekly groceries", is_owner: true }] });
    const members = createDeferred<Awaited<ReturnType<typeof fetchListMembers>>>();
    fetchListMembersMock.mockReturnValue(members.promise);
    renderListDetailPage();
    await waitFor(() => { expect(fetchListMembersMock).toHaveBeenCalledTimes(1); });
    await act(async () => { members.reject(new Error("Mitglieder konnten nicht geladen werden.")); });
    expect(screen.getByText("Mitglieder konnten nicht geladen werden.").closest(".eg-error-banner")).toBeTruthy();
    expect(screen.getByText("Milk")).toBeTruthy();
    expect(screen.getByText("Weekly groceries")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();
    expectOneLoad();
  });
});

describe("ListDetailPage resync", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(cleanup);

  it("does not warm the icon model while loading or after entries render", async () => {
    mockListDetailData();
    const request = createDeferred<Awaited<ReturnType<typeof fetchEntries>>>();
    fetchEntriesMock.mockReturnValue(request.promise);
    renderListDetailPage();
    expect(primeIconWorker).not.toHaveBeenCalled();

    await act(async () => {
      request.resolve({ entries: [{ id: "entry-1", text: "Milk", status: "open" }] });
    });
    await screen.findByText("Milk");
    expect(primeIconWorker).not.toHaveBeenCalled();
  });

  it("refreshes entries, history and members without clearing content or running the full loader", async () => {
    mockListDetailData({ entries: [{ id: "entry-1", text: "Milk", status: "open" }] });
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Weekly groceries", is_owner: true }] });
    const view = renderListDetailPage();
    await screen.findByText("Milk");
    expect(fetchEntriesMock).toHaveBeenCalledTimes(1);
    expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(1);
    expect(fetchListMembersMock).toHaveBeenCalledTimes(1);
    const request = createDeferred<Awaited<ReturnType<typeof fetchEntries>>>();
    fetchEntriesMock.mockReturnValueOnce(request.promise);
    fetchRecentlyUsedMock.mockResolvedValue({ history: [{ text: "Eggs" }] });
    const member = { id: "member-2", user_id: "member-2", display_name: "Jane Doe", email: "jane@example.com" };
    fetchListMembersMock.mockResolvedValue({ members: [member] });
    streamState.resyncVersion += 1;
    view.rerenderPage();
    expect(fetchEntriesMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Milk")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();
    await act(async () => { request.resolve({ entries: [{ id: "entry-2", text: "Bread", status: "open" }] }); });
    await screen.findByText("Bread");
    await screen.findByText("Eggs");
    await screen.findByTitle("Jane Doe");
    expect(screen.queryByText("Milk")).toBeNull();
    expect(fetchListsMock).toHaveBeenCalledTimes(1);
    expect(markListViewedMock).toHaveBeenCalledTimes(1);
    expect(fetchEntriesMock).toHaveBeenCalledTimes(2);
    expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(2);
    expect(fetchListMembersMock).toHaveBeenCalledTimes(2);
    view.rerenderPage();
    expect(fetchEntriesMock).toHaveBeenCalledTimes(2);
  });

  it.each(["resync", "SSE"])("keeps an entry queued during an in-flight %s reload", async (trigger) => {
    mockListDetailData({ history: [{ text: "Bread", icon: "IconBread", details: "Whole wheat" }, { text: "Eggs" }] });
    createEntryMock.mockResolvedValue({ queued: true } as Awaited<ReturnType<typeof createEntry>>);
    const view = renderListDetailPage();
    await screen.findByRole("button", { name: "Bread" });
    const request = createDeferred<Awaited<ReturnType<typeof fetchEntries>>>();
    fetchEntriesMock.mockReturnValueOnce(request.promise);
    if (trigger === "resync") {
      streamState.resyncVersion += 1;
      view.rerenderPage();
    } else {
      const handler = useListEventsMock.mock.calls.find(([type]) => type === "entry:created")![2];
      act(() => { handler({ listId: "list-1" }); });
    }
    expect(fetchEntriesMock).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole("button", { name: "Bread" }));
    await waitFor(() => { expect(within(getOpenItemsSection()).getByText("Queued")).toBeTruthy(); });
    await act(async () => { request.resolve({ entries: [{ id: "server-1", text: "Milk", status: "open" }] }); });
    await screen.findByText("Milk");
    await waitFor(() => { expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(2); });
    expect(within(getOpenItemsSection()).getByText("Bread")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Whole wheat")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Queued")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Recently Used" })).getByText("Eggs")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Recently Used" })).queryByText("Bread")).toBeNull();
  });
});

describe("ListDetailPage optimistic updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("removes a toggled entry from the open list before updateEntry resolves", async () => {
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        }
      ]
    });
    updateEntryMock.mockReturnValue(new Promise(() => {}));

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).queryByText("Milk")).toBeNull();
    });
    expect(updateEntry).toHaveBeenCalledWith("list-1", "entry-1", "test-token", { status: "done" });
  });

  it("shows a Done badge immediately when the current user completes an item", async () => {
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        }
      ]
    });
    updateEntryMock.mockReturnValue(new Promise(() => {}));

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).queryByText("Milk")).toBeNull();
      const recentlyUsedSection = screen.getByRole("region", { name: "Recently Used" });
      expect(within(recentlyUsedSection).getByText("Milk")).toBeTruthy();
      expect(within(recentlyUsedSection).getByText("Done")).toBeTruthy();
    });
  });

  it("preserves the Done badge after an SSE-triggered entry reload", async () => {
    fetchListsMock.mockResolvedValue({
      lists: [
        { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: false } as List
      ]
    });
    fetchEntriesMock
      .mockResolvedValueOnce({
        entries: [
          {
            id: "entry-1",
            text: "Milk",
            status: "open",
            icon: "IconMilk",
            created_at: "2026-04-21T00:00:00Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        entries: [
          {
            id: "entry-1",
            text: "Milk",
            status: "done",
            icon: "IconMilk",
            is_changed: false,
            created_at: "2026-04-21T00:00:00Z"
          }
        ]
      });
    fetchRecentlyUsedMock
      .mockResolvedValueOnce({ history: [] })
      .mockResolvedValueOnce({
        history: [{ text: "Milk", icon: "IconMilk" }]
      });
    fetchListMembersMock.mockResolvedValue({ members: [] });
    markListViewedMock.mockResolvedValue(undefined);
    writeCachedResourceMock.mockResolvedValue(undefined);
    updateEntryMock.mockResolvedValue({
      entry: {
        id: "entry-1",
        text: "Milk",
        status: "done",
        icon: "IconMilk",
        is_changed: false,
        created_at: "2026-04-21T00:00:00Z"
      } as Entry
    });

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      const recentlyUsedSection = screen.getByRole("region", { name: "Recently Used" });
      expect(within(recentlyUsedSection).getByText("Milk")).toBeTruthy();
      expect(within(recentlyUsedSection).getByText("Done")).toBeTruthy();
    });

    const entryUpdatedHandler = useListEventsMock.mock.calls.find(([eventType]) => eventType === "entry:updated")?.[2];

    if (!entryUpdatedHandler) {
      throw new Error("Expected entry:updated handler to be registered.");
    }

    entryUpdatedHandler({ listId: "list-1", entryId: "entry-1" });

    await waitFor(() => {
      expect(fetchEntries).toHaveBeenCalledTimes(2);
      expect(fetchRecentlyUsed).toHaveBeenCalledTimes(2);
      const recentlyUsedSection = screen.getByRole("region", { name: "Recently Used" });
      expect(within(recentlyUsedSection).getByText("Milk")).toBeTruthy();
      expect(within(recentlyUsedSection).getByText("Done")).toBeTruthy();
    });
  });

  it("reverts a toggled entry when updateEntry rejects", async () => {
    const updateRequest = createDeferred<Awaited<ReturnType<typeof updateEntry>>>();
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        }
      ]
    });
    updateEntryMock.mockReturnValue(updateRequest.promise);

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).queryByText("Milk")).toBeNull();
    });

    updateRequest.reject(new Error("Server error"));

    expect(await screen.findByText("Server error")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Milk")).toBeTruthy();
  });

  it("adds a temporary open entry immediately when reactivating from history", async () => {
    mockListDetailData({
      entries: [],
      history: [
        {
          text: "Bread",
          icon: "IconBread",
          last_used_at: "2026-04-21T00:00:00Z"
        }
      ]
    });
    createEntryMock.mockReturnValue(new Promise(() => {}));

    renderListDetailPage();

    expect(await screen.findByRole("region", { name: "Recently Used" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Bread" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).getByText("Bread")).toBeTruthy();
      expect(within(getOpenItemsSection()).getByText("Queued")).toBeTruthy();
    });
    expect(createEntry).toHaveBeenCalledWith(
      "list-1",
      "test-token",
      { text: "Bread", icon: "IconBread", details: "" },
      { tempId: expect.stringMatching(/^temp-entry-/) }
    );
  });

  it("preserves details when reactivating an entry from history", async () => {
    mockListDetailData({
      entries: [],
      history: [
        {
          text: "Tomatoes",
          icon: "IconSalad",
          details: "Cherry tomatoes",
          last_used_at: "2026-04-21T00:00:00Z"
        }
      ]
    });
    createEntryMock.mockReturnValue(new Promise(() => {}));

    renderListDetailPage();

    expect(await screen.findByRole("region", { name: "Recently Used" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Tomatoes" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).getByText("Tomatoes")).toBeTruthy();
      expect(within(getOpenItemsSection()).getByText("Cherry tomatoes")).toBeTruthy();
    });
    expect(createEntry).toHaveBeenCalledWith(
      "list-1",
      "test-token",
      { text: "Tomatoes", icon: "IconSalad", details: "Cherry tomatoes" },
      { tempId: expect.stringMatching(/^temp-entry-/) }
    );
  });

  it("renders open entries in the tile grid", async () => {
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        }
      ]
    });

    renderListDetailPage();

    expect(await screen.findByTestId("entry-tile-entry-1")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByTestId("entry-tile-grid")).toBeTruthy();
  });

  it("shows a search field above open entries", async () => {
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk"
        }
      ]
    });

    renderListDetailPage();

    expect(await screen.findByRole("searchbox", { name: "Search items…" })).toBeTruthy();
  });

  it("filters open entries by name case-insensitively", async () => {
    mockListDetailData({
      entries: [
        { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk" },
        { id: "entry-2", text: "Bread", status: "open", icon: "IconBread" }
      ]
    });

    renderListDetailPage();

    await userEvent.type(await screen.findByRole("searchbox", { name: "Search items…" }), "MIL");

    expect(within(getOpenItemsSection()).getByText("Milk")).toBeTruthy();
    expect(within(getOpenItemsSection()).queryByText("Bread")).toBeNull();
  });

  it("filters open entries by details", async () => {
    mockListDetailData({
      entries: [
        { id: "entry-1", text: "Tomatoes", details: "Cherry variety", status: "open", icon: "IconSalad" },
        { id: "entry-2", text: "Bread", details: "Whole grain", status: "open", icon: "IconBread" }
      ]
    });

    renderListDetailPage();

    await userEvent.type(await screen.findByRole("searchbox", { name: "Search items…" }), "cherry");

    expect(within(getOpenItemsSection()).getByText("Tomatoes")).toBeTruthy();
    expect(within(getOpenItemsSection()).queryByText("Bread")).toBeNull();
  });

  it("shows a search-specific empty state when no open entries match", async () => {
    mockListDetailData({
      entries: [{ id: "entry-1", text: "Milk", status: "open", icon: "IconMilk" }]
    });

    renderListDetailPage();

    await userEvent.type(await screen.findByRole("searchbox", { name: "Search items…" }), "bread");

    expect(within(getOpenItemsSection()).getByText("No matches")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("No items match your search.")).toBeTruthy();
    expect(within(getOpenItemsSection()).queryByText("All clear")).toBeNull();
  });

  it("shows all open entries again after clearing the search field", async () => {
    mockListDetailData({
      entries: [
        { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk" },
        { id: "entry-2", text: "Bread", status: "open", icon: "IconBread" }
      ]
    });

    renderListDetailPage();

    const searchField = await screen.findByRole("searchbox", { name: "Search items…" });
    await userEvent.type(searchField, "milk");
    expect(within(getOpenItemsSection()).queryByText("Bread")).toBeNull();

    await userEvent.clear(searchField);

    expect(within(getOpenItemsSection()).getByText("Milk")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("Bread")).toBeTruthy();
  });

  it("dismisses a recently used entry optimistically", async () => {
    mockListDetailData({
      entries: [],
      history: [
        {
          text: "Bread",
          icon: "IconBread",
          last_used_at: "2026-04-21T00:00:00Z"
        }
      ]
    });

    renderListDetailPage();

    const recentlyUsedSection = await screen.findByRole("region", { name: "Recently Used" });
    await userEvent.click(within(recentlyUsedSection).getByRole("button", { name: "Dismiss Bread" }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Recently Used" })).toBeNull();
    });
    expect(deleteFromHistory).toHaveBeenCalledWith("list-1", "Bread", "test-token");
  });

  it("renders changed entry badges and marks the list viewed", async () => {
    const markViewedRequest = createDeferred<void>();
    mockListDetailData({
      entries: [
        {
          id: "entry-1",
          text: "Milk",
          status: "open",
          icon: "IconMilk",
          is_changed: true,
          created_at: "2026-04-21T00:00:00Z",
          updated_at: "2026-04-21T00:00:00Z"
        },
        {
          id: "entry-2",
          text: "Bread",
          status: "done",
          icon: "IconBread",
          is_changed: true,
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-22T00:00:00Z"
        }
      ]
    });
    markListViewedMock.mockReturnValue(markViewedRequest.promise);

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    expect(within(getOpenItemsSection()).getByText("New")).toBeTruthy();
    expect(within(getOpenItemsSection()).queryByText("Bread")).toBeNull();
    const recentlyUsedSection = screen.getByRole("region", { name: "Recently Used" });
    expect(within(recentlyUsedSection).getByText("Bread")).toBeTruthy();
    expect(within(recentlyUsedSection).getByText("Done")).toBeTruthy();
    expect(markListViewed).toHaveBeenCalledWith("test-token", "list-1");

    await act(async () => {
      markViewedRequest.resolve();
      await markViewedRequest.promise;
    });

    expect(within(getOpenItemsSection()).getByText("New")).toBeTruthy();
    expect(within(recentlyUsedSection).getByText("Done")).toBeTruthy();
    expect(within(recentlyUsedSection).getByText("Bread")).toBeTruthy();
  });

  it("re-fetches recently used history when an entry update SSE event arrives", async () => {
    fetchListsMock.mockResolvedValue({
      lists: [
        { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: false } as List
      ]
    });
    fetchEntriesMock
      .mockResolvedValueOnce({
        entries: [
          {
            id: "entry-1",
            text: "Milk",
            status: "open",
            icon: "IconMilk",
            created_at: "2026-04-21T00:00:00Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        entries: [
          {
            id: "entry-1",
            text: "Milk",
            status: "done",
            icon: "IconMilk",
            created_at: "2026-04-21T00:00:00Z"
          }
        ]
      });
    fetchRecentlyUsedMock
      .mockResolvedValueOnce({ history: [] })
      .mockResolvedValueOnce({
        history: [{ text: "Milk", icon: "IconMilk" }]
      });
    fetchListMembersMock.mockResolvedValue({ members: [] });
    markListViewedMock.mockResolvedValue(undefined);
    writeCachedResourceMock.mockResolvedValue(undefined);

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    const entryUpdatedHandler = useListEventsMock.mock.calls.find(([eventType]) => eventType === "entry:updated")?.[2];

    if (!entryUpdatedHandler) {
      throw new Error("Expected entry:updated handler to be registered.");
    }

    entryUpdatedHandler({ listId: "list-1", entryId: "entry-1" });

    await waitFor(() => {
      expect(fetchRecentlyUsed).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("region", { name: "Recently Used" })).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: "Milk" })).toBeTruthy();
  });

  it("lets a shared member confirm leaving and returns to the overview", async () => {
    mockListDetailData();
    leaveListMock.mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderListDetailPage();

    await screen.findByText("Weekly groceries");
    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    await userEvent.click(screen.getByRole("button", { name: /Leave list/ }));

    await waitFor(() => {
      expect(leaveListMock).toHaveBeenCalledWith("list-1", "test-token");
      expect(screen.getByText("Overview landing")).toBeTruthy();
    });
    expect(window.confirm).toHaveBeenCalledWith("Leave this shared list?");
  });
});

describe("ListDetailPage layout styles", () => {
  it("stacks the owner chips and notifications button with a dedicated gap", () => {
    expect(cssSource).toMatch(
      /\.detail-meta\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--space-3\);/s
    );
  });

  it("defines owner-member badge styles for the detail meta area", () => {
    expect(cssSource).toMatch(
      /\.detail-member-badges\s*\{[^}]*display:\s*flex;[^}]*margin-left:\s*auto;[^}]*gap:\s*8px;[^}]*flex-wrap:\s*wrap;/s
    );
    expect(cssSource).toMatch(
      /\.eg-chip-member-initial\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*999px;/s
    );
  });

  it("renders member badges inside the owner chip row", () => {
    expect(pageSource).toMatch(
      /<div className="list-card-chips">[\s\S]*\{visibleMemberBadges\.length > 0 \? \([\s\S]*<div className=\{styles\["detail-member-badges"\]\}>/s
    );
  });

  it("defines the entry tile and recently used grid columns", () => {
    expect(cssSource).toMatch(
      /\.entry-tile-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\);/s
    );
    expect(cssSource).toMatch(
      /\.recently-used-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\);/s
    );
  });

  it("removes row delete wiring from the detail page", () => {
    expect(pageSource).toContain("EntryTile");
    expect(pageSource).not.toContain("handleDeleteEntry");
    expect(pageSource).not.toContain("deleteEntry");
  });

  it("keeps list detail data loading in a dedicated hook", () => {
    expect(pageSource.split(/\r?\n/).length).toBeLessThan(400);
    expect(pageSource).toContain('from "./useListDetailData"');
    expect(hookSource).toContain("export function useListDetailData");
    expect(hookSource).toContain("loadEntries");
    expect(hookSource).toContain("loadMembers");
  });
});
