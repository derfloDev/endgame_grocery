import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import { createEntry, fetchEntries, updateEntry } from "../api/entries";
import { fetchRecentlyUsed } from "../api/history";
import { fetchLists } from "../api/lists";
import { fetchListMembers } from "../api/sharing";
import { writeCachedResource } from "../api/offlineStore";
import ListDetailPage from "./ListDetailPage";

const cssSource = readFileSync(path.resolve(import.meta.dirname, "../index.css"), "utf8");
const pageSource = readFileSync(path.resolve(import.meta.dirname, "./ListDetailPage.jsx"), "utf8");

vi.mock("../api/entries", () => ({
  createEntry: vi.fn(),
  deleteEntry: vi.fn(),
  fetchEntries: vi.fn(),
  updateEntry: vi.fn()
}));

vi.mock("../api/history", () => ({
  deleteFromHistory: vi.fn(),
  fetchRecentlyUsed: vi.fn()
}));

vi.mock("../api/lists", () => ({
  fetchLists: vi.fn(),
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

function mockListDetailData({ entries = [], history = [] } = {}) {
  fetchLists.mockResolvedValue({
    lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: false }]
  });
  fetchEntries.mockResolvedValue({ entries });
  fetchRecentlyUsed.mockResolvedValue({ history });
  fetchListMembers.mockResolvedValue({ members: [] });
  writeCachedResource.mockResolvedValue(undefined);
}

function getOpenItemsSection() {
  return screen.getByText("OPEN ITEMS").closest("section");
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
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
    updateEntry.mockReturnValue(new Promise(() => {}));

    renderListDetailPage();

    expect(await screen.findByText("Milk")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      expect(within(getOpenItemsSection()).queryByText("Milk")).toBeNull();
    });
    expect(updateEntry).toHaveBeenCalledWith("list-1", "entry-1", "test-token", { status: "done" });
  });

  it("reverts a toggled entry when updateEntry rejects", async () => {
    const updateRequest = createDeferred();
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
    updateEntry.mockReturnValue(updateRequest.promise);

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
    createEntry.mockReturnValue(new Promise(() => {}));

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
    expect(getOpenItemsSection().querySelector(".entry-tile-grid")).toBeTruthy();
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
      /<div className="list-card-chips">[\s\S]*\{visibleMemberBadges\.length > 0 \? \([\s\S]*<div className="detail-member-badges">/s
    );
  });

  it("defines the entry tile and recently used grid columns", () => {
    expect(cssSource).toMatch(
      /\.entry-tile-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\);/s
    );
    expect(cssSource).toMatch(
      /\.recently-used-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\);/s
    );
  });

  it("removes row delete wiring from the detail page", () => {
    expect(pageSource).toContain("EntryTile");
    expect(pageSource).not.toContain("handleDeleteEntry");
    expect(pageSource).not.toContain("deleteEntry");
  });
});
