import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "./i18n";
import { resetOfflineStateForTests } from "./api/offlineStore";
import { resetConnectivityForTests } from "./api/connectivity";
import { createFetchRoutes, type FetchReply } from "./test/fetchRoutes";
import App from "./App";
import { StaticAppConfigProvider } from "./context/AppConfigContext";
import { AuthProvider } from "./context/AuthContext";
import { EventSourceProvider } from "./context/EventSourceContext";
import { OfflineQueueProvider } from "./context/OfflineQueueContext";

vi.mock("./sw/register", () => ({
  ensureServiceWorker: vi.fn(() => navigator.serviceWorker.ready),
  useServiceWorkerUpdate: () => ({ needRefresh: false, dismissUpdate: vi.fn(), updateServiceWorker: vi.fn() })
}));
import { ensureServiceWorker } from "./sw/register";

const routes = createFetchRoutes();
const fetch = routes.fetch;
const queueTimings = { REACHABILITY_PROBE_MIN_INTERVAL_MS: 0 };

interface RenderAppOptions {
  registrationEnabled?: boolean;
}

function createNoContentResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: async () => ({})
  } as Response;
}

function renderApp(
  initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/"],
  { registrationEnabled = true }: RenderAppOptions = {}
) {
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
            <OfflineQueueProvider timings={queueTimings}>
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
    routes.reset();
    resetConnectivityForTests();
    // Background requests use explicit routes too; successful probes must never mask offline state.
    routes.on("GET", "/api/health", () => {
      if (!navigator.onLine) throw new TypeError("Failed to fetch");
      return createNoContentResponse();
    });
    routes.on("POST", "/api/events/ticket", () => {
      if (!navigator.onLine) throw new TypeError("Failed to fetch");
      return { json: async () => ({ ticket: "ticket-test" }) };
    });
    routes.on("POST", /^\/api\/lists\/[^/]+\/mark-viewed$/, createNoContentResponse);
    routes.on("GET", "/api/push/vapid-public-key", () => ({ json: async () => ({ publicKey: "dGVzdA" }) }));
    routes.on("GET", "/api/auth/api-key", () => ({ json: async () => ({ has_key: false, hint: null, created_at: null }) }));
    vi.stubGlobal("fetch", fetch);
    stubMatchMedia();
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.mocked(ensureServiceWorker).mockImplementation(() => navigator.serviceWorker.ready);
    vi.stubGlobal("PushManager", class {});
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
              const subscription = {
                endpoint: "https://push.example.com/subscriptions/1",
                keys: {
                  p256dh: "p256dh-key",
                  auth: "auth-key"
                },
                async unsubscribe() {
                  return true;
                },
                toJSON(): PushSubscriptionJSON {
                  return {
                    endpoint: subscription.endpoint,
                    keys: subscription.keys
                  };
                }
              };
              return subscription;
            }
          }
        })
      }
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
    await i18next.changeLanguage("en");
    await resetOfflineStateForTests();
    setNavigatorOnline(true);
  });

  afterEach(() => {
    cleanup();
    resetConnectivityForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    routes.assertAllMatched();
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
    routes.on("POST", "/api/auth/login", () => ({
      ok: true,
      json: async () => ({
        token: createFakeJwt("user-123"),
        user: createAuthUser("user-123")
      })
    }));
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
      })
    }));

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
  }, 10000);

  it("redirects an expired protected session to login and returns to the original page after re-login", async () => {
    seedAuthSession("user-1");
    let didRejectExpiredSession = false;

    routes.on("POST", "/api/auth/login", () => {
      return {
        ok: true,
        json: async () => ({
          token: createFakeJwt("user-1"),
          user: createAuthUser("user-1")
        })
      };
    });
    routes.on("GET", "/api/lists/list-1", () => {
      if (!didRejectExpiredSession) {
        didRejectExpiredSession = true;
        return {
          ok: false,
          status: 401,
          json: async () => ({ error: "jwt expired" })
        };
      }
      return {
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
        })
      };
    });
    routes.on("GET", "/api/lists/list-1/entries", () => {
      return {
        ok: true,
        json: async () => ({ entries: [] })
      };
    });
    routes.on("GET", "/api/lists/list-1/history", () => {
      return {
        ok: true,
        json: async () => ({ history: [] })
      };
    });
    routes.on("GET", "/api/lists/list-1/members", () => {
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
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.getByText("Your session has expired. Please sign in again.")).toBeTruthy();
    expect(screen.queryByText("Mission Failed")).toBeNull();
    expect(window.localStorage.getItem("endgame_grocery.auth_token")).toBeNull();

    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Weekly groceries", {}, { timeout: 8000 })).toBeTruthy();
  }, 20000);

  it("keeps wrong login credentials on the login page without a session-expired banner", async () => {
    routes.on("POST", "/api/auth/login", () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials." })
    }));

    renderApp(["/login"]);

    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Invalid credentials.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeTruthy();
    expect(screen.queryByText("Your session has expired. Please sign in again.")).toBeNull();
  });

  it("does not render bottom navigation in either the protected shell or auth pages", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));

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
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));

    renderApp(["/search"]);

    expect(await screen.findByText("Create your first mission to get started.")).toBeTruthy();
    expect(screen.queryByLabelText("Primary navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Search" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lists" })).toBeNull();
  });

  it("submits the register form and redirects to email verification", async () => {
    routes.on("POST", "/api/auth/register", () => ({
      ok: true,
      json: async () => ({ message: "Verification email sent." })
    }));

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
    routes.on("POST", "/api/auth/register", () => ({
      ok: true,
      json: async () => ({
        token: createFakeJwt("user-5"),
        listId: "list-1",
        user: createAuthUser("user-5")
      })
    }));
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({ history: [] })
    }));
    routes.on("GET", "/api/push/vapid-public-key", () => ({
      ok: true,
      json: async () => ({ publicKey: "dGVzdA" })
    }));

    routes.on("GET", "/api/lists", () => ({
      json: async () => ({ lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }] })
    }));

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
    routes.on("GET", "/api/auth/verify-email?token=valid-token", () => ({
      ok: true,
      json: async () => ({
        token: createFakeJwt("user-1"),
        user: createAuthUser("user-1")
      })
    }));
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));

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
    routes.on("POST", "/api/auth/login", () => ({
      ok: true,
      json: async () => ({
        token: createFakeJwt("user-1"),
        user: createAuthUser("user-1")
      })
    }));
    routes.on("GET", "/api/invites/invite-token-1", () => ({
      ok: true,
      json: async () => ({ listId: "list-1" })
    }));
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Alex", is_owner: false }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({ history: [] })
    }));
    routes.on("GET", "/api/push/vapid-public-key", () => ({
      ok: true,
      json: async () => ({ publicKey: "dGVzdA" })
    }));

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
    routes.on("GET", "/api/auth/verify-email?token=expired-token", () => ({
      ok: false,
      json: async () => ({ error: "Verification link is invalid or has expired." })
    }));

    renderApp(["/verify-email?token=expired-token"]);

    expect(await screen.findByText("Verification link is invalid or has expired.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resend verification email" })).toBeTruthy();
  });

  it("resends the verification email from the public verify page", async () => {
    routes.on("POST", "/api/auth/resend-verification", () => ({
      ok: true,
      json: async () => ({ message: "If your account is pending verification, a new email has been sent." })
    }));

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
    routes.on("POST", "/api/auth/forgot-password", () => ({
      ok: true,
      json: async () => ({ message: "If an account exists, you will receive an email." })
    }));

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
    routes.on("POST", "/api/auth/reset-password", () => ({
      ok: false,
      json: async () => ({ error: "Password reset link is invalid or has expired." })
    }));

    renderApp(["/reset-password?token=expired-reset"]);

    // Signed-out pages are lazy chunks.
    await userEvent.type(await screen.findByLabelText("New password"), "new-password-123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByText("Password reset link is invalid or has expired.")).toBeTruthy();
  });

  it("submits a new password and returns to login with a success message", async () => {
    routes.on("POST", "/api/auth/reset-password", () => ({
      ok: true,
      json: async () => ({ message: "Password updated." })
    }));

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
    expect(screen.getByText(/^Password updated\. You were signed out on all other devices and your API key was removed.*Please log in with your new password\.$/)).toBeTruthy();
  });

  it("creates, renames, and deletes a list from the overview", async () => {
    seedAuthSession("user-1");
    vi.stubGlobal("confirm", vi.fn(() => true));
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));
    routes.on("POST", "/api/lists", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekend groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("PATCH", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Renamed list", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("DELETE", "/api/lists/list-1", () => ({
      status: 204
    }));

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

    let rejectFetch: (reason?: unknown) => void = () => undefined;
    routes.on("GET", "/api/lists", () => (new Promise<FetchReply>((_, reject) => {
      rejectFetch = reject;
    })));

    renderApp(["/"]);

    expect(await screen.findByLabelText("Loading")).toBeTruthy();

    rejectFetch(new Error("Boom"));

    expect(await screen.findByText("Mission Failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("keeps forbidden overview errors in the existing error UI", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists", () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden." })
    }));

    renderApp(["/"]);

    expect(await screen.findByText("Mission Failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome Back" })).toBeNull();
  });

  it("removes the overview toggle buttons and stat chips", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
      })
    }));

    renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Active" })).toBeNull();
    expect(screen.queryByRole("button", { name: "All Lists" })).toBeNull();
    expect(screen.queryByText("1 list")).toBeNull();
    expect(screen.queryByText("1 lists")).toBeNull();
    expect(screen.queryByText(/shared/i)).toBeNull();
  });

  it("opens the overview info sheet and logs out from it", async () => {
    routes.on("POST", "/api/auth/login", () => ({
      ok: true,
      json: async () => ({
        token: createFakeJwt("user-1"),
        user: {
          id: "user-1",
          display_name: "Demo User",
          email: "demo@example.com"
        }
      })
    }));
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));

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
    expect(JSON.parse(window.localStorage.getItem("endgame_grocery.auth_user")!)).toEqual({
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
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({ lists: [] })
    }));

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
    routes.on("GET", "/api/auth/me", () => {
      return {
        ok: true,
        json: async () => ({
          id: "user-1",
          display_name: "Demo User",
          email: "demo@example.com"
        })
      };
    });
    routes.on("GET", "/api/lists", () => {
      return {
        ok: true,
        json: async () => ({ lists: [] })
      };
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
    expect(JSON.parse(window.localStorage.getItem("endgame_grocery.auth_user")!)).toEqual({
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    });
  });

  it("shows a shared badge in the overview with the owner name", async () => {
    seedAuthSession("user-2");
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-2", name: "BBQ party", owner_name: "Alex", is_owner: false }]
      })
    }));

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

    routes.on("GET", "/api/lists", () => {
      const lists = listResponses[Math.min(listRequestCount, listResponses.length - 1)];
      listRequestCount += 1;
      return {
        ok: true,
        json: async () => ({ lists })
      };
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

  it("shows recently used items, re-adds them, and dismisses history from list detail", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
      ok: true,
      json: async () => ({
        entries: [
          { id: "entry-1", text: "Milk", status: "open", icon: "IconMilk", created_at: "2026-04-21T00:00:00Z" }
        ]
      })
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({
        history: [
          { text: "Tomatoes", icon: "IconSalad" },
          { text: "Bread", icon: "IconBread" }
        ]
      })
    }));
    routes.on("GET", "/api/lists/list-1/members", () => ({
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
    }));
    routes.on("POST", "/api/lists/list-1/entries", () => ({
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
    }));
    routes.on("DELETE", "/api/lists/list-1/history", () => ({
      ok: true,
      status: 204,
      json: async () => ({})
    }));

    routes.on("GET", /^\/api\/lists\/list-1\/suggestions\?/, () => ({ json: async () => ({ suggestions: [] }) }));

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
    expect(within(recentlyUsedSection).getByRole("button", { name: "Dismiss Bread" })).toBeTruthy();

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
    expect(within(recentlyUsedSection).getByText("Bread")).toBeTruthy();

    await userEvent.click(within(recentlyUsedSection).getByRole("button", { name: "Dismiss Bread" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/lists/list-1/history",
        expect.objectContaining({
          body: JSON.stringify({ text: "Bread" }),
          method: "DELETE"
        })
      );
      expect(screen.queryByRole("region", { name: "Recently Used" })).toBeNull();
    });
  });

  it("adds completed items to recently used and keeps newest history first", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
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
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({
        history: [{ text: "Bread", icon: "IconBread" }]
      })
    }));
    routes.on("GET", "/api/lists/list-1/members", () => ({
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
    }));
    routes.on("PATCH", "/api/lists/list-1/entries/entry-1", () => ({
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
    }));
    routes.on("PATCH", "/api/lists/list-1/entries/entry-2", () => ({
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
    }));

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
  }, 20000);

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
    const historyResponses = [
      [{ text: "Tomatoes", icon: "IconSalad" }],
      [{ text: "Tomatoes", icon: "IconSalad" }],
      [{ text: "Tomatoes", icon: "IconSalad" }],
      [{ text: "Tomatoes", icon: "IconSalad" }],
      []
    ];
    let entryRequestCount = 0;
    let historyRequestCount = 0;
    let memberRequestCount = 0;

    routes.on("GET", "/api/lists/list-1", () => {
      return {
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
        })
      };
    });
    routes.on("GET", "/api/lists/list-1/entries", () => {
      const entries = entryResponses[Math.min(entryRequestCount, entryResponses.length - 1)];
      entryRequestCount += 1;
      return {
        ok: true,
        json: async () => ({ entries })
      };
    });
    routes.on("GET", "/api/lists/list-1/history", () => {
      const history = historyResponses[Math.min(historyRequestCount, historyResponses.length - 1)];
      historyRequestCount += 1;
      return {
        ok: true,
        json: async () => ({ history })
      };
    });
    routes.on("GET", "/api/lists/list-1/members", () => {
      const members = memberResponses[Math.min(memberRequestCount, memberResponses.length - 1)];
      memberRequestCount += 1;
      return {
        ok: true,
        json: async () => ({ members })
      };
    });
    routes.on("GET", "/api/push/vapid-public-key", () => {
      return {
        ok: true,
        json: async () => ({ publicKey: "dGVzdA" })
      };
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(await screen.findByText("Milk")).toBeTruthy();
    expect(await screen.findByText("Tomatoes")).toBeTruthy();
    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    await userEvent.click(await screen.findByRole("button", { name: "List options" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Share list/ }));
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

    const historyRequestsBeforeHistoryEvent = fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/history")
      .length;
    MockEventSource.instances[0].emit("history:updated", { listId: "list-1" });
    await waitFor(() => {
      expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/history")).toHaveLength(
        historyRequestsBeforeHistoryEvent + 1
      );
      expect(screen.queryByText("Tomatoes")).toBeNull();
    });

    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1")).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/entries")).toHaveLength(4);
    expect(fetch.mock.calls.filter(([url]) => url === "/api/lists/list-1/members")).toHaveLength(3);
  }, 10000);

  it("adds and edits entry details from the list detail sheet", async () => {
    seedAuthSession("user-1");

    routes.on("GET", /^\/api\/lists\/list-1\/suggestions\?/, () => {
      return {
        ok: true,
        json: async () => ({
          suggestions: []
        })
      };
    });
    routes.on("GET", "/api/lists/list-1", () => {
      return {
        ok: true,
        json: async () => ({
          list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
        })
      };
    });
    routes.on("GET", "/api/lists/list-1/entries", () => {
      return {
        ok: true,
        json: async () => ({
          entries: [
            { id: "entry-1", text: "X", status: "open", icon: null, details: "2L", created_at: "2026-04-21T00:00:00Z" }
          ]
        })
      };
    });
    routes.on("GET", "/api/lists/list-1/history", () => {
      return {
        ok: true,
        json: async () => ({
          history: []
        })
      };
    });
    routes.on("GET", "/api/lists/list-1/members", () => {
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
    });
    routes.on("POST", "/api/lists/list-1/entries", (_input, init) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ text: "Milk", details: "500 g" });
      return {
        ok: true,
        json: async () => ({
          entry: {
            id: "entry-2",
            text: "Milk",
            status: "open",
            icon: null,
            details: "500 g",
            created_at: "2026-04-21T00:01:00Z"
          }
        })
      };
    });
    routes.on("PATCH", "/api/lists/list-1/entries/entry-1", (_input, init) => {
      expect(JSON.parse(String(init.body))).toMatchObject({ text: "X", details: "3L" });
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
    });

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("2L")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    const addDialog = await screen.findByRole("dialog", { name: "Add Item" });
    // The sheet resets its fields in an effect whenever it opens. On a slow runner that effect can run
    // after the first change event, so re-apply the values until they stick before submitting.
    await waitFor(() => {
      fireEvent.change(within(addDialog).getByLabelText("Add item"), { target: { value: "Milk" } });
      fireEvent.change(within(addDialog).getByLabelText("Details (optional)"), { target: { value: "500 g" } });

      expect((within(addDialog).getByLabelText("Add item") as HTMLInputElement).value).toBe("Milk");
      expect((within(addDialog).getByLabelText("Details (optional)") as HTMLInputElement).value).toBe("500 g");
    });
    await userEvent.click(within(addDialog).getByRole("button", { name: "Add Item" }));

    await waitFor(() => {
      const addCall = fetch.mock.calls.find(
        ([url, init]) => url === "/api/lists/list-1/entries" && init?.method === "POST"
      );

      expect(addCall).toBeTruthy();
      expect(JSON.parse(String(addCall?.[1]?.body))).toMatchObject({ text: "Milk", details: "500 g" });
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
    expect((editDetailsInput as HTMLInputElement).value).toBe("2L");

    fireEvent.change(editDetailsInput, { target: { value: "3L" } });
    fireEvent.submit(editDialog.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      const editCall = fetch.mock.calls.find(
        ([url, init]) => url === "/api/lists/list-1/entries/entry-1" && init?.method === "PATCH"
      );

      expect(editCall).toBeTruthy();
      expect(JSON.parse(String(editCall?.[1]?.body))).toMatchObject({ text: "X", details: "3L" });
    });
    await waitFor(() => {
      expect(screen.getByText("3L")).toBeTruthy();
      expect(screen.queryByText("2L")).toBeNull();
    });
  }, 20000);

  it("opens the share sheet, sends an invite notice, and revokes an existing member", async () => {
    seedAuthSession("user-1");
    const inviteRequest = createDeferred<FetchReply>();
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
      ok: true,
      json: async () => ({
        entries: []
      })
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({
        history: []
      })
    }));
    routes.on("POST", "/api/lists/list-1/mark-viewed", () => (createNoContentResponse()));
    routes.on("GET", "/api/lists/list-1/members", () => ({
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
    }));
    routes.on("GET", "/api/push/vapid-public-key", () => ({
      ok: true,
      json: async () => ({ publicKey: "dGVzdA" })
    }));
    routes.on("POST", "/api/lists/list-1/members", () => (inviteRequest.promise));
    routes.on("DELETE", "/api/lists/list-1/members/user-2", () => ({
      status: 204
    }));

    renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "List options" }));
    expect(await screen.findByRole("dialog", { name: "List Options" })).toBeTruthy();
    await userEvent.click(await screen.findByRole("button", { name: /^Share list/ }));

    expect(await screen.findByRole("dialog", { name: "Share List" })).toBeTruthy();
    expect(screen.getByText("SQUAD (2)")).toBeTruthy();
    expect(screen.getByText("Alex Brown")).toBeTruthy();
    expect(screen.getByTitle("Alex Brown")).toBeTruthy();
    expect(screen.getByText("AB")).toBeTruthy();

    await userEvent.type(screen.getByLabelText("Invite member by email"), "sam@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send Invite" }));
    expect(screen.getByRole("button", { name: "Send Invite" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("share-invite-spinner")).toBeTruthy();

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
  }, 20000);

  it("shows the notifications toggle only for shared lists", async () => {
    seedAuthSession("user-1");

    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Solo groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({ history: [] })
    }));
    routes.on("POST", "/api/lists/list-1/mark-viewed", () => (createNoContentResponse()));
    routes.on("GET", "/api/lists/list-1/members", () => ({
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
    }));

    const rendered = renderApp(["/lists/list-1"]);

    expect(await screen.findByText("Solo groceries")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enable notifications" })).toBeNull();

    rendered.unmount();
    fetch.mockClear();
    const deferredVapidResponse = createDeferred<FetchReply>();

    routes.on("GET", "/api/lists/list-2", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-2", name: "BBQ party", owner_name: "Alex", is_owner: false }
      })
    }));
    routes.on("GET", "/api/lists/list-2/entries", () => ({
      ok: true,
      json: async () => ({ entries: [] })
    }));
    routes.on("GET", "/api/lists/list-2/history", () => ({
      ok: true,
      json: async () => ({ history: [] })
    }));
    routes.on("POST", "/api/lists/list-2/mark-viewed", () => (createNoContentResponse()));
    routes.on("GET", "/api/push/vapid-public-key", () => (deferredVapidResponse.promise));

    renderApp(["/lists/list-2"]);

    expect(await screen.findByText("BBQ party")).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Enable notifications" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enable notifications" }).hasAttribute("disabled")).toBe(true);

    deferredVapidResponse.resolve({
      ok: true,
      json: async () => ({ publicKey: "dGVzdA" })
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Enable notifications" }).hasAttribute("disabled")).toBe(
        false
      );
    });
  });

  it.each(["en", "de"])("localizes notification failures and retries on the shared list (%s)", async (language) => {
    seedAuthSession("user-1");
    await i18next.changeLanguage(language);
    routes.on("GET", "/api/lists/list-2", () => ({ json: async () => ({ list: { id: "list-2", name: "Shared groceries", owner_name: "Alex", is_owner: false } }) }));
    routes.on("GET", "/api/lists/list-2/entries", () => ({ json: async () => ({ entries: [] }) }));
    routes.on("GET", "/api/lists/list-2/history", () => ({ json: async () => ({ history: [] }) }));
    routes.on("POST", "/api/push/subscribe", createNoContentResponse);
    vi.mocked(ensureServiceWorker).mockRejectedValue(new Error("workerRegistration"));
    renderApp(["/lists/list-2"]);
    const action = await screen.findByRole("button", { name: i18next.t("detail.notificationsOn") });
    const feedback = i18next.t("detail.pushErrors.workerRegistration");
    expect(feedback).toContain(language === "en" ? "could not register" : "konnte nicht registriert");
    await screen.findByText(feedback);
    await userEvent.click(action);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", i18next.t("detail.pushErrors.workerRegistration"));
    vi.mocked(ensureServiceWorker).mockImplementation(() => navigator.serviceWorker.ready);
    await userEvent.click(action);
    expect(await screen.findByRole("button", { name: i18next.t("detail.notificationsOff") })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the redesigned list detail loading and error states", async () => {
    seedAuthSession("user-1");

    let rejectFetch: (reason?: unknown) => void = () => undefined;
    routes.on("GET", "/api/lists/list-1", () => ({
      ok: true,
      json: async () => ({
        list: { id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }
      })
    }));
    routes.on("GET", "/api/lists/list-1/entries", () => (new Promise<FetchReply>((_, reject) => {
      rejectFetch = reject;
    })));
    routes.on("GET", "/api/lists/list-1/history", () => ({
      ok: true,
      json: async () => ({
        history: []
      })
    }));

    renderApp(["/lists/list-1"]);

    expect(await screen.findByLabelText("Loading")).toBeTruthy();

    rejectFetch(new Error("Load failed"));

    expect(await screen.findByText("Load failed")).toBeTruthy();
  });

  it("shows cached lists while offline and displays the offline banner", async () => {
    seedAuthSession("user-1");
    routes.on("GET", "/api/lists", () => ({
      ok: true,
      json: async () => ({
        lists: [{ id: "list-1", name: "Weekly groceries", owner_name: "Demo User", is_owner: true }]
      })
    }));

    const rendered = renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();

    rendered.unmount();
    routes.on("GET", "/api/lists", () => { throw new TypeError("Failed to fetch"); });
    setNavigatorOnline(false);

    renderApp(["/"]);

    expect(await screen.findByText("Weekly groceries")).toBeTruthy();
    expect(screen.getByText("Offline mode: cached data is available.")).toBeTruthy();
  });

  it("queues offline writes and refreshes after reconnect", async () => {
    seedAuthSession("user-1");
    vi.stubGlobal("confirm", vi.fn(() => true));
    let createdList = false;
    const list = { id: "list-99", name: "Queued list", owner_name: "Demo User", is_owner: true };
    routes.on("GET", "/api/lists", () => ({ json: async () => ({ lists: createdList ? [list] : [] }) }));
    routes.on("POST", "/api/lists", () => {
      if (!navigator.onLine) throw new TypeError("Failed to fetch");
      createdList = true;
      return { json: async () => ({ list }) };
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

function createFakeJwt(sub: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub }));

  return `${header}.${payload}.signature`;
}

interface AuthUserOverrides {
  display_name?: string;
  email?: string;
}

function createAuthUser(sub: string, overrides: AuthUserOverrides = {}) {
  return {
    id: sub,
    display_name: overrides.display_name ?? "Demo User",
    email: overrides.email ?? `${sub}@example.com`
  };
}

function seedAuthSession(sub: string, overrides: AuthUserOverrides = {}): void {
  window.localStorage.setItem("endgame_grocery.auth_token", createFakeJwt(sub));
  window.localStorage.setItem(
    "endgame_grocery.auth_user",
    JSON.stringify(createAuthUser(sub, overrides))
  );
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

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}

function stubMatchMedia({ reduced = false }: { reduced?: boolean } = {}): void {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
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
  static instances: MockEventSource[] = [];

  url: string;
  readyState: number;
  listeners: Map<string, Set<(event: MessageEvent<string>) => void>>;
  close: ReturnType<typeof vi.fn>;
  onerror: ((event: Event) => void) | null;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockEventSource.OPEN;
    this.listeners = new Map();
    this.close = vi.fn(() => {
      this.readyState = MockEventSource.CLOSED;
    });
    this.onerror = null;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)?.add(handler);
  }

  removeEventListener(type: string, handler: (event: MessageEvent<string>) => void) {
    this.listeners.get(type)?.delete(handler);
  }

  emit(type: string, data: Record<string, unknown>) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(new MessageEvent(type, { data: JSON.stringify(data) }));
    }
  }
}
