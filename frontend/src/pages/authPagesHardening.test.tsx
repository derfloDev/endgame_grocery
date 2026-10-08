import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../i18n";
import { resetPassword } from "../api/auth";
import { useAppConfig } from "../context/appConfigState";
import { useAuth } from "../context/AuthContext";
import LoginPage from "./LoginPage/LoginPage";
import RegisterPage from "./RegisterPage/RegisterPage";
import ResetPasswordPage from "./ResetPasswordPage/ResetPasswordPage";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/appConfigState", () => ({ useAppConfig: vi.fn() }));
vi.mock("../api/auth", () => ({ resetPassword: vi.fn() }));

const useAuthMock = vi.mocked(useAuth);
const useAppConfigMock = vi.mocked(useAppConfig);
const resetPasswordMock = vi.mocked(resetPassword);

function createAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    token: "",
    user: null,
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue({}),
    logout: vi.fn(),
    setAuthToken: vi.fn(),
    ...overrides
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderAt(path: string, element: React.ReactElement, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path.split("?")[0], search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

function renderLogin(path: string, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/login", search: path.includes("?") ? `?${path.split("?")[1]}` : "", state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(async () => {
  await i18next.changeLanguage("en");
  useAppConfigMock.mockReturnValue({ registrationEnabled: true } as ReturnType<typeof useAppConfig>);
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage redirect handling", () => {
  async function signIn() {
    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
  }

  it.each([
    ["//evil.example", "/"],
    ["https://evil.example/lists", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/lists/list-1", "/lists/list-1"],
    ["/invite/abc", "/invite/abc"]
  ])("after signing in, redirect=%s lands on %s", async (redirect, expected) => {
    useAuthMock.mockReturnValue(createAuth());
    renderLogin(`/login?redirect=${encodeURIComponent(redirect)}`);

    await signIn();

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe(expected));
  });

  it("ignores an unsafe router-state origin too", async () => {
    useAuthMock.mockReturnValue(createAuth());
    renderLogin("/login", { from: "//evil.example" });

    await signIn();

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/"));
  });

  it("sends an already signed-in visitor with an unsafe redirect to /", async () => {
    useAuthMock.mockReturnValue(createAuth({ token: "jwt" }));
    renderLogin(`/login?redirect=${encodeURIComponent("//evil.example")}`);

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/"));
  });
});

describe("register password policy", () => {
  async function fillAndSubmit(password: string) {
    await userEvent.type(screen.getByLabelText("Display name"), "Demo");
    await userEvent.type(screen.getByLabelText("Email"), "demo@example.com");
    await userEvent.type(screen.getByLabelText("Password"), password);
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));
  }

  it("shows the rule next to the field", () => {
    useAuthMock.mockReturnValue(createAuth());
    renderAt("/register", <RegisterPage />);

    expect(screen.getByText(/at least 8 characters, at most 72 bytes/i)).toBeTruthy();
  });

  it.each([
    ["1234567", /at least 8 characters long/i],
    ["a".repeat(73), /too long/i],
    ["ä".repeat(37), /too long/i]
  ])("blocks %j without calling the server", async (password, message) => {
    const auth = createAuth();
    useAuthMock.mockReturnValue(auth);
    renderAt("/register", <RegisterPage />);

    await fillAndSubmit(password);

    expect((await screen.findByText(message)).className).toContain("eg-error-banner");
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("submits an acceptable password", async () => {
    const auth = createAuth();
    useAuthMock.mockReturnValue(auth);
    renderAt("/register", <RegisterPage />);

    await fillAndSubmit("password123");

    await waitFor(() => expect(auth.register).toHaveBeenCalledTimes(1));
  });
});

describe("reset password policy", () => {
  async function submit(password: string) {
    await userEvent.type(screen.getByLabelText("New password"), password);
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
  }

  it.each([
    ["short", /at least 8 characters long/i],
    ["a".repeat(73), /too long/i]
  ])("blocks %j without calling the server", async (password, message) => {
    useAuthMock.mockReturnValue(createAuth());
    renderAt("/reset-password?token=reset-1", <ResetPasswordPage />);

    await submit(password);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("submits an acceptable password with the token", async () => {
    resetPasswordMock.mockResolvedValue(undefined as never);
    useAuthMock.mockReturnValue(createAuth());
    renderAt("/reset-password?token=reset-1", <ResetPasswordPage />);

    await submit("new-password-123");

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith("reset-1", "new-password-123"));
  });

  it("shows the German rule text", async () => {
    await i18next.changeLanguage("de");
    useAuthMock.mockReturnValue(createAuth());
    renderAt("/reset-password?token=reset-1", <ResetPasswordPage />);

    expect(screen.getByText(/Mindestens 8 Zeichen/)).toBeTruthy();
  });
});
