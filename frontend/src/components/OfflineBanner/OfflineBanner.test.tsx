import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../../i18n";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import OfflineBanner from "./OfflineBanner";
import { reconnect } from "../../api/reconnect";

vi.mock("../../api/reconnect", () => ({ reconnect: vi.fn() }));

vi.mock("../../hooks/useOfflineQueue", () => ({
  useOfflineQueue: vi.fn()
}));

const useOfflineQueueMock = vi.mocked(useOfflineQueue);

describe("OfflineBanner", () => {
  it.each([
    ["en", 0, "Connected, but your access session has expired. Reconnect to continue syncing.", "Reconnect"],
    ["en", 1, "Connected, but your access session has expired. 1 change will sync after you reconnect.", "Reconnect"],
    ["en", 2, "Connected, but your access session has expired. 2 changes will sync after you reconnect.", "Reconnect"],
    ["de", 0, "Verbunden, aber die Zugangssitzung ist abgelaufen. Erneut verbinden, um weiter zu synchronisieren.", "Erneut verbinden"],
    ["de", 1, "Verbunden, aber die Zugangssitzung ist abgelaufen. 1 Änderung wird nach dem erneuten Verbinden synchronisiert.", "Erneut verbinden"],
    ["de", 2, "Verbunden, aber die Zugangssitzung ist abgelaufen. 2 Änderungen werden nach dem erneuten Verbinden synchronisiert.", "Erneut verbinden"]
  ])("shows the gated message (%s, %s queued) and reconnect action", async (language, count, message, label) => {
    await i18next.changeLanguage(String(language));
    useOfflineQueueMock.mockReturnValue({
      isReauthRequired: true, isOffline: false, isSyncing: true, queuedCount: Number(count),
      syncError: "", syncErrorKey: "", resolvedIds: {}, syncVersion: 0,
      failedMutationId: "", discardFailedMutation: vi.fn()
    });
    render(<OfflineBanner />);
    expect(screen.getByText(String(message))).toBeTruthy();
    expect(screen.queryByText(/offline|Offline|syncing [0-9]/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: String(label) }));
    expect(reconnect).toHaveBeenCalledTimes(1);
    await i18next.changeLanguage("en");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ["en", "", "Entry not found."],
    ["de", "", "Entry not found."],
    ["en", "offline.dependencyDiscarded", "This change depends on another change that was discarded, so it cannot be synced. Discard it too."],
    ["de", "offline.dependencyDiscarded", "Diese Änderung hängt von einer anderen Änderung ab, die verworfen wurde, und kann deshalb nicht synchronisiert werden. Verwirf sie ebenfalls."]
  ])("keeps a blocked change discardable while gated (%s, %s)", async (language, syncErrorKey, expectedError) => {
    await i18next.changeLanguage(language);
    const discardFailedMutation = vi.fn(async () => undefined);
    const german = language === "de";
    useOfflineQueueMock.mockReturnValue({
      isReauthRequired: true, isOffline: false, isSyncing: false, queuedCount: 1,
      failedMutationId: "mutation-1", discardFailedMutation,
      syncError: "Entry not found.", syncErrorKey, resolvedIds: {}, syncVersion: 0
    });

    render(<OfflineBanner />);

    expect(screen.getByText(german
      ? "Verbunden, aber die Zugangssitzung ist abgelaufen. 1 Änderung wird nach dem erneuten Verbinden synchronisiert."
      : "Connected, but your access session has expired. 1 change will sync after you reconnect.")).toBeTruthy();
    const error = screen.getByText(expectedError);
    expect(error.tagName).toBe("P");
    expect(error.className).toBe("eg-error-banner");
    const discardButton = screen.getByRole("button", { name: german ? "Ausstehende Änderung verwerfen" : "Discard queued change" });
    const reconnectButton = screen.getByRole("button", { name: german ? "Erneut verbinden" : "Reconnect" });

    await userEvent.click(discardButton);
    expect(discardFailedMutation).toHaveBeenCalledTimes(1);
    expect(reconnect).not.toHaveBeenCalled();
    discardFailedMutation.mockClear();
    await userEvent.click(reconnectButton);
    expect(reconnect).toHaveBeenCalledTimes(1);
    expect(discardFailedMutation).not.toHaveBeenCalled();
    await i18next.changeLanguage("en");
  });

  it("renders the discard action for a non-retriable failed mutation", async () => {
    const discardFailedMutation = vi.fn(async () => undefined);
    useOfflineQueueMock.mockReturnValue({
      discardFailedMutation,
      failedMutationId: "mutation-1",
      isReauthRequired: false,
      isOffline: false,
      isSyncing: false,
      queuedCount: 1,
      syncError: "Entry not found.",
      syncErrorKey: "",
      resolvedIds: {},
      syncVersion: 0
    });

    render(<OfflineBanner />);

    expect(screen.getByText("1 queued change still waiting to sync. Entry not found.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Discard queued change" }));

    expect(discardFailedMutation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["en", "1 queued change still waiting to sync. This change depends on another change that was discarded, so it cannot be synced. Discard it too."],
    ["de", "1 ausstehende Änderung warten weiter auf Synchronisierung. Diese Änderung hängt von einer anderen Änderung ab, die verworfen wurde, und kann deshalb nicht synchronisiert werden. Verwirf sie ebenfalls."]
  ])("translates the reason of a change whose dependency was discarded (%s)", async (language, expected) => {
    await i18next.changeLanguage(language);
    useOfflineQueueMock.mockReturnValue({
      discardFailedMutation: vi.fn(async () => undefined),
      failedMutationId: "mutation-2",
      isReauthRequired: false,
      isOffline: false,
      isSyncing: false,
      queuedCount: 1,
      syncError: "A change this one depends on was discarded.",
      syncErrorKey: "offline.dependencyDiscarded",
      resolvedIds: {},
      syncVersion: 0
    });

    render(<OfflineBanner />);

    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText(/A change this one depends on was discarded/)).toBeNull();
    await i18next.changeLanguage("en");
  });
  it("translates the reason by the server's error code and falls back to its text", () => {
    const base = {
      discardFailedMutation: vi.fn(async () => undefined),
      failedMutationId: "mutation-1",
      isReauthRequired: false,
      isOffline: false,
      isSyncing: false,
      queuedCount: 1,
      resolvedIds: {},
      syncVersion: 0
    };

    useOfflineQueueMock.mockReturnValue({ ...base, syncError: "List name is required.", syncErrorKey: "errors.validation.list_name_required" });
    const view = render(<OfflineBanner />);
    expect(screen.getByText("1 queued change still waiting to sync. List name is required.")).toBeTruthy();

    useOfflineQueueMock.mockReturnValue({ ...base, syncError: "Brand new message.", syncErrorKey: "errors.brand.new_code" });
    view.rerender(<OfflineBanner />);
    expect(screen.getByText("1 queued change still waiting to sync. Brand new message.")).toBeTruthy();
  });
});
