import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InfoSheet from "./InfoSheet";
import type { User } from "../../types";

const mockLogout = vi.fn();
let mockUser: User | null = null;

vi.mock("../../context/AuthContext", () => ({
  useAuth() {
    return {
      user: mockUser,
      logout: mockLogout
    };
  }
}));

describe("InfoSheet", () => {
  beforeEach(() => {
    mockLogout.mockReset();
    mockUser = {
      id: "user-1",
      display_name: "Demo User",
      email: "demo@example.com"
    };
    vi.stubGlobal("__APP_VERSION__", "9.9.9");
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the title, logout action, version, and GPL link when open", () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Info & Settings" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(screen.getByText("Demo User")).toBeTruthy();
    expect(screen.getByText("demo@example.com")).toBeTruthy();
    expect(screen.getByText("Version")).toBeTruthy();
    expect(screen.getByText("v9.9.9")).toBeTruthy();
    expect(screen.getByRole("link", { name: "GNU GPL v3.0" }).getAttribute("href")).toBe(
      "https://www.gnu.org/licenses/gpl-3.0.html"
    );
  });

  it("renders a Buy Me a Coffee donate link", () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(screen.getByRole("link", { name: "Buy Me a Coffee" }).getAttribute("href")).toBe(
      "https://www.buymeacoffee.com/derflodev"
    );
  });

  it("renders the user identity block before the logout action", () => {
    render(<InfoSheet open onClose={() => {}} />);

    const userName = screen.getByText("Demo User");
    const logoutButton = screen.getByRole("button", { name: "Log out" });

    expect(
      userName.compareDocumentPosition(logoutButton) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("does not render when closed", () => {
    render(<InfoSheet open={false} onClose={() => {}} />);

    expect(screen.queryByRole("dialog", { name: "Info & Settings" })).toBeNull();
  });

  it("logs out and closes when the logout button is clicked", async () => {
    const onClose = vi.fn();

    render(<InfoSheet open onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the backdrop without logging out", async () => {
    const onClose = vi.fn();

    render(<InfoSheet open onClose={onClose} />);

    await userEvent.click(screen.getByLabelText("Close sheet"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
