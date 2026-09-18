import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineMutation } from "../types";
import {
  listOfflineMutations,
  OFFLINE_QUEUE_CHANGED_EVENT,
  removeOfflineMutation
} from "../api/offlineStore";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { OfflineQueueProvider } from "./OfflineQueueContext";
import { reportStreamState, resetConnectivityForTests } from "../api/connectivity";

const offlineStoreMock = vi.hoisted(() => ({
  listOfflineMutations: vi.fn(),
  OFFLINE_QUEUE_CHANGED_EVENT: "endgame_grocery.offline_queue_changed",
  removeOfflineMutation: vi.fn()
}));

vi.mock("../api/offlineStore", () => offlineStoreMock);

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const listOfflineMutationsMock = vi.mocked(listOfflineMutations);
const removeOfflineMutationMock = vi.mocked(removeOfflineMutation);

let currentMutations: OfflineMutation[] = [];

describe("OfflineQueueProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentMutations = [];
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(createResponse({ ok: true }));
    listOfflineMutationsMock.mockImplementation(async () => [...currentMutations]);
    removeOfflineMutationMock.mockImplementation(async (id: string) => {
      currentMutations = currentMutations.filter((mutation) => mutation.id !== id);
      window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
    });
    vi.stubGlobal("fetch", fetchMock);
    setNavigatorOnline(false);
    setVisibilityState("visible");
    resetConnectivityForTests();
    reportStreamState("open");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    resetConnectivityForTests();
  });

  it("drains queued mutations when the page becomes visible while online", async () => {
    renderProvider();

    await waitFor(() => {
      expect(listOfflineMutationsMock).toHaveBeenCalled();
    });

    currentMutations = [createMutation()];
    setNavigatorOnline(true);

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
    expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-1");
  });

  it("drains newly queued mutations when the queue changes while online", async () => {
    renderProvider();

    await waitFor(() => {
      expect(listOfflineMutationsMock).toHaveBeenCalled();
    });

    currentMutations = [createMutation()];
    setNavigatorOnline(true);

    act(() => {
      window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/lists",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
    expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-1");
  });

  it("does not start a second drain while a drain is already running", async () => {
    currentMutations = [createMutation()];
    const syncResponse = createDeferred<Response>();
    fetchMock.mockReturnValue(syncResponse.promise);

    renderProvider();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flushAsyncWork();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      syncResponse.resolve(createResponse({ ok: true }));
      await syncResponse.promise;
    });

    await waitFor(() => {
      expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-1");
    });
  });

  it.each(["focus", "pageshow", "online", "offline", "visibilitychange", OFFLINE_QUEUE_CHANGED_EVENT])("checks reachability and drains on %s even with a false browser hint", async (event) => {
    resetConnectivityForTests();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OfflineQueueProvider timings={{ REACHABILITY_PROBE_MIN_INTERVAL_MS: 0 }}><OfflineQueueState /></OfflineQueueProvider>);
    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
    currentMutations = [createMutation()];
    fetchMock.mockResolvedValue(createResponse({ ok: true }));
    act(() => { (event === "visibilitychange" ? document : window).dispatchEvent(new Event(event)); });
    await waitFor(() => expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-1"));
    expect(screen.getByTestId("is-offline").textContent).toBe("false");
    expect(navigator.onLine).toBe(false);
  });

  it("keeps queued writes offline despite a true browser hint and coalesces wake-ups", async () => {
    resetConnectivityForTests();
    setNavigatorOnline(true);
    currentMutations = [createMutation()];
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    renderProvider(<OfflineQueueState />);
    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
    act(() => { for (const event of ["focus", "pageshow", "online", "offline", OFFLINE_QUEUE_CHANGED_EVENT]) window.dispatchEvent(new Event(event)); });
    await flushAsyncWork();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.any(Object));
    expect(removeOfflineMutationMock).not.toHaveBeenCalled();
    expect(currentMutations).toHaveLength(1);
  });

  it("does not drain when a probe finishes after unmount", async () => {
    resetConnectivityForTests();
    currentMutations = [createMutation()];
    const health = createDeferred<Response>();
    fetchMock.mockReturnValue(health.promise);
    const { unmount } = renderProvider();
    unmount();
    await act(async () => { health.resolve(createResponse({ ok: true })); await health.promise; });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(removeOfflineMutationMock).not.toHaveBeenCalled();
  });

  it("keeps a failed mutation in the queue and exposes it for discard after a 4xx response", async () => {
    currentMutations = [createMutation()];
    fetchMock.mockResolvedValue(createResponse({ error: "Entry not found." }, 404));
    setNavigatorOnline(true);

    renderProvider(<OfflineQueueState />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-error").textContent).toBe("Entry not found.");
    });
    expect(screen.getByTestId("failed-mutation-id").textContent).toBe("mutation-1");
    expect(removeOfflineMutationMock).not.toHaveBeenCalled();
    expect(currentMutations).toHaveLength(1);
  });

  it("keeps retry behavior for 5xx responses without exposing a failed mutation", async () => {
    currentMutations = [createMutation()];
    fetchMock.mockResolvedValue(createResponse({ error: "Server unavailable." }, 503));
    setNavigatorOnline(true);

    renderProvider(<OfflineQueueState />);

    await waitFor(() => {
      expect(screen.getByTestId("sync-error").textContent).toBe("Server unavailable.");
    });
    expect(screen.getByTestId("failed-mutation-id").textContent).toBe("");
    expect(removeOfflineMutationMock).not.toHaveBeenCalled();
    expect(currentMutations).toHaveLength(1);
  });

  it("discards the failed mutation, clears the error, and drains remaining queued mutations", async () => {
    currentMutations = [
      createMutation({ id: "mutation-1", url: "/api/entries/missing" }),
      createMutation({ id: "mutation-2", url: "/api/lists" })
    ];
    fetchMock
      .mockResolvedValueOnce(createResponse({ error: "Entry not found." }, 404))
      .mockResolvedValueOnce(createResponse({ list: { id: "list-1" } }));
    setNavigatorOnline(true);

    renderProvider(<OfflineQueueState />);

    await waitFor(() => {
      expect(screen.getByTestId("failed-mutation-id").textContent).toBe("mutation-1");
    });

    await act(async () => {
      await screen.getByRole("button", { name: "discard" }).click();
    });

    await waitFor(() => {
      expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-2");
    });
    expect(removeOfflineMutationMock).toHaveBeenCalledWith("mutation-1");
    expect(screen.getByTestId("sync-error").textContent).toBe("");
    expect(screen.getByTestId("failed-mutation-id").textContent).toBe("");
    expect(currentMutations).toHaveLength(0);
  });
});

function OfflineQueueState() {
  const { discardFailedMutation, failedMutationId, syncError, isOffline } = useOfflineQueue();

  return (
    <>
      <div data-testid="is-offline">{String(isOffline)}</div>
      <div data-testid="failed-mutation-id">{failedMutationId}</div>
      <div data-testid="sync-error">{syncError}</div>
      <button onClick={() => void discardFailedMutation()} type="button">
        discard
      </button>
    </>
  );
}

function renderProvider(children = <div />) {
  return render(
    <OfflineQueueProvider>
      {children}
    </OfflineQueueProvider>
  );
}

function createMutation(overrides: Partial<OfflineMutation> = {}): OfflineMutation {
  return {
    id: "mutation-1",
    url: "/api/lists",
    method: "POST",
    payload: { name: "Queued list" },
    token: "token-1",
    createdAt: "2026-05-27T10:00:00.000Z",
    ...overrides
  };
}

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body)
  } as unknown as Response;
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
}

async function flushAsyncWork(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
}

function setNavigatorOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value
  });
}

function setVisibilityState(value: DocumentVisibilityState): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value
  });
}
