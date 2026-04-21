import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

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
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("authentication shell", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("redirects unauthenticated users to login", async () => {
    renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeTruthy();
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

    expect(await screen.findByText("No lists yet. Create one to get started.")).toBeTruthy();
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

    expect(await screen.findByText("No lists yet. Create one to get started.")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("New list"), "Weekend groceries");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(await screen.findByText("Weekend groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Rename" }));
    const renameInput = screen.getByLabelText("Rename list");
    await userEvent.clear(renameInput);
    await userEvent.type(renameInput, "Renamed list");
    await userEvent.click(screen.getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Renamed list")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Renamed list")).toBeNull();
    });
  });
});

function createFakeJwt(sub) {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub }));

  return `${header}.${payload}.signature`;
}
