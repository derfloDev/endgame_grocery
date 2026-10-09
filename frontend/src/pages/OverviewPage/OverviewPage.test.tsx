import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { fetchLists } from "../../api/lists";
import { writeCachedResource } from "../../api/offlineStore";
import { leaveList } from "../../api/sharing";
import { useListEvents } from "../../hooks/useListEvents";
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
  useAuth: () => ({ token: "test-token", user: { id: "user-1" } })
}));

vi.mock("../../hooks/useListEvents", () => ({
  useListEvents: vi.fn()
}));

vi.mock("../../hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => ({ syncVersion: 0 })
}));

const fetchListsMock = vi.mocked(fetchLists);
const useListEventsMock = vi.mocked(useListEvents);
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

describe("OverviewPage list lifecycle events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchListsMock.mockResolvedValue({
      lists: [
        { id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false },
        { id: "list-2", name: "Party supplies", owner_name: "Alex", is_owner: false }
      ]
    });
    writeCachedResourceMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  function getEventHandler(type: string) {
    const calls = useListEventsMock.mock.calls.filter(([eventType]) => eventType === type);
    return calls[calls.length - 1]![2];
  }

  function renderOverview(initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/"]) {
    return render(
      <MemoryRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }} initialEntries={initialEntries}>
        <Routes>
          <Route element={<OverviewPage />} path="/" />
        </Routes>
      </MemoryRouter>
    );
  }

  it("drops the list when the current user was removed from it, without reloading", async () => {
    renderOverview();
    await screen.findByText("Weekly groceries");
    const requests = fetchListsMock.mock.calls.length;

    act(() => { getEventHandler("member:removed")({ listId: "list-1", userId: "user-1" }); });

    await waitFor(() => { expect(screen.queryByText("Weekly groceries")).toBeNull(); });
    expect(screen.getByText("Party supplies")).toBeTruthy();
    expect(fetchListsMock.mock.calls.length).toBe(requests);
    expect(writeCachedResourceMock).toHaveBeenCalledWith("lists", {
      lists: [{ id: "list-2", name: "Party supplies", owner_name: "Alex", is_owner: false }]
    });
  });

  it("keeps the list when somebody else was removed from it", async () => {
    renderOverview();
    await screen.findByText("Weekly groceries");

    act(() => { getEventHandler("member:removed")({ listId: "list-1", userId: "user-2" }); });

    expect(screen.getByText("Weekly groceries")).toBeTruthy();
  });

  it("drops a deleted list immediately while the refresh is still running", async () => {
    renderOverview();
    await screen.findByText("Weekly groceries");
    fetchListsMock.mockReturnValueOnce(new Promise(() => undefined));

    act(() => { getEventHandler("list:deleted")({ listId: "list-1" }); });

    await waitFor(() => { expect(screen.queryByText("Weekly groceries")).toBeNull(); });
    expect(fetchListsMock).toHaveBeenCalledTimes(2);
  });

  it("shows the notice handed over by the detail page", async () => {
    renderOverview([{ pathname: "/", state: { notice: "This list was deleted." } }]);

    expect((await screen.findByRole("status")).textContent).toBe("This list was deleted.");
    await screen.findByText("Weekly groceries");
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

describe("OverviewPage cache-first loading", () => {
  afterEach(cleanup);

  it("renders the cached lists before the network answers, without a loading skeleton", async () => {
    fetchListsMock.mockReset();
    let resolveNetwork: (value: Awaited<ReturnType<typeof fetchLists>>) => void = () => undefined;
    fetchListsMock.mockImplementation((_token, options) => {
      options?.onCachedValue?.({ lists: [{ id: "list-1", name: "Cached pantry" }] });
      return new Promise((resolve) => { resolveNetwork = resolve; });
    });

    renderOverviewPage();

    expect(await screen.findByText("Cached pantry")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();

    await act(async () => { resolveNetwork({ lists: [{ id: "list-1", name: "Fresh pantry" }] }); });

    expect(await screen.findByText("Fresh pantry")).toBeTruthy();
    expect(screen.queryByText("Cached pantry")).toBeNull();
  });

  it("shows the skeleton on the very first load, when nothing is cached", async () => {
    fetchListsMock.mockReset();
    fetchListsMock.mockReturnValue(new Promise(() => undefined));

    renderOverviewPage();

    expect(await screen.findByLabelText("Loading")).toBeTruthy();
  });

  it("refreshes in place after a list event instead of showing the loader again", async () => {
    fetchListsMock.mockReset();
    fetchListsMock.mockResolvedValue({ lists: [{ id: "list-1", name: "Before rename" }] });
    renderOverviewPage();
    await screen.findByText("Before rename");
    let resolveReload: (value: Awaited<ReturnType<typeof fetchLists>>) => void = () => undefined;
    fetchListsMock.mockReturnValue(new Promise((resolve) => { resolveReload = resolve; }));
    const calls = useListEventsMock.mock.calls.filter(([eventType]) => eventType === "list:updated");

    act(() => { calls[calls.length - 1]![2]({}); });

    expect(screen.queryByLabelText("Loading")).toBeNull();
    expect(screen.getByText("Before rename")).toBeTruthy();

    await act(async () => { resolveReload({ lists: [{ id: "list-1", name: "After rename" }] }); });

    expect(await screen.findByText("After rename")).toBeTruthy();
  });

  it("keeps the shown lists and no loader when a refresh fails", async () => {
    fetchListsMock.mockReset();
    fetchListsMock.mockResolvedValueOnce({ lists: [{ id: "list-1", name: "Kept list" }] });
    renderOverviewPage();
    await screen.findByText("Kept list");
    fetchListsMock.mockRejectedValue(new Error("offline"));
    const calls = useListEventsMock.mock.calls.filter(([eventType]) => eventType === "list:updated");

    await act(async () => { calls[calls.length - 1]![2]({}); });

    expect(screen.getByText("Kept list")).toBeTruthy();
    expect(screen.queryByLabelText("Loading")).toBeNull();
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
