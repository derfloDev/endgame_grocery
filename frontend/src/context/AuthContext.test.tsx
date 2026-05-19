import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { fetchCurrentUser, loginUser, registerUser } from "../api/auth";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/auth", () => ({
  fetchCurrentUser: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn()
}));

const fetchCurrentUserMock = vi.mocked(fetchCurrentUser);
const loginUserMock = vi.mocked(loginUser);
const registerUserMock = vi.mocked(registerUser);

function AuthState() {
  const { token, user } = useAuth();
  const location = useLocation();

  return (
    <>
      <div data-testid="token">{token}</div>
      <div data-testid="user-id">{user?.id ?? ""}</div>
      <div data-testid="user-name">{user?.display_name ?? ""}</div>
      <div data-testid="user-email">{user?.email ?? ""}</div>
      <div data-testid="pathname">{location.pathname}</div>
      <div data-testid="from">{(location.state as { from?: string } | null)?.from ?? ""}</div>
      <div data-testid="session-expired">
        {(location.state as { sessionExpired?: boolean } | null)?.sessionExpired ? "yes" : "no"}
      </div>
    </>
  );
}

function renderAuthProvider(initialEntries = ["/"]) {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={initialEntries}
    >
      <AuthProvider>
        <Routes>
          <Route element={<AuthState />} path="*" />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.clearAllMocks();
    loginUserMock.mockResolvedValue({ token: "" });
    registerUserMock.mockResolvedValue({ message: "ok" });
  });

  afterEach(() => {
    cleanup();
  });

  it("hydrates the current user when only a persisted token is available", async () => {
    const token = createFakeJwt("user-1");
    fetchCurrentUserMock.mockResolvedValue({
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    });
    window.localStorage.setItem("endgame_grocery.auth_token", token);

    renderAuthProvider();

    expect(screen.getByTestId("token").textContent).toBe(token);
    expect(screen.getByTestId("user-id").textContent).toBe("user-1");

    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledWith(token);
    });
    expect(screen.getByTestId("user-name").textContent).toBe("Demo User");
    expect(screen.getByTestId("user-email").textContent).toBe("demo@example.com");
    expect(JSON.parse(window.localStorage.getItem("endgame_grocery.auth_user")!)).toEqual({
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    });
  });

  it("skips profile hydration when display_name is already stored", async () => {
    const token = createFakeJwt("user-1");
    window.localStorage.setItem("endgame_grocery.auth_token", token);
    window.localStorage.setItem(
      "endgame_grocery.auth_user",
      JSON.stringify({
        id: "user-1",
        display_name: "Demo User",
        email: "demo@example.com"
      })
    );

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByTestId("user-name").textContent).toBe("Demo User");
    });
    expect(fetchCurrentUserMock).not.toHaveBeenCalled();
  });

  it("keeps the jwt session active when profile hydration fails", async () => {
    const token = createFakeJwt("user-1");
    fetchCurrentUserMock.mockRejectedValue(new Error("offline"));
    window.localStorage.setItem("endgame_grocery.auth_token", token);

    renderAuthProvider();

    await waitFor(() => {
      expect(fetchCurrentUser).toHaveBeenCalledWith(token);
    });
    expect(screen.getByTestId("token").textContent).toBe(token);
    expect(screen.getByTestId("user-id").textContent).toBe("user-1");
    expect(screen.getByTestId("user-name").textContent).toBe("");
    expect(window.localStorage.getItem("endgame_grocery.auth_token")).toBe(token);
    expect(window.localStorage.getItem("endgame_grocery.auth_user")).toBeNull();
  });

  it("clears the stored session and redirects with state when auth expires", async () => {
    const token = createFakeJwt("user-1");
    window.localStorage.setItem("endgame_grocery.auth_token", token);
    window.localStorage.setItem(
      "endgame_grocery.auth_user",
      JSON.stringify({
        id: "user-1",
        display_name: "Demo User",
        email: "demo@example.com"
      })
    );

    renderAuthProvider(["/lists/list-1"]);

    act(() => {
      window.dispatchEvent(new Event("auth:expired"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
    });
    expect(screen.getByTestId("from").textContent).toBe("/lists/list-1");
    expect(screen.getByTestId("session-expired").textContent).toBe("yes");
    expect(screen.getByTestId("token").textContent).toBe("");
    expect(window.localStorage.getItem("endgame_grocery.auth_token")).toBeNull();
    expect(window.localStorage.getItem("endgame_grocery.auth_user")).toBeNull();
  });
});

function createFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub }));

  return `${header}.${payload}.signature`;
}
