import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import "../../i18n";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import OfflineBanner from "./OfflineBanner";

vi.mock("../../hooks/useOfflineQueue", () => ({
  useOfflineQueue: vi.fn()
}));

const useOfflineQueueMock = vi.mocked(useOfflineQueue);

describe("OfflineBanner", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the discard action for a non-retriable failed mutation", async () => {
    const discardFailedMutation = vi.fn(async () => undefined);
    useOfflineQueueMock.mockReturnValue({
      discardFailedMutation,
      failedMutationId: "mutation-1",
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
});
