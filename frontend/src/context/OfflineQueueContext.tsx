import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { OFFLINE_SYNC_COMPLETE_EVENT } from "../api/client";
import {
  listOfflineMutations,
  OFFLINE_QUEUE_CHANGED_EVENT,
  removeOfflineMutation
} from "../api/offlineStore";
import type { OfflineQueueContextValue } from "../types";
import { OfflineQueueContext } from "./offlineQueueContextValue";

interface OfflineQueueProviderProps {
  children: ReactNode;
}

type IdMap = Map<string, string>;

export function OfflineQueueProvider({ children }: OfflineQueueProviderProps): ReactElement {
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [syncVersion, setSyncVersion] = useState(0);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    async function refreshQueuedCount(): Promise<void> {
      const pendingMutations = await listOfflineMutations();
      setQueuedCount(pendingMutations.length);
    }

    async function drainQueue(): Promise<void> {
      if (isSyncingRef.current) {
        return;
      }

      isSyncingRef.current = true;

      try {
        const pendingMutations = await listOfflineMutations();

        if (pendingMutations.length === 0) {
          setSyncError("");
          return;
        }

        setIsSyncing(true);
        setSyncError("");

        const idMap: IdMap = new Map();

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
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(getResponseError(data) ?? "Failed to sync queued changes.");
          }

          const data = response.status === 204 ? null : await response.json().catch(() => ({}));
          const createdId = extractCreatedId(mutation.queueMeta?.resourceType, data);

          if (mutation.queueMeta?.tempId && createdId) {
            idMap.set(mutation.queueMeta.tempId, createdId);
          }

          await removeOfflineMutation(mutation.id);
        }

        setSyncVersion((currentValue) => currentValue + 1);

        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(OFFLINE_SYNC_COMPLETE_EVENT));
        }
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : "Failed to sync queued changes.");
      } finally {
        isSyncingRef.current = false;
        setIsSyncing(false);
        await refreshQueuedCount();
      }
    }

    void refreshQueuedCount();

    async function handleOnline(): Promise<void> {
      setIsOffline(false);
      await drainQueue();
    }

    function handleOffline(): void {
      setIsOffline(true);
    }

    function handleQueueChanged(): void {
      void refreshQueuedCount();

      if (navigator.onLine) {
        void drainQueue();
      }
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void drainQueue();
      }
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (navigator.onLine) {
      void drainQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <OfflineQueueContext.Provider
      value={{
        isOffline,
        queuedCount,
        isSyncing,
        syncError,
        syncVersion
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
