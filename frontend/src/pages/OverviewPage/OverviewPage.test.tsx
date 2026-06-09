import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { fetchLists } from "../../api/lists";
import { writeCachedResource } from "../../api/offlineStore";
import { leaveList } from "../../api/sharing";
import OverviewPage from "./OverviewPage";

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
