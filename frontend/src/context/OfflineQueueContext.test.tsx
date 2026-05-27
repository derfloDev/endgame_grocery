import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineMutation } from "../types";
import {
  listOfflineMutations,
  OFFLINE_QUEUE_CHANGED_EVENT,
  removeOfflineMutation
} from "../api/offlineStore";
import { OfflineQueueProvider } from "./OfflineQueueContext";

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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
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

    setNavigatorOnline(true);
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
});

function renderProvider() {
  return render(
    <OfflineQueueProvider>
      <div />
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
