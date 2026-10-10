import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Fragment, StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../../i18n";
import { ApiError } from "../../api/errors";
import { acceptInvite } from "../../api/sharing";
import { useAuth } from "../../context/AuthContext";
import InviteAcceptPage from "./InviteAcceptPage";

vi.mock("../../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../../api/sharing", () => ({ acceptInvite: vi.fn() }));

const useAuthMock = vi.mocked(useAuth);
const acceptInviteMock = vi.mocked(acceptInvite);
const logout = vi.fn();

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function PageHarness({ strict = false }: { strict?: boolean }) {
  const Wrapper = strict ? StrictMode : Fragment;
  return (
    <Wrapper>
      <MemoryRouter initialEntries={["/invite/tok-1"]}>
        <Routes>
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
          <Route path="*" element={null} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </Wrapper>
  );
}

function renderPage(strict = false) {
  return render(<PageHarness strict={strict} />);
}

beforeEach(async () => {
  vi.resetAllMocks();
  await i18next.changeLanguage("en");
  useAuthMock.mockReturnValue({
    token: "jwt",
    user: { id: "u1", email: "me@example.com", display_name: "Me" },
    login: vi.fn(),
    register: vi.fn(),
    logout,
    setAuthToken: vi.fn()
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("InviteAcceptPage", () => {
  it("accepts a single-use invite once when StrictMode replays the effect", async () => {
    acceptInviteMock.mockResolvedValueOnce({ listId: "list-7" })
      .mockRejectedValueOnce(new ApiError("Invitation link is invalid or has expired.", 400));
    renderPage(true);
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/lists/list-7"));
    expect(acceptInviteMock).toHaveBeenCalledExactlyOnceWith("tok-1", "jwt");
  });

  it("keeps the pending acceptance when the language changes", async () => {
    let finish!: (value: { listId: string }) => void;
    acceptInviteMock.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    renderPage();
    await act(async () => { await i18next.changeLanguage("de"); });
    expect(acceptInviteMock).toHaveBeenCalledExactlyOnceWith("tok-1", "jwt");
    await act(async () => finish({ listId: "list-7" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/lists/list-7"));
  });

  it("starts a new acceptance when the signed-in session changes", async () => {
    acceptInviteMock.mockRejectedValueOnce(new ApiError("Wrong account", 403, "invite.email_mismatch"));
    const view = renderPage();
    expect(await screen.findByText(/sent to a different email address/i)).toBeTruthy();
    useAuthMock.mockReturnValue({ ...useAuthMock(), token: "invitee-session" });
    acceptInviteMock.mockResolvedValueOnce({ listId: "list-7" });
    view.rerender(<PageHarness />);
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/lists/list-7"));
    expect(acceptInviteMock.mock.calls).toEqual([["tok-1", "jwt"], ["tok-1", "invitee-session"]]);
  });

  it("sends signed-out visitors to login with the invite return path without accepting", async () => {
    useAuthMock.mockReturnValue({ ...useAuthMock(), token: "", user: null });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("location").textContent)
      .toBe("/login?redirect=%2Finvite%2Ftok-1"));
    expect(acceptInviteMock).not.toHaveBeenCalled();
  });

  it("keeps the joining page visible while acceptance is pending", async () => {
    acceptInviteMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(i18next.t("invite.joining"))).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/invite/tok-1");
    expect(acceptInviteMock).toHaveBeenCalledExactlyOnceWith("tok-1", "jwt");
  });

  it("opens the list after a successful acceptance", async () => {
    acceptInviteMock.mockResolvedValue({ listId: "list-7" });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/lists/list-7"));
    expect(acceptInviteMock).toHaveBeenCalledWith("tok-1", "jwt");
  });

  it("explains a 403 with the signed-in email and offers to switch accounts", async () => {
    acceptInviteMock.mockRejectedValue(new ApiError("This invitation was sent to a different email address.", 403, "invite.email_mismatch"));

    renderPage();

    expect(await screen.findByText(/sent to a different email address/i)).toBeTruthy();
    expect(screen.getByText("You are signed in as me@example.com.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sign out and switch account" }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("shows a translated notice when the user already owns the list", async () => {
    acceptInviteMock.mockRejectedValue(new ApiError("You already own this list.", 409, "invite.owner_cannot_accept"));

    renderPage();

    expect(await screen.findByText("You already own this list.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out and switch account" })).toBeNull();
  });

  it("shows the German message for a mismatched account", async () => {
    await i18next.changeLanguage("de");
    acceptInviteMock.mockRejectedValue(new ApiError("This invitation was sent to a different email address.", 403, "invite.email_mismatch"));

    renderPage();

    expect(await screen.findByText(/an eine andere E-Mail-Adresse gesendet/i)).toBeTruthy();
  });

  it("shows the server message for other failures", async () => {
    acceptInviteMock.mockRejectedValue(new ApiError("Invitation link is invalid or has expired.", 400));

    renderPage();

    expect(await screen.findByText("Invitation link is invalid or has expired.")).toBeTruthy();
  });
});
