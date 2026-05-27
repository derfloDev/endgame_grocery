import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      syncVersion: 0
    });

    render(<OfflineBanner />);

    expect(screen.getByText("1 queued change still waiting to sync. Entry not found.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Discard queued change" }));

    expect(discardFailedMutation).toHaveBeenCalledTimes(1);
  });
});
