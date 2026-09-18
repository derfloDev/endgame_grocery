import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { fetchLists } from "../../api/lists";
import { writeCachedResource } from "../../api/offlineStore";
import { leaveList } from "../../api/sharing";
import OverviewPage from "./OverviewPage";

const streamState = vi.hoisted(() => ({ resyncVersion: 0 }));
vi.mock("../../context/EventSourceContext", () => ({ useEventSource: () => streamState }));
beforeEach(() => { streamState.resyncVersion = 0; });

vi.mock("../../api/lists", () => ({
  createList: vi.fn(),
  deleteList: vi.fn(),
  fetchLists: vi.fn(),
  renameList: vi.fn()
}));

vi.mock("../../api/offlineStore", () => ({
  writeCachedResource: vi.fn()
}));

vi.mock("../../api/sharing", () => ({
  leaveList: vi.fn()
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ token: "test-token" })
}));

vi.mock("../../hooks/useListEvents", () => ({
  useListEvents: vi.fn()
}));

vi.mock("../../hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({ syncVersion: 0 })
}));

const fetchListsMock = vi.mocked(fetchLists);
const leaveListMock = vi.mocked(leaveList);
const writeCachedResourceMock = vi.mocked(writeCachedResource);

describe("OverviewPage leave list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchListsMock.mockResolvedValue({
      lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }]
    });
    leaveListMock.mockResolvedValue(undefined);
    writeCachedResourceMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("confirms leaving and removes the shared list from the overview", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <MemoryRouter
        future={{
          v7_relativeSplatPath: true,
          v7_startTransition: true
        }}
        initialEntries={["/"]}
      >
        <Routes>
          <Route element={<OverviewPage />} path="/" />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Weekly groceries" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave list" }));

    await waitFor(() => {
      expect(leaveListMock).toHaveBeenCalledWith("list-1", "test-token");
      expect(screen.queryByText("Weekly groceries")).toBeNull();
    });
    expect(window.confirm).toHaveBeenCalledWith("Leave this shared list?");
    expect(writeCachedResourceMock).toHaveBeenCalledWith("lists", { lists: [] });
  });
});

describe("OverviewPage sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchListsMock.mockResolvedValue({
      lists: [
        {
          id: "list-b",
          name: "Bananas",
          is_owner: true,
          created_at: "2026-02-01T00:00:00.000Z",
          last_activity: "2026-04-01T00:00:00.000Z"
        },
        {
          id: "list-a",
          name: "Apples",
          is_owner: true,
          created_at: "2026-01-01T00:00:00.000Z",
          last_activity: "2026-03-01T00:00:00.000Z"
        }
      ]
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the sort control and persists immediate reordering", async () => {
    renderOverviewPage();

    const sortSelect = await screen.findByRole("combobox", { name: "Sort lists" });
    expect(getRenderedListNames()).toEqual(["Apples", "Bananas"]);

    await userEvent.selectOptions(sortSelect, "activity_desc");

    expect(getRenderedListNames()).toEqual(["Bananas", "Apples"]);
    expect(window.localStorage.getItem("overview_sort")).toBe("activity_desc");
  });

  it("restores a valid persisted sort preference", async () => {
    window.localStorage.setItem("overview_sort", "name_asc");

    renderOverviewPage();

    const sortSelect = await screen.findByRole<HTMLSelectElement>("combobox", { name: "Sort lists" });

    expect(sortSelect.value).toBe("name_asc");
    await screen.findByText("Apples");
    expect(getRenderedListNames()).toEqual(["Apples", "Bananas"]);
  });

  it("falls back to oldest first for an invalid persisted preference", async () => {
    window.localStorage.setItem("overview_sort", "invalid");

    renderOverviewPage();

    const sortSelect = await screen.findByRole<HTMLSelectElement>("combobox", { name: "Sort lists" });

    expect(sortSelect.value).toBe("created_asc");
    await screen.findByText("Apples");
    expect(getRenderedListNames()).toEqual(["Apples", "Bananas"]);
  });
});

describe("OverviewPage resync", () => {
  afterEach(cleanup);

  it("refetches on a resync bump without duplicating the initial load", async () => {
    fetchListsMock.mockReset();
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Before reconnect" }] });
    const view = renderOverviewPage();
    await screen.findByText("Before reconnect");
    expect(fetchListsMock).toHaveBeenCalledTimes(1);
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "After reconnect" }] });
    streamState.resyncVersion += 1;
    view.rerenderPage();
    await screen.findByText("After reconnect");
    expect(screen.queryByText("Before reconnect")).toBeNull();
    expect(fetchListsMock).toHaveBeenCalledTimes(2);
    view.rerenderPage();
    expect(fetchListsMock).toHaveBeenCalledTimes(2);
  });
});

function renderOverviewPage() {
  const tree = () => (
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={["/"]}
    >
      <Routes>
        <Route element={<OverviewPage />} path="/" />
      </Routes>
    </MemoryRouter>
  );
  const view = render(tree());
  return { ...view, rerenderPage: () => view.rerender(tree()) };
}

function getRenderedListNames(): string[] {
  return screen
    .getAllByRole("article")
    .map((article) => article.textContent ?? "")
    .map((text) => (text.includes("Apples") ? "Apples" : "Bananas"));
}
