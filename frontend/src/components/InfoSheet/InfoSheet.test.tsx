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
    mocks.fetchApiKey.mockResolvedValue({ has_key: true, hint: "ey-1", created_at: "2026-10-01T10:00:00.000Z" });
    mocks.regenerateApiKey.mockReset();
    mocks.regenerateApiKey.mockResolvedValue({ api_key: "api-key-2", hint: "ey-2", created_at: "2026-10-09T10:00:00.000Z" });
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

  it("renders logout text only on the logout button", () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(screen.getAllByText("Log out")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
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

  async function generateKey() {
    mocks.fetchApiKey.mockResolvedValue({ has_key: false, hint: null, created_at: null });
    const view = render(<InfoSheet open onClose={() => {}} />);
    await userEvent.click(await screen.findByRole("button", { name: "Generate key" }));
    return view;
  }

  it("fetches the API key status when the sheet opens", async () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("•••• ey-1")).toBeTruthy();
    expect(mocks.fetchApiKey).toHaveBeenCalledWith("jwt-token");
  });

  it("shows only the hint of an existing key, with no copy action", async () => {
    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("•••• ey-1")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
    expect(screen.queryByText(/shown only once/i)).toBeNull();
  });

  it("shows an empty state and generate action when no API key exists", async () => {
    mocks.fetchApiKey.mockResolvedValue({ has_key: false, hint: null, created_at: null });

    render(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("No API key generated yet.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Generate key" })).toBeTruthy();
  });

  it("shows a newly generated key once, with a warning and a copy action", async () => {
    await generateKey();

    expect(mocks.regenerateApiKey).toHaveBeenCalledWith("jwt-token");
    expect(await screen.findByText("api-key-2")).toBeTruthy();
    expect(screen.getByText(/shown only once/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
  });

  it("falls back to the hint after the sheet is closed and reopened", async () => {
    const view = await generateKey();
    await screen.findByText("api-key-2");

    view.rerender(<InfoSheet open={false} onClose={() => {}} />);
    mocks.fetchApiKey.mockResolvedValue({ has_key: true, hint: "ey-2", created_at: "2026-10-09T10:00:00.000Z" });
    view.rerender(<InfoSheet open onClose={() => {}} />);

    expect(await screen.findByText("•••• ey-2")).toBeTruthy();
    expect(screen.queryByText("api-key-2")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("copies the new API key to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });

    await generateKey();
    await screen.findByText("api-key-2");
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(writeText).toHaveBeenCalledWith("api-key-2");
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("keeps the copy action usable when clipboard write fails", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("permission denied")).mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText }
    });

    await generateKey();
    await screen.findByText("api-key-2");
    const copyButton = screen.getByRole("button", { name: "Copy" });

    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("api-key-2");
    expect(screen.queryByText("Copied!")).toBeNull();

    await userEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Copied!")).toBeTruthy();
  });

  it("asks for confirmation before replacing an existing key", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<InfoSheet open onClose={() => {}} />);

    await userEvent.click(await screen.findByRole("button", { name: "Regenerate" }));

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mocks.regenerateApiKey).not.toHaveBeenCalled();
    expect(screen.getByText("•••• ey-1")).toBeTruthy();

    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: "Regenerate" }));

    expect(mocks.regenerateApiKey).toHaveBeenCalledWith("jwt-token");
    expect(await screen.findByText("api-key-2")).toBeTruthy();
    confirm.mockRestore();
  });
});
