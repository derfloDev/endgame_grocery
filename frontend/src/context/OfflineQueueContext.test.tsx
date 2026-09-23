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
import { requestJson } from "../api/request";
import { StrictMode } from "react";

const offlineStoreMock = vi.hoisted(() => ({
  completeOfflineMutation: vi.fn(),
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
    offlineStoreMock.completeOfflineMutation.mockImplementation(async (id: string, resolvedIds: Record<string, string>) => {
      currentMutations = currentMutations.map((mutation) => ({ ...mutation, resolvedIds: { ...mutation.resolvedIds, ...resolvedIds } }));
      await removeOfflineMutationMock(id);
    });
    vi.stubGlobal("fetch", fetchMock);
    setNavigatorOnline(false);
    setVisibilityState("visible");
    resetConnectivityForTests();
    reportStreamState("open");
  });

  afterEach(() => {
    cleanup();
    resetConnectivityForTests();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("does not probe reachability on mount when the queue is empty", async () => {
    renderProvider();

    await waitFor(() => {
      expect(listOfflineMutationsMock).toHaveBeenCalled();
    });
    await flushAsyncWork();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the offline state after a real request fails while the browser is online", async () => {
    setNavigatorOnline(true);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(createResponse({ ok: true }, 503));
    renderProvider(<OfflineQueueState />);

    await act(async () => {
      await expect(requestJson("/api/lists", {})).rejects.toThrow("Failed to fetch");
    });
    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.any(Object));
  });

  it("shows the offline state after a real request reaches its deadline", async () => {
    setNavigatorOnline(true);
    fetchMock.mockImplementation((input) => input === "/api/health"
      ? Promise.resolve(createResponse({ ok: false }, 503))
      : new Promise(() => undefined));
    renderProvider(<OfflineQueueState />);

    await expect(requestJson("/api/lists", {}, 1)).rejects.toThrow();
    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.any(Object));
  });

  it("re-probes a known offline state on recovery events with an empty queue", async () => {
    resetConnectivityForTests();
    setNavigatorOnline(true);
    currentMutations = [createMutation()];
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderProvider(<OfflineQueueProvider timings={{ REACHABILITY_PROBE_MIN_INTERVAL_MS: 0 }}><OfflineQueueState /></OfflineQueueProvider>);

    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
    currentMutations = [];
    fetchMock.mockResolvedValueOnce(createResponse({ ok: true }));
    act(() => window.dispatchEvent(new Event("online")));

    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("false"));
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/health")).toHaveLength(2);
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
    currentMutations = [createMutation()];
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<OfflineQueueProvider timings={{ REACHABILITY_PROBE_MIN_INTERVAL_MS: 0 }}><OfflineQueueState /></OfflineQueueProvider>);
    await waitFor(() => expect(screen.getByTestId("is-offline").textContent).toBe("true"));
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.any(Object)));
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
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(screen.getByTestId("sync-error").textContent).toBe("");
    expect(screen.getByTestId("failed-mutation-id").textContent).toBe("");
    expect(removeOfflineMutationMock).not.toHaveBeenCalled();
    expect(currentMutations).toHaveLength(1);
  });

  describe("retry scheduling", () => {
    const timings = { REQUEST_TIMEOUT_MS: 1000, QUEUE_RETRY_BASE_DELAY_MS: 100, QUEUE_RETRY_MAX_DELAY_MS: 400, QUEUE_DRAIN_STALL_TIMEOUT_MS: 3000, REACHABILITY_PROBE_MIN_INTERVAL_MS: 0 };
    beforeEach(() => { vi.useFakeTimers(); currentMutations = [createMutation()]; });
    async function advance(ms = 0) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
    const mutationCalls = () => fetchMock.mock.calls.filter(([url]) => url !== "/api/health");
    function mount(overrides = {}) { return render(<OfflineQueueProvider timings={{ ...timings, ...overrides }}><OfflineQueueState /></OfflineQueueProvider>); }

    it("retries 5xx with capped backoff, stays quiet and resets the delay after success", async () => {
      fetchMock.mockResolvedValue(createResponse({ error: "Temporary outage" }, 503));
      mount();
      await advance();
      expect(mutationCalls()).toHaveLength(1);
      for (const [index, delay] of [100, 200, 400, 400].entries()) {
        await advance(delay - 1);
        expect(mutationCalls()).toHaveLength(index + 1);
        await advance(1);
        expect(mutationCalls()).toHaveLength(index + 2);
        expect(screen.getByTestId("sync-error").textContent).toBe("");
        expect(screen.getByTestId("failed-mutation-id").textContent).toBe("");
      }
      fetchMock.mockResolvedValue(createResponse({}));
      await advance(400);
      expect(currentMutations).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      currentMutations = [createMutation({ id: "next" })];
      fetchMock.mockResolvedValueOnce(createResponse({}, 503));
      act(() => window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT)));
      await advance();
      const count = mutationCalls().length;
      await advance(99);
      expect(mutationCalls()).toHaveLength(count);
      await advance(1);
      expect(mutationCalls()).toHaveLength(count + 1);
      expect(currentMutations).toHaveLength(0);
    });

    it("keeps retrying through unreachable health checks and drains on recovery without an event", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
      mount();
      await advance();
      await advance(100);
      expect(mutationCalls()).toHaveLength(1);
      expect(screen.getByTestId("is-offline").textContent).toBe("true");
      fetchMock.mockResolvedValue(createResponse({}));
      await advance(200);
      expect(mutationCalls()).toHaveLength(2);
      expect(currentMutations).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not retry a 4xx even on wake-up and still exposes discard", async () => {
      fetchMock.mockResolvedValue(createResponse({ error: "Gone" }, 404));
      mount();
      await advance();
      await advance(5000);
      act(() => window.dispatchEvent(new Event("focus")));
      await advance();
      expect(mutationCalls()).toHaveLength(1);
      expect(screen.getByTestId("sync-error").textContent).toBe("Gone");
      expect(screen.getByTestId("failed-mutation-id").textContent).toBe("mutation-1");
      expect(screen.getByRole("button", { name: "discard" })).toBeTruthy();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("cancels a pending retry when a wake-up drains first", async () => {
      fetchMock.mockResolvedValueOnce(createResponse({}, 503));
      mount();
      await advance();
      act(() => window.dispatchEvent(new Event("pageshow")));
      await advance();
      expect(mutationCalls()).toHaveLength(2);
      await advance(1000);
      expect(mutationCalls()).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("resumes remaining mutations in order after remount using persisted temporary IDs", async () => {
      currentMutations = [
        createMutation({ id: "parent", queueMeta: { resourceType: "list", tempId: "temp-list" } }),
        createMutation({ id: "child", url: "/api/lists/temp-list/entries", createdAt: "2026-05-27T10:00:01Z", payload: { parent: "temp-list" } }),
        createMutation({ id: "last", url: "/api/lists/temp-list/members", createdAt: "2026-05-27T10:00:02Z" })
      ];
      fetchMock.mockResolvedValueOnce(createResponse({ list: { id: "real-list" } })).mockResolvedValueOnce(createResponse({}, 503));
      const first = mount();
      await advance();
      expect(currentMutations.map(({ id }) => id)).toEqual(["child", "last"]);
      first.unmount();
      mount();
      await advance();
      expect(mutationCalls().map(([url]) => url)).toEqual(["/api/lists", "/api/lists/real-list/entries", "/api/lists/real-list/entries", "/api/lists/real-list/members"]);
      expect(JSON.parse(String(mutationCalls()[2][1]?.body))).toEqual({ parent: "real-list" });
      expect(removeOfflineMutationMock.mock.calls.map(([id]) => id)).toEqual(["parent", "child", "last"]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each(["request", "stall"])("aborts at the %s deadline, releases the guard and ignores late completion", async (deadline) => {
      const firstResponse = createDeferred<Response>();
      fetchMock.mockReturnValueOnce(firstResponse.promise);
      mount(deadline === "stall" ? { REQUEST_TIMEOUT_MS: 10000 } : {});
      await advance();
      const signal = mutationCalls()[0][1]!.signal!;
      await advance(deadline === "stall" ? 3000 : 1000);
      expect(signal.aborted).toBe(true);
      expect(screen.getByTestId("is-syncing").textContent).toBe("false");
      act(() => window.dispatchEvent(new Event("focus")));
      await advance();
      expect(currentMutations).toHaveLength(0);
      await act(async () => { firstResponse.resolve(createResponse({})); await firstResponse.promise; });
      expect(removeOfflineMutationMock).toHaveBeenCalledTimes(1);
      expect(mutationCalls()).toHaveLength(2);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("clears retry timers and aborts active requests on unmount", async () => {
      fetchMock.mockResolvedValueOnce(createResponse({}, 503));
      const first = mount();
      await advance();
      first.unmount();
      expect(vi.getTimerCount()).toBe(0);
      fetchMock.mockReturnValueOnce(new Promise(() => {}));
      const second = mount();
      await advance();
      const signal = mutationCalls()[1][1]!.signal!;
      second.unmount();
      await advance();
      expect(signal.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("does not resend an accepted request if local acknowledgement fails", async () => {
      offlineStoreMock.completeOfflineMutation.mockRejectedValueOnce(new Error("Storage busy"));
      mount();
      await advance();
      expect(mutationCalls()).toHaveLength(1);
      expect(currentMutations).toHaveLength(1);
      await advance(100);
      expect(mutationCalls()).toHaveLength(1);
      expect(currentMutations).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("releases a stalled storage read and prevents the abandoned run from sending", async () => {
      const stalled = createDeferred<OfflineMutation[]>();
      // The first read refreshes the badge, the second checks whether probing is needed,
      // and the third belongs to the drain.
      listOfflineMutationsMock
        .mockResolvedValueOnce([...currentMutations])
        .mockResolvedValueOnce([...currentMutations])
        .mockReturnValueOnce(stalled.promise);
      mount();
      await advance();
      await advance(3000);
      expect(screen.getByTestId("is-syncing").textContent).toBe("false");
      act(() => window.dispatchEvent(new Event("focus")));
      await advance();
      await act(async () => { stalled.resolve([createMutation()]); await stalled.promise; });
      expect(mutationCalls()).toHaveLength(1);
      expect(currentMutations).toHaveLength(0);
    });

    it("owns only one drain through Strict Mode setup and cleanup", async () => {
      render(<StrictMode><OfflineQueueProvider timings={timings}><OfflineQueueState /></OfflineQueueProvider></StrictMode>);
      await advance();
      expect(mutationCalls()).toHaveLength(1);
      expect(currentMutations).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });
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
  const { discardFailedMutation, failedMutationId, syncError, isOffline, isSyncing } = useOfflineQueue();

  return (
    <>
      <div data-testid="is-offline">{String(isOffline)}</div>
      <div data-testid="is-syncing">{String(isSyncing)}</div>
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
