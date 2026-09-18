import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { OFFLINE_SYNC_COMPLETE_EVENT } from "../api/client";
import {
  listOfflineMutations,
  OFFLINE_QUEUE_CHANGED_EVENT,
  removeOfflineMutation
} from "../api/offlineStore";
import type { OfflineQueueContextValue } from "../types";
import { OfflineQueueContext } from "./offlineQueueContextValue";
import { ensureFreshState, getIsOnline, reportRequestOutcome, subscribe } from "../api/connectivity";
import type { ReachabilityTimings } from "../api/connectivity";

interface OfflineQueueProviderProps {
  children: ReactNode;
  timings?: ReachabilityTimings;
}

type IdMap = Map<string, string>;

export function OfflineQueueProvider({ children, timings }: OfflineQueueProviderProps): ReactElement {
  const [isOffline, setIsOffline] = useState(() => getIsOnline() === false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncVersion, setSyncVersion] = useState(0);
  const [failedMutationId, setFailedMutationId] = useState("");
  const isSyncingRef = useRef(false);
  const mountedRef = useRef(false);

  const refreshQueuedCount = useCallback(async (): Promise<void> => {
    const pendingMutations = await listOfflineMutations();
    setQueuedCount(pendingMutations.length);
  }, []);

  const drainQueue = useCallback(async (): Promise<void> => {
    if (isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;

    try {
      const pendingMutations = await listOfflineMutations();

      if (pendingMutations.length === 0) {
        setSyncError("");
        setFailedMutationId("");
        return;
      }

      setIsSyncing(true);
      setSyncError("");
      setFailedMutationId("");

      const idMap: IdMap = new Map();
      let blockedByFailedMutation = false;

      for (const mutation of pendingMutations) {
        const url = replaceTemporaryIds(mutation.url, idMap);
        const payload = replaceTemporaryIds(mutation.payload, idMap);
        const response = await fetch(url, {
          method: mutation.method,
          headers: {
            ...(payload ? { "Content-Type": "application/json" } : {}),
            ...(mutation.token ? { Authorization: `Bearer ${mutation.token}` } : {})
          },
          ...(payload ? { body: JSON.stringify(payload) } : {})
        }).catch((error: unknown) => {
          reportRequestOutcome("network-error");
          throw error;
        });
        reportRequestOutcome("ok");

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const responseError = getResponseError(data) ?? "Failed to sync queued changes.";

          if (response.status >= 400 && response.status < 500) {
            setSyncError(responseError);
            setFailedMutationId(mutation.id);
            blockedByFailedMutation = true;
            break;
          }

          throw new Error(responseError);
        }

        const data = response.status === 204 ? null : await response.json().catch(() => ({}));
        const createdId = extractCreatedId(mutation.queueMeta?.resourceType, data);

        if (mutation.queueMeta?.tempId && createdId) {
          idMap.set(mutation.queueMeta.tempId, createdId);
        }

        await removeOfflineMutation(mutation.id);
      }

      if (!blockedByFailedMutation) {
        setSyncVersion((currentValue) => currentValue + 1);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(OFFLINE_SYNC_COMPLETE_EVENT));
        }
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Failed to sync queued changes.");
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      await refreshQueuedCount();
    }
  }, [refreshQueuedCount]);

  const checkAndDrain = useCallback(async (): Promise<void> => {
    const online = await ensureFreshState(timings);
    if (mountedRef.current && online) await drainQueue();
  }, [drainQueue, timings]);

  const discardFailedMutation = useCallback(async (): Promise<void> => {
    if (!failedMutationId) {
      return;
    }

    await removeOfflineMutation(failedMutationId);
    setFailedMutationId("");
    setSyncError("");
    void checkAndDrain();
  }, [checkAndDrain, failedMutationId]);

  useEffect(() => {
    mountedRef.current = true;
    void refreshQueuedCount();
    let previousOnline = getIsOnline();
    const unsubscribe = subscribe(() => {
      const online = getIsOnline();
      // Only confirmed reachability changes the banner; browser events just request a check.
      setIsOffline(online === false);
      const recovered = online === true && previousOnline !== true;
      previousOnline = online;
      if (recovered) void checkAndDrain();
    });
    function handleWake(): void { void checkAndDrain(); }

    function handleQueueChanged(): void {
      void refreshQueuedCount();

      void checkAndDrain();
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        void checkAndDrain();
      }
    }

    window.addEventListener("online", handleWake);
    window.addEventListener("offline", handleWake);
    window.addEventListener("pageshow", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void checkAndDrain();

    return () => {
      mountedRef.current = false;
      unsubscribe();
      window.removeEventListener("online", handleWake);
      window.removeEventListener("offline", handleWake);
      window.removeEventListener("pageshow", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkAndDrain, refreshQueuedCount]);

  return (
    <OfflineQueueContext.Provider
      value={{
        isOffline,
        queuedCount,
        isSyncing,
        syncError,
        syncVersion,
        failedMutationId,
        discardFailedMutation
      } satisfies OfflineQueueContextValue}
    >
      {children}
    </OfflineQueueContext.Provider>
  );
}

function replaceTemporaryIds(value: string, idMap: IdMap): string;
function replaceTemporaryIds<T>(value: T, idMap: IdMap): T;
function replaceTemporaryIds(value: unknown, idMap: IdMap): unknown {
  if (!value) {
    return value;
  }

  if (typeof value === "string") {
    let updatedValue = value;

    for (const [temporaryId, resolvedId] of idMap.entries()) {
      updatedValue = updatedValue.replaceAll(temporaryId, resolvedId);
    }

    return updatedValue;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => replaceTemporaryIds(entry, idMap));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, replaceTemporaryIds(entryValue, idMap)])
    );
  }

  return value;
}

function extractCreatedId(resourceType: string | undefined, data: unknown): string {
  if (!data || !resourceType) {
    return "";
  }

  if (resourceType === "list") {
    return getNestedId(data, "list");
  }

  if (resourceType === "entry") {
    return getNestedId(data, "entry");
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getNestedId(data: unknown, key: string): string {
  if (!isRecord(data)) {
    return "";
  }

  const nestedValue = data[key];

  if (!isRecord(nestedValue)) {
    return "";
  }

  return typeof nestedValue.id === "string" ? nestedValue.id : "";
}

function getResponseError(data: unknown): string | undefined {
  return isRecord(data) && typeof data.error === "string" ? data.error : undefined;
}
