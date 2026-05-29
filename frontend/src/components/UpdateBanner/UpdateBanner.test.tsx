import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { useServiceWorkerUpdate } from "../../sw/register";
import UpdateBanner from "./UpdateBanner";

vi.mock("../../sw/register", () => ({
  useServiceWorkerUpdate: vi.fn()
}));

const useServiceWorkerUpdateMock = vi.mocked(useServiceWorkerUpdate);

describe("UpdateBanner", () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renders nothing when no service worker update is waiting", () => {
    useServiceWorkerUpdateMock.mockReturnValue({
      dismissUpdate: vi.fn(),
      needRefresh: false,
      updateServiceWorker: vi.fn()
    });

    render(<UpdateBanner />);

    expect(screen.queryByText("New version available.")).toBeNull();
  });

  it("renders when an update is waiting and reloads through the service worker", async () => {
    const updateServiceWorker = vi.fn(async () => undefined);
    useServiceWorkerUpdateMock.mockReturnValue({
      dismissUpdate: vi.fn(),
      needRefresh: true,
      updateServiceWorker
    });

    render(<UpdateBanner />);

    expect(screen.getByText("New version available.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("dismisses the waiting update banner for the current session", async () => {
    const dismissUpdate = vi.fn();
    useServiceWorkerUpdateMock.mockReturnValue({
      dismissUpdate,
      needRefresh: true,
      updateServiceWorker: vi.fn()
    });

    render(<UpdateBanner />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(dismissUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("New version available.")).toBeNull();
    expect(window.sessionStorage.getItem("endgame_grocery.update_banner_dismissed")).toBe("true");
  });
});
