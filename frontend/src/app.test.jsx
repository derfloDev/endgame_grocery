import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "./i18n";
import { resetOfflineStateForTests } from "./api/offlineStore";
import App from "./App";
import { StaticAppConfigProvider } from "./context/AppConfigContext";
import { AuthProvider } from "./context/AuthContext";
import { EventSourceProvider } from "./context/EventSourceContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";

function renderApp(initialEntries = ["/"], { registrationEnabled = true } = {}) {
  return render(
    <MemoryRouter
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
      initialEntries={initialEntries}
    >
      <StaticAppConfigProvider registrationEnabled={registrationEnabled}>
        <AuthProvider>
          <EventSourceProvider>
            <OfflineQueueProvider>
              <App />
            </OfflineQueueProvider>
          </EventSourceProvider>
        </AuthProvider>
      </StaticAppConfigProvider>
    </MemoryRouter>
  );
}

describe("authentication shell", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    stubMatchMedia();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("Notification", {
      permission: "granted",
      requestPermission: vi.fn(async () => "granted")
    });
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: {
            async getSubscription() {
              return null;
            },
            async subscribe() {
              return {
                endpoint: "https://push.example.com/subscriptions/1",
                keys: {
                  p256dh: "p256dh-key",
                  auth: "auth-key"
                },
                async unsubscribe() {
                  return true;
                },
                toJSON() {
                  return {
                    endpoint: this.endpoint,
                    keys: this.keys
                  };
                }
              };
            }
          }
        })
      }
    });
    window.localStorage.clear();
    await i18next.changeLanguage("en");
    await resetOfflineStateForTests();
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("renders translated auth copy when German is selected", async () => {
    window.localStorage.setItem("i18nextLng", "de");
    await i18next.changeLanguage("de");

    renderApp(["/login"]);

    expect(await screen.findByRole("heading", { name: "Willkommen zurück" })).toBeTruthy();
    expect(screen.getByText("Melde dich an, um fortzufahren.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeTruthy();
  });

  it("hides the registration link when runtime config disables self-registration", async () => {
    renderApp(["/login"], { registrationEnabled: false });

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Create an account" })).toBeNull();
  });

  it("redirects /register to /login when runtime config disables self-registration", async () => {
    renderApp(["/register"], { registrationEnabled: false });

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Join the Squad" })).toBeNull();
  });

  it("submits the login form and shows the protected overview", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-123"),
          user: createAuthUser("user-123")
        })
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

  it("does not render bottom navigation in either the protected shell or auth pages", async () => {
    seedAuthSession("user-1");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    const rendered = renderApp(["/"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(screen.queryByLabelText("Primary navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lists" })).toBeNull();

    rendered.unmount();
    window.localStorage.clear();

    renderApp(["/login"]);

    expect(screen.queryByLabelText("Primary navigation")).toBeNull();
  });

  it("redirects the removed /search route back to the overview", async () => {
    seedAuthSession("user-1");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    renderApp(["/search"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(screen.queryByLabelText("Primary navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lists" })).toBeNull();
  });

  it("submits the register form and redirects to email verification", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Verification email sent." })
    });

    renderApp(["/register"]);

    await userEvent.type(screen.getByLabelText("Display name"), "Demo User");
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          method: "POST"
        })
      );
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
  });

  it("registers a user from an invite and redirects directly to the shared list", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-5"),
          listId: "list-1",
          user: createAuthUser("user-5")
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicKey: "dGVzdA" })
      });

    renderApp(["/register?invite=invite-token-1"]);

    await userEvent.type(screen.getByLabelText("Display name"), "Demo User");
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/register",
        expect.objectContaining({
          body: JSON.stringify({
            display_name: "Demo User",
            email: "demo@example.com",
            password: "password123",
            invite_token: "invite-token-1"
          }),
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(window.localStorage.getItem("endgame_grocery.auth_token")).toBe(createFakeJwt("user-5"));
  });

  it("verifies the email token, stores the jwt, and redirects into the protected app", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-1"),
          user: createAuthUser("user-1")
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] })
      });

    renderApp(["/verify-email?token=valid-token"]);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/verify-email?token=valid-token",
        expect.objectContaining({
          method: "GET"
        })
      );
    });

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(window.localStorage.getItem("endgame_grocery.auth_token")).toBe(createFakeJwt("user-1"));
  });

  it("redirects invite links through login and accepts the invite after authentication", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-1"),
          user: createAuthUser("user-1")
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ listId: "list-1" })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicKey: "dGVzdA" })
      });

    renderApp(["/invite/invite-token-1"]);

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          body: JSON.stringify({ email: "demo@example.com", password: "password123" }),
          method: "POST"
        })
      );
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/invites/invite-token-1",
        expect.objectContaining({
          method: "GET"
        })
      );
    });

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
  });

  it("shows verification errors when the token is invalid or expired", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Verification link is invalid or has expired." })
    });

    renderApp(["/verify-email?token=expired-token"]);

    expect(await screen.findByText("Verification link is invalid or has expired.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
  });

  it("resends the verification email from the public verify page", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "If your account is pending verification, a new email has been sent." })
    });

    renderApp([{ pathname: "/verify-email", state: { email: "demo@example.com" } }]);

    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Resend verification email" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/resend-verification",
        expect.objectContaining({
          body: JSON.stringify({ email: "demo@example.com" }),
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("A fresh verification email is on its way if your account is still pending.")).toBeTruthy();
  });

  it("links to forgot password from login and submits the request with a generic success message", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "If an account exists, you will receive an email." })
    });

    renderApp(["/login"]);

    expect(await screen.findByRole("link", { name: "Forgot password?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("link", { name: "Forgot password?" }));

    expect(await screen.findByRole("heading", { name: "Reset your password" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset email" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({
          body: JSON.stringify({ email: "demo@example.com" }),
          method: "POST"
        })
      );
    });

    expect(await screen.findByText("If the account exists, a reset email is on its way.")).toBeTruthy();
  });

  it("shows reset-password errors for invalid or expired tokens", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Password reset link is invalid or has expired." })
    });

    renderApp(["/reset-password?token=expired-reset"]);

    await userEvent.type(screen.getByLabelText("New password"), "new-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password reset link is invalid or has expired.")).toBeTruthy();
  });

  it("submits a new password and returns to login with a success message", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Password updated." })
    });

    renderApp(["/reset-password?token=valid-reset"]);

    expect(await screen.findByRole("heading", { name: "Choose a new password" })).toBeTruthy();
    await userEvent.type(screen.getByLabelText("New password"), "new-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/reset-password",
        expect.objectContaining({
          body: JSON.stringify({ token: "valid-reset", password: "new-password-123" }),
          method: "POST"
        })
      );
    });

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.getByText("Password updated. Please log in with your new password.")).toBeTruthy();
  });

  it("creates, renames, and deletes a list from the overview", async () => {
    seedAuthSession("user-1");
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
    seedAuthSession("user-1");

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

  it("removes the overview toggle buttons and stat chips", async () => {
    seedAuthSession("user-1");
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
      })
    });

    renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Active" })).toBeNull();
    expect(screen.queryByRole("button", { name: "All Lists" })).toBeNull();
    expect(screen.queryByText("1 list")).toBeNull();
    expect(screen.queryByText("1 lists")).toBeNull();
    expect(screen.queryByText(/shared/i)).toBeNull();
  });

  it("opens the overview info sheet and logs out from it", async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-1"),
          user: {
            id: "user-1",
            display_name: "Demo User",
            email: "demo@example.com"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ lists: [] })
      });

    renderApp(["/login"]);

    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("ENDGAME")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("dialog", { name: "Info & Settings" })).toBeTruthy();
    expect(screen.getByText("Demo User")).toBeTruthy();
    expect(screen.getByText("demo@example.com")).toBeTruthy();
    expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "GNU GPL v3.0" })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("endgame_grocery.auth_user"))).toEqual({
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    });

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
  });

  it("rehydrates the stored auth user into the info sheet after a full reload", async () => {
    window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt("user-1"));
    window.localStorage.setItem(
      "endgame_grocery.auth_user",
      JSON.stringify({
        id: "user-1",
        display_name: "Demo User",
        email: "demo@example.com"
      })
    );
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lists: [] })
    });

    renderApp(["/"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("dialog", { name: "Info & Settings" })).toBeTruthy();
    expect(screen.getByText("Demo User")).toBeTruthy();
    expect(screen.getByText("demo@example.com")).toBeTruthy();
  });

  it("rehydrates missing auth user data from /api/auth/me after a full reload", async () => {
    const token = createFakeJwt("user-1");
    window.localStorage.setItem("endgame_grocery.auth_token", token);
    fetch.mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/auth/me") {
        return {
          ok: true,
          json: async () => ({
            id: "user-1",
            display_name: "Demo User",
            email: "demo@example.com"
          })
        };
      }

      if (url === "/api/lists") {
        return {
          ok: true,
          json: async () => ({ lists: [] })
        };
      }

      throw new Error(`Unexpected fetch in test: ${url}`);
    });

    renderApp(["/"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/auth/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${token}`
          }),
          method: "GET"
        })
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("dialog", { name: "Info & Settings" })).toBeTruthy();
    expect(screen.getByText("Demo User")).toBeTruthy();
    expect(screen.getByText("demo@example.com")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("endgame_grocery.auth_user"))).toEqual({
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    });
  });

  it("shows a shared badge in the overview with the owner name", async () => {
    seedAuthSession("user-2");
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

  it("refreshes the overview when list SSE events arrive", async () => {
    seedAuthSession("user-1");
    const listResponses = [
      [{ id: "list-1", name: "Weekend groceries", owner_name: "Demo User", is_owner: true }],
      [{ id: "list-1", name: "Renamed groceries", owner_name: "Demo User", is_owner: true }],
      []
    ];
    let listRequestCount = 0;

    fetch.mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/lists") {
        const lists = listResponses[Math.min(listRequestCount, listResponses.length - 1)];
        listRequestCount += 1;

        return {
          ok: true,
          json: async () => ({ lists })
        };
      }

      throw new Error(`Unexpected fetch in test: ${url}`);
    });

    renderApp(["/"]);

    expect(await screen.findByText("Weekend groceries")).toBeTruthy();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0].emit("list:updated", { listId: "list-99" });

    expect(await screen.findByText("Renamed groceries")).toBeTruthy();

    MockEventSource.instances[0].emit("list:deleted", { listId: "list-99" });

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists")).toHaveLength(3);
  });

  it("shows recently used items, re-adds them, and dismisses them from list detail", async () => {
    seedAuthSession("user-1");
    const queuedResponses = [
      {
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
        })
      },
      {
        ok: true,
        json: async () => ({
          entries: [
            { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk", created_at: "2026-04-21T00:00:00Z" }
          ]
        })
      },
      {
        ok: true,
        json: async () => ({
          history: [
            { text: "Tomatoes", icon: "IconSalad", useCount: 7 },
            { text: "Bread", icon: "IconBread", useCount: 4 }
          ]
        })
      },
      {
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
      },
      {
        ok: true,
        json: async () => ({
          entry: {
            id: "entry-2",
            text: "Tomatoes",
            status: "open",
            icon: "IconSalad",
            created_at: "2026-04-21T00:02:00Z"
          }
        })
      },
      {
        status: 204
      }
    ];

    fetch.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("/suggestions?")) {
        return {
          ok: true,
          json: async () => ({
            suggestions: []
          })
        };
      }

      const nextResponse = queuedResponses.shift();

      if (!nextResponse) {
        throw new Error(`Unexpected fetch in test: ${url}`);
      }

      return nextResponse;
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "List options" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();

    const openSectionLabel = screen.getByText("OPEN ITEMS");
    const recentlyUsedSection = await screen.findByRole("region", { name: "Recently Used" });
    const recentlyUsedLabel = within(recentlyUsedSection).getByText("RECENTLY USED");

    expect(openSectionLabel.compareDocumentPosition(recentlyUsedLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText("DONE")).toBeNull();
    expect(screen.getByText("Milk")).toBeTruthy();
    expect(within(recentlyUsedSection).getByText("Tomatoes")).toBeTruthy();
    expect(within(recentlyUsedSection).getByText("Bread")).toBeTruthy();

    await userEvent.click(within(recentlyUsedSection).getByRole("button", { name: "Tomatoes" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/list-1/entries",
        expect.objectContaining({
          body: JSON.stringify({ text: "Tomatoes", icon: "IconSalad", details: "" }),
          method: "POST"
        })
      );
    });

    expect(await screen.findByRole("button", { name: "Mark Tomatoes done" })).toBeTruthy();
    await waitFor(() => {
      expect(within(recentlyUsedSection).queryByText("Tomatoes")).toBeNull();
    });

    await userEvent.click(within(recentlyUsedSection).getByRole("button", { name: "Dismiss Bread" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/list-1/history",
        expect.objectContaining({
          body: JSON.stringify({ text: "Bread" }),
          method: "DELETE"
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Recently Used" })).toBeNull();
    });
  }, 10000);

  it("adds completed items to recently used and keeps newest history first", async () => {
    seedAuthSession("user-1");
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
            { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk", created_at: "2026-04-21T00:00:00Z" },
            {
              id: "entry-2",
              text: "Cheese",
              status: "open",
              icon: "IconCheese",
              created_at: "2026-04-21T00:01:00Z"
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: [{ text: "Bread", icon: "IconBread", useCount: 2 }]
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
          entry: {
            id: "entry-1",
            text: "Milk",
            status: "done",
            icon: "IconMilk",
            created_at: "2026-04-21T00:00:00Z"
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entry: {
            id: "entry-2",
            text: "Cheese",
            status: "done",
            icon: "IconCheese",
            created_at: "2026-04-21T00:01:00Z"
          }
        })
      });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    const recentlyUsedSection = await screen.findByRole("region", { name: "Recently Used" });

    expect(within(recentlyUsedSection).getByText("Bread")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Mark Milk done" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Mark Milk done" })).toBeNull();
    });
    expect(within(recentlyUsedSection).getByText("Milk")).toBeTruthy();

    const chipLabelsAfterDone = within(recentlyUsedSection)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(chipLabelsAfterDone.indexOf("Milk")).toBeLessThan(chipLabelsAfterDone.indexOf("Bread"));

    await userEvent.click(screen.getByRole("button", { name: "Mark Cheese done" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/list-1/entries/entry-2",
        expect.objectContaining({
          body: JSON.stringify({ status: "done" }),
          method: "PATCH"
        })
      );
    });

    await waitFor(() => {
      expect(within(recentlyUsedSection).getByRole("button", { name: "Cheese" })).toBeTruthy();
    });

    const chipLabelsAfterDelete = within(recentlyUsedSection)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(chipLabelsAfterDelete.indexOf("Cheese")).toBeLessThan(chipLabelsAfterDelete.indexOf("Milk"));
  }, 10000);

  it("refetches entries and members for the active list when SSE events arrive", async () => {
    seedAuthSession("user-1");
    const entryResponses = [
      [{ id: "entry-1", text: "Milk", status: "open", icon: "IconMilk", created_at: "2026-04-21T00:00:00Z" }],
      [
        { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk", created_at: "2026-04-21T00:00:00Z" },
        { id: "entry-2", text: "Bread", status: "open", icon: "IconBread", created_at: "2026-04-21T00:01:00Z" }
      ],
      [
        {
          id: "entry-1",
          text: "Milk updated",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        },
        { id: "entry-2", text: "Bread", status: "open", icon: "IconBread", created_at: "2026-04-21T00:01:00Z" }
      ],
      [
        {
          id: "entry-1",
          text: "Milk updated",
          status: "open",
          icon: "IconMilk",
          created_at: "2026-04-21T00:00:00Z"
        }
      ]
    ];
    const memberResponses = [
      [
        {
          user_id: "user-1",
          display_name: "Demo User",
          email: "demo@example.com",
          joined_at: "2026-04-21T00:00:00Z",
          is_owner: true
        }
      ],
      [
        {
          user_id: "user-1",
          display_name: "Demo User",
          email: "demo@example.com",
          joined_at: "2026-04-21T00:00:00Z",
          is_owner: true
        },
        {
          user_id: "user-2",
          display_name: "Alex",
          email: "alex@example.com",
          joined_at: "2026-04-21T01:00:00Z",
          is_owner: false
        }
      ],
      [
        {
          user_id: "user-1",
          display_name: "Demo User",
          email: "demo@example.com",
          joined_at: "2026-04-21T00:00:00Z",
          is_owner: true
        }
      ]
    ];
    let entryRequestCount = 0;
    let memberRequestCount = 0;

    fetch.mockImplementation(async (input) => {
      const url = String(input);

      if (url === "/api/lists") {
        return {
          ok: true,
          json: async () => ({
            lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
          })
        };
      }

      if (url === "/api/lists/list-1/entries") {
        const entries = entryResponses[Math.min(entryRequestCount, entryResponses.length - 1)];
        entryRequestCount += 1;

        return {
          ok: true,
          json: async () => ({ entries })
        };
      }

      if (url === "/api/lists/list-1/history") {
        return {
          ok: true,
          json: async () => ({ history: [] })
        };
      }

      if (url === "/api/lists/list-1/members") {
        const members = memberResponses[Math.min(memberRequestCount, memberResponses.length - 1)];
        memberRequestCount += 1;

        return {
          ok: true,
          json: async () => ({ members })
        };
      }

      if (url === "/api/push/vapid-public-key") {
        return {
          ok: true,
          json: async () => ({ publicKey: "dGVzdA" })
        };
      }

      throw new Error(`Unexpected fetch in test: ${url}`);
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(await screen.findByText("Milk")).toBeTruthy();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    await userEvent.click(screen.getByRole("button", { name: /^Share list/ }));
    expect(await screen.findByText(/SQUAD \(1\)/)).toBeTruthy();

    MockEventSource.instances[0].emit("entry:created", { listId: "list-1", entryId: "entry-2" });
    expect(await screen.findByText("Bread")).toBeTruthy();

    MockEventSource.instances[0].emit("entry:updated", { listId: "list-1", entryId: "entry-1" });
    expect(await screen.findByText("Milk updated")).toBeTruthy();

    MockEventSource.instances[0].emit("entry:deleted", { listId: "list-1", entryId: "entry-2" });
    await waitFor(() => {
      expect(screen.queryByText("Bread")).toBeNull();
    });

    MockEventSource.instances[0].emit("member:added", { listId: "list-1", userId: "user-2" });
    expect(await screen.findByText("Alex")).toBeTruthy();
    expect(screen.getByText(/SQUAD \(2\)/)).toBeTruthy();

    MockEventSource.instances[0].emit("member:removed", { listId: "list-1", userId: "user-2" });
    await waitFor(() => {
      expect(screen.queryByText("Alex")).toBeNull();
    });
    expect(screen.getByText(/SQUAD \(1\)/)).toBeTruthy();

    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists")).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/entries")).toHaveLength(4);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/members")).toHaveLength(3);
  }, 10000);

  it("adds and edits entry details from the list detail sheet", async () => {
    seedAuthSession("user-1");

    fetch.mockImplementation(async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";

      if (url.includes("/suggestions?")) {
        return {
          ok: true,
          json: async () => ({
            suggestions: []
          })
        };
      }

      if (url === "/api/lists") {
        return {
          ok: true,
          json: async () => ({
            lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
          })
        };
      }

      if (url === "/api/lists/list-1/entries" && method === "GET") {
        return {
          ok: true,
          json: async () => ({
            entries: [
              { id: "entry-1", text: "X", status: "open", icon: null, details: "2L", created_at: "2026-04-21T00:00:00Z" }
            ]
          })
        };
      }

      if (url === "/api/lists/list-1/history") {
        return {
          ok: true,
          json: async () => ({
            history: []
          })
        };
      }

      if (url === "/api/lists/list-1/members") {
        return {
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
        };
      }

      if (url === "/api/lists/list-1/entries" && method === "POST") {
        expect(JSON.parse(init.body)).toMatchObject({ text: "Y", details: "500 g" });

        return {
          ok: true,
          json: async () => ({
            entry: {
              id: "entry-2",
              text: "Y",
              status: "open",
              icon: null,
              details: "500 g",
              created_at: "2026-04-21T00:01:00Z"
            }
          })
        };
      }

      if (url === "/api/lists/list-1/entries/entry-1" && method === "PATCH") {
        expect(JSON.parse(init.body)).toMatchObject({ text: "X", details: "3L" });

        return {
          ok: true,
          json: async () => ({
            entry: {
              id: "entry-1",
              text: "X",
              status: "open",
              icon: null,
              details: "3L",
              created_at: "2026-04-21T00:00:00Z"
            }
          })
        };
      }

      throw new Error(`Unexpected fetch in test: ${method} ${url}`);
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("2L")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    const addDialog = await screen.findByRole("dialog", { name: "Add Item" });
    fireEvent.change(within(addDialog).getByLabelText("Add item"), { target: { value: "Y" } });
    fireEvent.change(within(addDialog).getByLabelText("Details (optional)"), { target: { value: "500 g" } });
    await userEvent.click(within(addDialog).getByRole("button", { name: "Add Item" }));

    await waitFor(() => {
      const addCall = fetch.mock.calls.find(
        ([url, init]) => url === "/api/lists/list-1/entries" && init?.method === "POST"
      );

      expect(addCall).toBeTruthy();
      expect(JSON.parse(addCall[1].body)).toMatchObject({ text: "Y", details: "500 g" });
    });
    expect(await screen.findByText("500 g")).toBeTruthy();

    const xTile = screen.getByRole("button", { name: "Mark X done" });
    fireEvent.mouseDown(xTile);
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 550);
      });
    });
    fireEvent.mouseUp(xTile);
    fireEvent.click(xTile);

    const editDialog = await screen.findByRole("dialog", { name: "Edit Item" });
    const editDetailsInput = within(editDialog).getByLabelText("Details (optional)");
    expect(editDetailsInput.value).toBe("2L");

    fireEvent.change(editDetailsInput, { target: { value: "3L" } });
    await userEvent.click(within(editDialog).getByRole("button", { name: "Save Item" }));

    await waitFor(() => {
      const editCall = fetch.mock.calls.find(
        ([url, init]) => url === "/api/lists/list-1/entries/entry-1" && init?.method === "PATCH"
      );

      expect(editCall).toBeTruthy();
      expect(JSON.parse(editCall[1].body)).toMatchObject({ text: "X", details: "3L" });
    });
    await waitFor(() => {
      expect(screen.getByText("3L")).toBeTruthy();
      expect(screen.queryByText("2L")).toBeNull();
    });
  }, 10000);

  it("opens the share sheet, sends an invite notice, and revokes an existing member", async () => {
    seedAuthSession("user-1");
    const inviteRequest = createDeferred();
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
          history: []
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
            },
            {
              user_id: "user-2",
              display_name: "Alex Brown",
              email: "alex@example.com",
              joined_at: "2026-04-21T01:00:00Z",
              is_owner: false
            }
          ]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ publicKey: "dGVzdA" })
      })
      .mockReturnValueOnce(inviteRequest.promise)
      .mockResolvedValueOnce({
        status: 204
      });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    expect(await screen.findByRole("dialog", { name: "List Options" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /^Share list/ }));

    expect(await screen.findByRole("dialog", { name: "Share List" })).toBeTruthy();
    expect(screen.getByText("SQUAD (2)")).toBeTruthy();
    expect(screen.getByText("Alex Brown")).toBeTruthy();
    expect(screen.getByTitle("Alex Brown")).toBeTruthy();
    expect(screen.getByText("AB")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("Invite member by email"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(screen.getByRole("button", { name: "Send Invite" }).hasAttribute("disabled")).toBe(true);
    expect(document.querySelector(".share-invite-spinner")).toBeTruthy();

    inviteRequest.resolve({
      ok: true,
      json: async () => ({
        invite: {
          id: "invite-1",
          invited_email: "sam@example.com",
          status: "pending",
          expires_at: "2026-04-28T00:00:00Z"
        }
      })
    });

    expect(await screen.findByText("Invitation sent to sam@example.com.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send Invite" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("sam@example.com")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() => {
      expect(screen.queryByText("Alex")).toBeNull();
    });
  });

  it("shows the notifications toggle only for shared lists", async () => {
    seedAuthSession("user-1");

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-1", name: "Solo groceries", owner_name: "Demo User", is_owner: true }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: [] })
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
      });

    const rendered = renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Solo groceries")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enable notifications" })).toBeNull();

    rendered.unmount();
    fetch.mockReset();
    const deferredVapidResponse = createDeferred();

    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [{ id: "list-2", name: "BBQ party", owner_name: "Alex", is_owner: false }]
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entries: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ history: [] })
      })
      .mockReturnValueOnce(deferredVapidResponse.promise);

    renderApp(["/lists/list-2"]);

    expect(await screen.findByText("BBQ party")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Enable notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable notifications" }).hasAttribute("disabled")).toBe(true);

    deferredVapidResponse.resolve({
      ok: true,
      json: async () => ({ publicKey: "test-public-key" })
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Enable notifications" }).hasAttribute("disabled")).toBe(
        false
      );
    });
  });

  it("shows the redesigned list detail loading and error states", async () => {
    seedAuthSession("user-1");

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
      )
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          history: []
        })
      });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByLabelText("Loading")).toBeTruthy();

    rejectFetch(new Error("Load failed"));

    expect(await screen.findByText("Load failed")).toBeTruthy();
  });

  it("shows cached lists while offline and displays the offline banner", async () => {
    seedAuthSession("user-1");
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
    seedAuthSession("user-1");
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

function createAuthUser(sub, overrides = {}) {
  return {
    id: sub,
    display_name: overrides.display_name ?? "Demo User",
    email: overrides.email ?? `${sub}@example.com`
  };
}

function seedAuthSession(sub, overrides = {}) {
  window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt(sub));
  window.localStorage.setItem(
    "endgame_grocery.auth_user",
    JSON.stringify(createAuthUser(sub, overrides))
  );
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

function setNavigatorOnline(value) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}

function stubMatchMedia({ reduced = false } = {}) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query) => ({
      matches: reduced && query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = MockEventSource.OPEN;
    this.listeners = new Map();
    this.close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type, data) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler({
        data: JSON.stringify(data)
      });
    }
  }
}
