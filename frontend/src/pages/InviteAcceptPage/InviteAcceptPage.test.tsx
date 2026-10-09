import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../../i18n";
import { HttpError } from "../../api/client";
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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/invite/tok-1"]}>
      <Routes>
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

beforeEach(async () => {
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
  it("opens the list after a successful acceptance", async () => {
    acceptInviteMock.mockResolvedValue({ listId: "list-7" });

    renderPage();

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/lists/list-7"));
    expect(acceptInviteMock).toHaveBeenCalledWith("tok-1", "jwt");
  });

  it("explains a 403 with the signed-in email and offers to switch accounts", async () => {
    acceptInviteMock.mockRejectedValue(new HttpError("This invitation was sent to a different email address.", 403));

    renderPage();

    expect(await screen.findByText(/sent to a different email address/i)).toBeTruthy();
    expect(screen.getByText("You are signed in as me@example.com.")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sign out and switch account" }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("shows a translated notice when the user already owns the list", async () => {
    acceptInviteMock.mockRejectedValue(new HttpError("You already own this list.", 409));

    renderPage();

    expect(await screen.findByText("You already own this list.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign out and switch account" })).toBeNull();
  });

  it("shows the German message for a mismatched account", async () => {
    await i18next.changeLanguage("de");
    acceptInviteMock.mockRejectedValue(new HttpError("This invitation was sent to a different email address.", 403));

    renderPage();

    expect(await screen.findByText(/an eine andere E-Mail-Adresse gesendet/i)).toBeTruthy();
  });

  it("shows the server message for other failures", async () => {
    acceptInviteMock.mockRejectedValue(new HttpError("Invitation link is invalid or has expired.", 400));

    renderPage();

    expect(await screen.findByText("Invitation link is invalid or has expired.")).toBeTruthy();
  });
});
