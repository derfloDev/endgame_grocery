import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetOfflineStateForTests } from "./api/offlineStore";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";

function renderApp(initialEntries = ["/"]) {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={initialEntries}
    >
      <AuthProvider>
        <OfflineQueueProvider>
          <App />
        </OfflineQueueProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("authentication shell", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    window.localStorage.clear();
    await resetOfflineStateForTests();
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("redirects unauthenticated users to login", async () => {
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
  });

  it("renders the redesigned auth brand and updated copy on login and register", async () => {
    const rendered = renderApp(["/login"]);

    expect(await screen.findByRole("img", { name: "Endgame Grocery" })).toBeTruthy();
    expect(screen.getByText("ENDGAME")).toBeTruthy();
    expect(screen.getByText("GROCERY")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.getByText("Sign in to access your mission.")).toBeTruthy();

    rendered.unmount();
    renderApp(["/register"]);

    expect(await screen.findByRole("img", { name: "Endgame Grocery" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Join the Squad" })).toBeTruthy();
    expect(screen.getByText("Create your account to get started.")).toBeTruthy();
  });

  it("submits the login form and shows the protected overview", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: createFakeJwt("user-123") })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
        })
      });

    renderApp(["/login"]);

    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
  });

  it("renders bottom navigation only inside the protected app shell", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    const rendered = renderApp(["/"]);

    expect(await screen.findByLabelText("Primary navigation")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lists" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();

    rendered.unmount();
    window.localStorage.clear();

    renderApp(["/login"]);

    expect(screen.queryByLabelText("Primary navigation")).toBeNull();
  });

  it("redirects the removed /search route back to the overview", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    renderApp(["/search"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    expect(screen.getByRole("button", { name: "Lists" }).getAttribute("aria-current")).toBe("page");
  });

  it("submits the register form", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: { id: "user-1" } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: createFakeJwt("user-1") })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] })
      });

    renderApp(["/register"]);

    await userEvent.type(screen.getByLabelText("Display name"), "Demo User");
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        "/api/auth/register",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
  });

  it("creates, renames, and deletes a list from the overview", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    vi.stubGlobal("confirm", vi.fn(() => true));
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Weekend groceries", owner_name: "Demo User", is_owner: true }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Renamed list", owner_name: "Demo User", is_owner: true }
        })
      })
      .mockResolvedValueOnce({
        status: 204
      });

    renderApp(["/"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("dialog", { name: "New List" })).toBeTruthy();

    await userEvent.type(screen.getByLabelText("New list"), "Weekend groceries");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(await screen.findByText("Weekend groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Weekend groceries" }));
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByLabelText("Rename list");
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "Renamed list");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Renamed list")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Renamed list" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Renamed list")).toBeNull();
    });
  });

  it("shows the loading and error states on the overview", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));

    let rejectFetch;
    fetch.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFetch = reject;
      })
    );

    renderApp(["/"]);

    expect(await screen.findByLabelText("Loading")).toBeTruthy();

    rejectFetch(new Error("Boom"));

    expect(await screen.findByText("Mission Failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("logs out from the redesigned overview header", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    renderApp(["/"]);

    expect(await screen.findByText("ENDGAME")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
  });

  it("shows a shared badge in the overview with the owner name", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-2"));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-2", name: "BBQ party", owner_name: "Alex", is_owner: false }]
      })
    });

    renderApp(["/"]);

    expect(await screen.findByText("BBQ party")).toBeTruthy();
    expect(screen.getByText("Shared · Alex")).toBeTruthy();
  });

  it("adds, toggles, edits, renames, and collapses done entries in the list detail options flow", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [
            { id: "entry-1", text: "Milk", status: "open", created_at: "2026-04-21T00:00:00Z" },
            { id: "entry-2", text: "Bread", status: "done", created_at: "2026-04-21T00:01:00Z" }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          members: [
            {
              user_id: "user-1",
              display_name: "Demo User",
              email: "demo@example.com",
              joined_at: "2026-04-21T00:00:00Z",
              is_owner: true
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entry: { id: "entry-3", text: "Coffee", status: "open", created_at: "2026-04-21T00:02:00Z" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entry: { id: "entry-1", text: "Milk", status: "done", created_at: "2026-04-21T00:00:00Z" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entry: { id: "entry-3", text: "Ground coffee", status: "open", created_at: "2026-04-21T00:02:00Z" }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Mission groceries", owner_name: "Demo User", is_owner: true }
        })
      })
      .mockResolvedValueOnce({
        status: 204
      });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "List options" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Share list" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();

    expect(screen.getByText("OPEN ITEMS")).toBeTruthy();
    expect(screen.getByText("DONE")).toBeTruthy();
    expect(screen.getByText("Milk")).toBeTruthy();
    expect(screen.getByText("Bread")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByRole("dialog", { name: "Add Item" })).toBeTruthy();

    await userEvent.type(screen.getByLabelText("Add item"), "Coffee");
    await userEvent.click(screen.getByRole("button", { name: "Add Item" }));

    expect(await screen.findByText("Coffee")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));
    expect(await screen.findByRole("button", { name: "Mark Milk open" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Edit Coffee" }));
    const editInput = screen.getByLabelText("Edit Coffee");
    await userEvent.clear(editInput);
    await userEvent.type(editInput, "Ground coffee");
    await userEvent.click(screen.getByRole("button", { name: "Save item" }));

    expect(await screen.findByText("Ground coffee")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    expect(await screen.findByRole("dialog", { name: "List Options" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Rename list/ }));

    const renameSheetInput = await screen.findByLabelText("Rename list");
    expect(renameSheetInput.value).toBe("Weekly groceries");
    await userEvent.clear(renameSheetInput);
    await userEvent.type(renameSheetInput, "Mission groceries");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Mission groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Toggle done items" }));

    expect(screen.queryByText("Bread")).toBeNull();
    expect(screen.queryByText("Milk")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Toggle done items" }));
    expect(await screen.findByText("Bread")).toBeTruthy();
    expect(screen.getByText("Milk")).toBeTruthy();
  });

  it("opens the share sheet from list options and revokes a member", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          members: [
            {
              user_id: "user-1",
              display_name: "Demo User",
              email: "demo@example.com",
              joined_at: "2026-04-21T00:00:00Z",
              is_owner: true
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          member: {
            user_id: "user-2",
            display_name: "Alex",
            email: "alex@example.com",
            joined_at: "2026-04-21T01:00:00Z",
            is_owner: false
          }
        })
      })
      .mockResolvedValueOnce({
        status: 204
      });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    expect(await screen.findByRole("dialog", { name: "List Options" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Share list/ }));

    expect(await screen.findByRole("dialog", { name: "Share List" })).toBeTruthy();
    expect(screen.getByText("SQUAD (1)")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("Add member by email"), "alex@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Add Member" }));

    expect(await screen.findByText("Alex")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(screen.queryByText("Alex")).toBeNull();
    });
  });

  it("shows the redesigned list detail loading and error states", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));

    let rejectFetch;
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
        })
      })
      .mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFetch = reject;
      })
      );

    renderApp(["/lists/list-1"]);

    expect(await screen.findByLabelText("Loading")).toBeTruthy();

    rejectFetch(new Error("Load failed"));

    expect(await screen.findByText("Load failed")).toBeTruthy();
  });

  it("shows cached lists while offline and displays the offline banner", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
      })
    });

    const rendered = renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    rendered.unmount();
    fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    setNavigatorOnline(false);

    renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("Offline mode: cached data is available.")).toBeTruthy();
  });

  it("queues offline writes and refreshes after reconnect", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    vi.stubGlobal("confirm", vi.fn(() => true));
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] })
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          list: { id: "list-99", name: "Queued list", owner_name: "Demo User", is_owner: true }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-99", name: "Queued list", owner_name: "Demo User", is_owner: true }]
        })
      });

    renderApp(["/"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();

    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await userEvent.type(screen.getByLabelText("New list"), "Queued list");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(await screen.findByText("Queued list")).toBeTruthy();
    expect(screen.getAllByText("Queued")[0]).toBeTruthy();
    expect(screen.getByText("Offline mode: 1 change waiting to sync.")).toBeTruthy();

    setNavigatorOnline(true);
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("Queued list")).toBeTruthy();
  });
});

function createFakeJwt(sub) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub }));

  return `${header}.${payload}.signature`;
}

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}
