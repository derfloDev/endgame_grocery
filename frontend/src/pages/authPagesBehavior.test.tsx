import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../i18n";
import { forgotPassword, resendVerification, resetPassword, verifyEmail } from "../api/auth";
import { ApiError } from "../api/errors";
import { useAuth } from "../context/AuthContext";
import { useAppConfig } from "../context/appConfigState";
import LoginPage from "./LoginPage/LoginPage";
import RegisterPage from "./RegisterPage/RegisterPage";
import ForgotPasswordPage from "./ForgotPasswordPage/ForgotPasswordPage";
import ResetPasswordPage from "./ResetPasswordPage/ResetPasswordPage";
import VerifyEmailPage from "./VerifyEmailPage/VerifyEmailPage";

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/appConfigState", () => ({ useAppConfig: vi.fn() }));
vi.mock("../api/auth", () => ({
  forgotPassword: vi.fn(), resendVerification: vi.fn(), resetPassword: vi.fn(), verifyEmail: vi.fn()
}));

const account = { id: "user-1", display_name: "Alex", email: "alex@example.com" };
let auth: ReturnType<typeof useAuth>;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{JSON.stringify({ path: location.pathname, state: location.state })}</output>;
}

function renderPage(path: string, state?: unknown) {
  const [pathname, query = ""] = path.split("?");
  return render(
    <MemoryRouter initialEntries={[{ pathname, search: query ? `?${query}` : "", state }]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

function location() {
  return JSON.parse(screen.getByTestId("location").textContent ?? "{}");
}

async function register() {
  await userEvent.type(screen.getByLabelText("Display name"), "Alex");
  await userEvent.type(screen.getByLabelText("Email"), account.email);
  await userEvent.type(screen.getByLabelText("Password"), "password123");
  await userEvent.click(screen.getByRole("button", { name: /create account/i }));
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18next.changeLanguage("en");
  window.sessionStorage.clear();
  auth = {
    token: "", user: null, login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue({}), logout: vi.fn(), setAuthToken: vi.fn()
  };
  vi.mocked(useAuth).mockReturnValue(auth);
  vi.mocked(useAppConfig).mockReturnValue({ registrationEnabled: true } as ReturnType<typeof useAppConfig>);
});

afterEach(cleanup);

describe("LoginPage submission", () => {
  it("submits credentials once while pending, then follows the router-state destination", async () => {
    let finish!: (value: Awaited<ReturnType<typeof auth.login>>) => void;
    vi.mocked(auth.login).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage("/login", { from: "/lists/list-7" });
    await userEvent.type(screen.getByLabelText("Email"), account.email);
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: /log in/i }));
    const button = screen.getByRole("button", { name: /signing in/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(auth.login).toHaveBeenCalledExactlyOnceWith({ email: account.email, password: "password123" });
    await act(async () => finish({ token: "session", user: account }));
    await waitFor(() => expect(location().path).toBe("/lists/list-7"));
  });
});

describe("RegisterPage invitations", () => {
  it("passes the invite token, stores the returned session and opens the shared list", async () => {
    vi.mocked(auth.register).mockResolvedValue({ token: "new-session", user: account, listId: "list-7" });
    renderPage("/register?invite=invite-7");
    await register();
    expect(auth.register).toHaveBeenCalledExactlyOnceWith({
      display_name: "Alex", email: account.email, password: "password123", invite_token: "invite-7"
    });
    expect(auth.setAuthToken).toHaveBeenCalledWith("new-session", account);
    await waitFor(() => expect(location().path).toBe("/lists/list-7"));
  });

  it("sends ordinary registration to verification with the submitted email", async () => {
    renderPage("/register");
    await register();
    expect(auth.register).toHaveBeenCalledExactlyOnceWith({
      display_name: "Alex", email: account.email, password: "password123"
    });
    expect(location()).toEqual({ path: "/verify-email", state: { email: account.email } });
    expect(auth.setAuthToken).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(account.email);
  });

  it("keeps an unsuccessful invite registration on the form with the error", async () => {
    vi.mocked(auth.register).mockRejectedValue(new ApiError("Already registered", 409, "auth.email_taken"));
    renderPage("/register?invite=invite-7");
    await register();
    expect(await screen.findByText(i18next.t("errors.auth.email_taken"))).toBeTruthy();
    expect(location().path).toBe("/register");
    expect(auth.setAuthToken).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: /create account/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("ForgotPasswordPage", () => {
  it("submits the email once while pending and shows the generic success notice", async () => {
    let finish!: (value: { message: string }) => void;
    vi.mocked(forgotPassword).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage("/forgot-password");
    await userEvent.type(screen.getByLabelText("Email"), account.email);
    await userEvent.click(screen.getByRole("button", { name: /send reset/i }));
    const button = screen.getByRole("button", { name: /sending/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(forgotPassword).toHaveBeenCalledExactlyOnceWith(account.email);
    await act(async () => finish({ message: "Do not expose whether the account exists" }));
    expect(await screen.findByText(i18next.t("auth.resetSuccess"))).toBeTruthy();
    expect((screen.getByRole("button", { name: /send reset/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows a failed request and allows another attempt", async () => {
    vi.mocked(forgotPassword).mockRejectedValue(new Error("Mail request failed"));
    renderPage("/forgot-password");
    await userEvent.type(screen.getByLabelText("Email"), account.email);
    await userEvent.click(screen.getByRole("button", { name: /send reset/i }));
    expect(await screen.findByText("Mail request failed")).toBeTruthy();
    vi.mocked(forgotPassword).mockResolvedValue({ message: "ok" });
    await userEvent.click(screen.getByRole("button", { name: /send reset/i }));
    expect(await screen.findByText(i18next.t("auth.resetSuccess"))).toBeTruthy();
    expect(screen.queryByText("Mail request failed")).toBeNull();
    expect(forgotPassword).toHaveBeenCalledTimes(2);
  });
});

describe("ResetPasswordPage", () => {
  it("does not submit without a reset token", async () => {
    renderPage("/reset-password");
    expect(screen.getByText(i18next.t("auth.resetTokenRequired"))).toBeTruthy();
    await userEvent.type(screen.getByLabelText("New password"), "new-password123");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(resetPassword).not.toHaveBeenCalled();
    expect(location().path).toBe("/reset-password");
  });

  it("sends the new password and token and redirects to login with the sign-out notice", async () => {
    vi.mocked(resetPassword).mockResolvedValue({ message: "ok" });
    renderPage("/reset-password?token=reset-7");
    await userEvent.type(screen.getByLabelText("New password"), "new-password123");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(resetPassword).toHaveBeenCalledExactlyOnceWith("reset-7", "new-password123");
    expect(location()).toEqual({ path: "/login", state: { message: i18next.t("auth.passwordUpdatedLogin") } });
    expect(screen.getByText(i18next.t("auth.passwordUpdatedLogin"))).toBeTruthy();
  });

  it("shows a rejected reset token without navigating", async () => {
    vi.mocked(resetPassword).mockRejectedValue(new Error("Reset link expired"));
    renderPage("/reset-password?token=expired");
    await userEvent.type(screen.getByLabelText("New password"), "new-password123");
    await userEvent.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText("Reset link expired")).toBeTruthy();
    expect(location().path).toBe("/reset-password");
    expect((screen.getByRole("button", { name: /update password/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("VerifyEmailPage", () => {
  it("verifies the URL token, stores the session and opens the overview", async () => {
    vi.mocked(verifyEmail).mockResolvedValue({ token: "verified-session", user: account });
    renderPage("/verify-email?token=verify-7");
    await waitFor(() => expect(location().path).toBe("/"));
    expect(verifyEmail).toHaveBeenCalledExactlyOnceWith("verify-7");
    expect(auth.setAuthToken).toHaveBeenCalledExactlyOnceWith("verified-session", account);
  });

  it("shows verification failure without creating a session", async () => {
    vi.mocked(verifyEmail).mockRejectedValue(new Error("Verification link expired"));
    renderPage("/verify-email?token=expired");
    expect(await screen.findByText("Verification link expired")).toBeTruthy();
    expect(auth.setAuthToken).not.toHaveBeenCalled();
    expect(location().path).toBe("/verify-email");
  });

  it("does not update the session after the verification page unmounts", async () => {
    let finish!: (value: { token: string; user: typeof account }) => void;
    vi.mocked(verifyEmail).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const view = renderPage("/verify-email?token=verify-7");
    view.unmount();
    await act(async () => finish({ token: "late-session", user: account }));
    expect(auth.setAuthToken).not.toHaveBeenCalled();
  });

  it("requires an email before resending verification", async () => {
    renderPage("/verify-email");
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(screen.getByText(i18next.t("auth.emailRequired"))).toBeTruthy();
    expect(resendVerification).not.toHaveBeenCalled();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it("resends to the registration email and reports success", async () => {
    vi.mocked(resendVerification).mockResolvedValue({ message: "ok" });
    renderPage("/verify-email", { email: account.email });
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(resendVerification).toHaveBeenCalledExactlyOnceWith(account.email);
    expect(await screen.findByText(i18next.t("auth.verifySuccess"))).toBeTruthy();
  });

  it("shows a resend error and re-enables the button", async () => {
    vi.mocked(resendVerification).mockRejectedValue(new Error("Resend failed"));
    renderPage("/verify-email", { email: account.email });
    await userEvent.click(screen.getByRole("button", { name: /resend/i }));
    expect(await screen.findByText("Resend failed")).toBeTruthy();
    expect((screen.getByRole("button", { name: /resend/i }) as HTMLButtonElement).disabled).toBe(false);
  });
});
