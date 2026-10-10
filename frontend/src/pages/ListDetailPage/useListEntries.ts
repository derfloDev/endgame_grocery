import { useCallback, useEffect, useRef, useState } from "react";
import { createTemporaryId } from "../../api/client";
import { createEntriesCacheKey, createEntry, fetchEntries, updateEntry } from "../../api/entries";
import { listOfflineMutations, writeCachedResource } from "../../api/offlineStore";
import { SSE_EVENTS } from "../../api/sseEvents";
import type { EntrySseEventType } from "../../api/sseEvents";
import type { Entry, Suggestion } from "../../types";
import {
  applyEntryEvent,
  mergePendingEntries,
  reconcileResolvedEntries,
  replaceTemporaryEntry,
  sortEntries
} from "./listDetailUtils";
import type { ActiveList } from "./useActiveList";
import type { RecentlyUsedCommands } from "./useRecentlyUsed";

interface LoadEntriesOptions {
  historyItems?: Suggestion[] | null;
  throwOnError?: boolean;
}

interface UseListEntriesOptions {
  active: ActiveList;
  clearError: () => void;
  /** The signed-in user; changes made by other users are marked as changed. */
  currentUserId?: string;
  history: Pick<RecentlyUsedCommands, "filterAgainst" | "markCompleted" | "reload" | "scheduleReload" | "unmarkCompleted">;
  listId: string;
  reportError: (error: unknown) => void;
  /** Temporary ids the offline queue resolved (temp id -> real id); matching entries are swapped. */
  resolvedIds?: Record<string, string>;
  token: string;
}

/**
 * The entries of one list: loading, live patching from SSE events and the write commands
 * (`addEntry`, `toggleEntry`, `editEntry`). Failures go to `reportError`; nothing here exposes a
 * state setter.
 */
export function useListEntries({
  active,
  clearError,
  currentUserId,
  history,
  listId,
  reportError,
  resolvedIds,
  token
}: UseListEntriesOptions) {
  const [entries, setEntriesState] = useState<Entry[]>([]);
  const entriesRef = useRef<Entry[]>([]);
  const locallyDoneIdsRef = useRef<Set<string>>(new Set());
  // Temporary entries whose create request is running right now (not queued, not answered yet).
  const inFlightTempIdsRef = useRef<Set<string>>(new Set());

  const getEntries = useCallback((): Entry[] => entriesRef.current, []);

  // Keep an immediate snapshot for async reloads: React may defer state updaters, but
  // both the merge and the following history refresh must see entries queued meanwhile.
  const replaceEntries = useCallback((value: Entry[] | ((current: Entry[]) => Entry[])): Entry[] => {
    const nextEntries = typeof value === "function" ? value(entriesRef.current) : value;
    entriesRef.current = nextEntries;
    setEntriesState(nextEntries);
    return nextEntries;
  }, []);

  /** Shows `nextEntries` and keeps the offline cache in step. */
  const updateEntries = useCallback(
    async (updater: (currentEntries: Entry[]) => Entry[]): Promise<void> => {
      const nextEntries = replaceEntries(updater);

      await writeCachedResource(createEntriesCacheKey(listId), { entries: nextEntries });
    },
    [listId, replaceEntries]
  );

  const cacheEntries = useCallback(
    (nextEntries: Entry[]): void => {
      Promise.resolve(writeCachedResource(createEntriesCacheKey(listId), { entries: nextEntries })).catch((error: unknown) => {
        console.error("Failed to cache entries.", error);
      });
    },
    [listId]
  );

  /** Forgets the entries (another list was opened, or the list is not accessible). */
  const clear = useCallback((): void => {
    replaceEntries([]);
  }, [replaceEntries]);

  /** Starts a fresh load: completion badges of the previous load no longer apply. */
  const beginLoad = useCallback((): void => {
    locallyDoneIdsRef.current = new Set();
  }, []);

  /**
   * Decides which queued local entries survive a full reload. A temporary entry stays only while
   * its create is still queued or running; once the change was synced (the server returns the real
   * entry) or discarded from the queue, keeping it would show a duplicate or a phantom entry.
   */
  const createPendingFilter = useCallback(async (): Promise<(entry: Entry) => boolean> => {
    let queuedTempIds: Set<string>;

    try {
      const queued = await listOfflineMutations();
      queuedTempIds = new Set(queued.flatMap((mutation) => (mutation.queueMeta?.tempId ? [mutation.queueMeta.tempId] : [])));
    } catch {
      // Without the queue we cannot tell; keep everything rather than lose queued work from view.
      return () => true;
    }

    return (entry) =>
      !entry.id.startsWith("temp-") || queuedTempIds.has(entry.id) || inFlightTempIdsRef.current.has(entry.id);
  }, []);

  /** Marks entries this client completed itself, so they keep their "done" badge after a reload. */
  const withDoneBadges = useCallback(
    (serverEntries: Entry[]): Entry[] =>
      serverEntries.map((entry) =>
        locallyDoneIdsRef.current.has(entry.id) && entry.status === "done" ? { ...entry, is_changed: true } : entry
      ),
    []
  );

  /** Shows entries from the offline cache while the network request is still running. */
  const applyCachedEntries = useCallback(
    (cachedEntries: Entry[]): void => {
      const nextEntries = replaceEntries(mergePendingEntries(cachedEntries, entriesRef.current));

      history.filterAgainst(nextEntries);
    },
    [history, replaceEntries]
  );

  /**
   * Shows the server's entries, keeping queued additions that are still pending and the completion
   * badges of this client. Returns what is shown.
   */
  const applyServerEntries = useCallback(
    (serverEntries: Entry[], isStillPending: (entry: Entry) => boolean): Entry[] =>
      replaceEntries(mergePendingEntries(withDoneBadges(serverEntries), entriesRef.current, isStillPending)),
    [replaceEntries, withDoneBadges]
  );

  const loadEntries = useCallback(
    async ({ historyItems = null, throwOnError = false }: LoadEntriesOptions = {}): Promise<Entry[]> => {
      try {
        const entriesResult = await fetchEntries(listId, token);
        const isStillPending = await createPendingFilter();

        if (!active.isCurrent(listId)) {
          return entriesRef.current;
        }

        const nextEntries = mergePendingEntries(withDoneBadges(entriesResult.entries ?? []), entriesRef.current, isStillPending);

        if (active.isMounted()) {
          replaceEntries(nextEntries);
          history.filterAgainst(nextEntries, historyItems);
        }

        return nextEntries;
      } catch (loadError) {
        if (active.isMounted()) {
          reportError(loadError);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      }
    },
    [active, createPendingFilter, history, listId, replaceEntries, reportError, token, withDoneBadges]
  );

  /** True for an `entry:created` event of this user whose text matches an entry this tab is creating right now. */
  const isOwnInFlightCreate = useCallback(
    (data: Record<string, unknown>): boolean => {
      const payload = data.entry as { text?: unknown } | null | undefined;

      return (
        Boolean(currentUserId) &&
        data.actorId === currentUserId &&
        typeof payload?.text === "string" &&
        entriesRef.current.some((entry) => inFlightTempIdsRef.current.has(entry.id) && entry.text === payload.text)
      );
    },
    [currentUserId]
  );

  /**
   * Applies an SSE entry event by patching the local entries (no request). Only an event without
   * a usable payload (an older server) falls back to refetching entries and history. The history
   * is reloaded, debounced, only when an entry moved to or from done or a done entry was deleted.
   */
  const handleEntryEvent = useCallback(
    (type: EntrySseEventType, data: Record<string, unknown>): void => {
      // This tab's own create is still running: its response delivers the entry. Showing the
      // event's copy now would render the same entry twice until the response arrives.
      if (type === SSE_EVENTS.entryCreated && isOwnInFlightCreate(data)) {
        return;
      }

      const result = applyEntryEvent(entriesRef.current, type, data, {
        currentUserId,
        locallyDoneIds: locallyDoneIdsRef.current
      });

      if (!result) {
        void loadEntries().then((nextEntries) => history.reload(nextEntries));
        return;
      }

      if (result.entries !== entriesRef.current) {
        const nextEntries = replaceEntries(result.entries);

        history.filterAgainst(nextEntries);
        cacheEntries(nextEntries);
      }

      if (result.historyChanged) {
        history.scheduleReload();
      }
    },
    [cacheEntries, currentUserId, history, isOwnInFlightCreate, loadEntries, replaceEntries]
  );
  const handleEntryCreated = useCallback((data: Record<string, unknown>) => handleEntryEvent(SSE_EVENTS.entryCreated, data), [handleEntryEvent]);
  const handleEntryUpdated = useCallback((data: Record<string, unknown>) => handleEntryEvent(SSE_EVENTS.entryUpdated, data), [handleEntryEvent]);
  const handleEntryDeleted = useCallback((data: Record<string, unknown>) => handleEntryEvent(SSE_EVENTS.entryDeleted, data), [handleEntryEvent]);

  /** Adds an entry right away (shown as queued) and sends it; resolves whether it was accepted. */
  const addEntry = useCallback(
    async (text: string, icon: string | null, details = ""): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed) {
        return false;
      }

      const temporaryEntry: Entry = {
        id: createTemporaryId("entry"),
        text: trimmed,
        icon: icon ?? null,
        details: normalizeEntryDetails(details),
        status: "open",
        created_at: new Date().toISOString(),
        is_pending_sync: true
      };

      inFlightTempIdsRef.current.add(temporaryEntry.id);
      await updateEntries((currentEntries) => sortEntries([...currentEntries, temporaryEntry]));

      try {
        clearError();
        const result = await createEntry(
          listId,
          token,
          { text: trimmed, icon: icon ?? null, details },
          { tempId: temporaryEntry.id }
        );

        await updateEntries((currentEntries) =>
          result?.queued
            ? sortEntries(currentEntries.map((currentEntry) => (currentEntry.id === temporaryEntry.id ? temporaryEntry : currentEntry)))
            // The server may have announced the entry (entry:created) before this response: never
            // keep it twice.
            : replaceTemporaryEntry(currentEntries, temporaryEntry.id, result.entry)
        );
        return true;
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          currentEntries.filter((currentEntry) => currentEntry.id !== temporaryEntry.id)
        );
        reportError(submitError);
        return false;
      } finally {
        inFlightTempIdsRef.current.delete(temporaryEntry.id);
      }
    },
    [clearError, listId, reportError, token, updateEntries]
  );

  /** Completes or reopens an entry optimistically; undone when the request fails. */
  const toggleEntry = useCallback(
    async (entry: Entry): Promise<void> => {
      const nextStatus: Entry["status"] = entry.status === "open" ? "done" : "open";
      const isCompletingEntry = nextStatus === "done";
      const optimisticEntry: Entry = {
        ...entry,
        status: nextStatus,
        is_pending_sync: true,
        ...(isCompletingEntry ? { is_changed: true } : {})
      };

      if (isCompletingEntry) {
        locallyDoneIdsRef.current.add(entry.id);
      }

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? optimisticEntry : currentEntry))
        )
      );

      if (isCompletingEntry) {
        history.markCompleted(entry);
      }

      try {
        clearError();
        const result = await updateEntry(listId, entry.id, token, { status: nextStatus });

        await updateEntries((currentEntries) =>
          sortEntries(
            currentEntries.map((currentEntry) =>
              currentEntry.id === entry.id
                ? {
                    ...currentEntry,
                    ...(result?.queued
                      ? {
                          is_pending_sync: true,
                          status: nextStatus,
                          ...(isCompletingEntry ? { is_changed: true } : {})
                        }
                      : {
                          ...result.entry,
                          ...(isCompletingEntry ? { is_changed: true } : {})
                        })
                  }
                : currentEntry
            )
          )
        );

        if (isCompletingEntry && !result?.queued) {
          history.markCompleted(result.entry);
        }
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          sortEntries(currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? entry : currentEntry)))
        );

        if (isCompletingEntry) {
          locallyDoneIdsRef.current.delete(entry.id);
          history.unmarkCompleted(entry.text);
        }

        reportError(submitError);
      }
    },
    [clearError, history, listId, reportError, token, updateEntries]
  );

  /** Saves new text, icon and details of an entry; resolves whether it was accepted. */
  const editEntry = useCallback(
    async (entryId: string, text: string, iconName: string | null, details = ""): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed) {
        return false;
      }

      try {
        clearError();
        const nextIcon = iconName ?? null;
        const nextDetails = normalizeEntryDetails(details);
        const result = await updateEntry(listId, entryId, token, { text: trimmed, icon: nextIcon, details });

        await updateEntries((currentEntries) =>
          sortEntries(
            currentEntries.map((currentEntry) =>
              currentEntry.id === entryId
                ? {
                    ...currentEntry,
                    ...(result?.queued
                      ? { details: nextDetails, icon: nextIcon, is_pending_sync: true, text: trimmed }
                      : result.entry)
                  }
                : currentEntry
            )
          )
        );
        return true;
      } catch (submitError) {
        reportError(submitError);
        return false;
      }
    },
    [clearError, listId, reportError, token, updateEntries]
  );

  // The offline queue resolved temporary ids: show the real entry instead of the queued one without
  // waiting for the next reload (and never both).
  useEffect(() => {
    if (!resolvedIds || Object.keys(resolvedIds).length === 0) {
      return;
    }

    const reconciled = reconcileResolvedEntries(entriesRef.current, resolvedIds);

    if (reconciled !== entriesRef.current) {
      cacheEntries(replaceEntries(reconciled));
    }
  }, [cacheEntries, replaceEntries, resolvedIds]);

  return {
    addEntry,
    applyCachedEntries,
    applyServerEntries,
    beginLoad,
    clear,
    createPendingFilter,
    editEntry,
    entries,
    getEntries,
    handleEntryCreated,
    handleEntryDeleted,
    handleEntryUpdated,
    loadEntries,
    toggleEntry
  };
}

function normalizeEntryDetails(details: string): string | null {
  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}
