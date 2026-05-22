import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InfoSheet from "./InfoSheet";
import type { User } from "../../types";

const mocks = vi.hoisted(() => ({
  authState: {
    token: "",
    user: null as User | null
  },
  fetchApiKey: vi.fn(),
  logout: vi.fn(),
  regenerateApiKey: vi.fn()
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth() {
    return {
      token: mocks.authState.token,
      user: mocks.authState.user,
      logout: mocks.logout
    };
  }
}));

vi.mock("../../api/auth", () => ({
  fetchApiKey: mocks.fetchApiKey,
  regenerateApiKey: mocks.regenerateApiKey
}));

describe("InfoSheet", () => {
  beforeEach(() => {
    mocks.logout.mockReset();
    mocks.fetchApiKey.mockReset();
    mocks.fetchApiKey.mockResolvedValue({ api_key: "api-key-1" });
    mocks.regenerateApiKey.mockReset();
    mocks.regenerateApiKey.mockResolvedValue({ api_key: "api-key-2" });
    mocks.authState.token = "jwt-token";
    mocks.authState.user = {
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

  it("renders the language switcher before the user identity block", () => {
    render(<InfoSheet open onClose={() => {}} />);

    const languageSwitcher = screen.getByRole("group", { name: "Language" });
    const userName = screen.getByText("Demo User");

    expect(
      languageSwitcher.compareDocumentPosition(userName) & Node.DOCUMENT_POSITION_FOLLOWING
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

    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the backdrop without logging out", async () => {
    const onClose = vi.fn();

    render(<InfoSheet open onClose={onClose} />);

    await userEvent.click(screen.getByLabelText("Close sheet"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mocks.logout).not.toHaveBeenCalled();
  });

  it("fetches the API key when the sheet opens", async () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("api-key-1")).toBeTruthy();
    expect(mocks.fetchApiKey).toHaveBeenCalledWith("jwt-token");
  });

  it("shows the current API key and copy action", async () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("api-key-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy();
  });

  it("shows an empty state and generate action when no API key exists", async () => {
    mocks.fetchApiKey.mockResolvedValue({ api_key: null });

    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("No API key generated yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate key" })).toBeTruthy();
  });

  it("copies the API key to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });

    render(<InfoSheet open onClose={() => {}} />);

    await screen.findByText("api-key-1");
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("api-key-1");
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("keeps the copy action usable when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("permission denied")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });

    render(<InfoSheet open onClose={() => {}} />);

    await screen.findByText("api-key-1");
    const copyButton = screen.getByRole("button", { name: "Copy" });

    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("api-key-1");
    expect(screen.queryByText("Copied!")).toBeNull();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();

    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("regenerates the API key and shows the new value", async () => {
    render(<InfoSheet open onClose={() => {}} />);

    await screen.findByText("api-key-1");
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(mocks.regenerateApiKey).toHaveBeenCalledWith("jwt-token");
    expect(await screen.findByText("api-key-2")).toBeTruthy();
  });
});
