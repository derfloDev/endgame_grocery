import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { createEntry, fetchEntries, updateEntry } from "../api/entries";
import { fetchRecentlyUsed } from "../api/history";
import { fetchLists, markListViewed } from "../api/lists";
import { fetchListMembers } from "../api/sharing";
import { writeCachedResource } from "../api/offlineStore";
import { useListEvents } from "../hooks/useListEvents";
import ListDetailPage from "./ListDetailPage/ListDetailPage";
import type { Entry, List, Suggestion } from "../types";

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
  fetchRecentlyUsed: vi.fn()
}));

vi.mock("../api/lists", () => ({
  fetchLists: vi.fn(),
  markListViewed: vi.fn(),
  renameList: vi.fn()
}));

vi.mock("../api/sharing", () => ({
  fetchListMembers: vi.fn(),
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
  useOfflineQueue: () => ({ syncVersion: 0 })
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
const fetchEntriesMock = vi.mocked(fetchEntries);
const fetchRecentlyUsedMock = vi.mocked(fetchRecentlyUsed);
const fetchListsMock = vi.mocked(fetchLists);
const markListViewedMock = vi.mocked(markListViewed);
const fetchListMembersMock = vi.mocked(fetchListMembers);
const useListEventsMock = vi.mocked(useListEvents);
const updateEntryMock = vi.mocked(updateEntry);
const writeCachedResourceMock = vi.mocked(writeCachedResource);

function renderListDetailPage() {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={["/lists/list-1"]}
    >
      <Routes>
        <Route element={<ListDetailPage />} path="/lists/:id" />
      </Routes>
    </MemoryRouter>
  );
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
    expect(screen.getByText("New")).toBeTruthy();
    expect(screen.getByText("Bread")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();
    expect(markListViewed).toHaveBeenCalledWith("test-token", "list-1");

    markViewedRequest.resolve();

    await waitFor(() => {
      expect(screen.queryByText("New")).toBeNull();
      expect(screen.queryByText("Done")).toBeNull();
      expect(screen.queryByText("Bread")).toBeNull();
    });
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
