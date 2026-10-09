import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createTemporaryId } from "../../api/client";
import { createEntry, fetchEntries, updateEntry } from "../../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../../api/history";
import { ApiError, getErrorMessage } from "../../api/errors";
import { fetchList, markListViewed } from "../../api/lists";
import { listOfflineMutations, writeCachedResource } from "../../api/offlineStore";
import { fetchListMembers } from "../../api/sharing";
import type { Entry, List, Member, Suggestion } from "../../types";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "../recentlyUsedState";
import {
  ListAccessError,
  applyEntryEvent,
  mergePendingEntries,
  reconcileResolvedEntries,
  replaceTemporaryEntry,
  sortEntries
} from "./listDetailUtils";
import type { EntryEventType } from "./listDetailUtils";

// Several entries are often completed within a moment (shopping); one history reload covers them.
const HISTORY_RELOAD_DEBOUNCE_MS = 250;

export interface DetailEntry extends Omit<Entry, "details"> {
  details?: string | null;
  created_at?: string;
  is_pending_sync?: boolean;
}

export interface DetailList extends List {
  name?: string;
  owner_name?: string;
  is_pending_sync?: boolean;
}

export interface DetailMember extends Member {
  user_id: string;
  display_name: string;
  email: string;
  is_owner?: boolean;
  is_pending_sync?: boolean;
}

interface LoadEntriesOptions {
  historyItems?: Suggestion[] | null;
  throwOnError?: boolean;
}

interface LoadMembersOptions {
  isOwner?: boolean;
  throwOnError?: boolean;
}

interface UseListDetailDataOptions {
  /** The signed-in user; changes made by other users are marked as changed. */
  currentUserId?: string;
  listId: string;
  onLoadStart?: () => void;
  onNonOwnerList?: () => void;
  /** Temporary ids the offline queue resolved (temp id -> real id); matching entries are swapped. */
  resolvedIds?: Record<string, string>;
  syncVersion: number;
  token: string;
}

export function useListDetailData({
  currentUserId,
  listId,
  onLoadStart,
  onNonOwnerList,
  resolvedIds,
  syncVersion,
  token
}: UseListDetailDataOptions) {
  const { t } = useTranslation();
  const [list, setList] = useState<DetailList | null>(null);
  const [entries, setEntriesState] = useState<DetailEntry[]>([]);
  const entriesRef = useRef<DetailEntry[]>([]);
  const entriesScopeRef = useRef({ listId, token });
  const [members, setMembers] = useState<DetailMember[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<Suggestion[]>([]);
  const [entryError, setEntryError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSharingLoading, setIsSharingLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const locallyDoneIdsRef = useRef<Set<string>>(new Set());
  // Temporary entries whose create request is running right now (not queued, not answered yet).
  const inFlightTempIdsRef = useRef<Set<string>>(new Set());
  // A response that arrives after the user opened another list must not touch the new list's state.
  const currentListIdRef = useRef(listId);
  currentListIdRef.current = listId;

  // Keep an immediate snapshot for async reloads: React may defer state updaters, but
  // both the merge and the following history refresh must see entries queued meanwhile.
  const setEntries = useCallback((value: DetailEntry[] | ((current: DetailEntry[]) => DetailEntry[])) => {
    const nextEntries = typeof value === "function" ? value(entriesRef.current) : value;
    entriesRef.current = nextEntries;
    setEntriesState(nextEntries);
    return nextEntries;
  }, []);

  const historyReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (historyReloadTimerRef.current !== null) {
        clearTimeout(historyReloadTimerRef.current);
        historyReloadTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Decides which queued local entries survive a full reload. A temporary entry stays only while
   * its create is still queued or running; once the change was synced (the server returns the real
   * entry) or discarded from the queue, keeping it would show a duplicate or a phantom entry.
   */
  const createPendingFilter = useCallback(async (): Promise<(entry: DetailEntry) => boolean> => {
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

  const loadEntries = useCallback(
    async ({ historyItems = null, throwOnError = false }: LoadEntriesOptions = {}): Promise<DetailEntry[]> => {
      try {
        const entriesResult = await fetchEntries(listId, token);
        const isStillPending = await createPendingFilter();

        if (currentListIdRef.current !== listId) {
          return entriesRef.current;
        }

        const serverEntries = (entriesResult.entries ?? []).map((entry) => {
          const detailEntry = entry as DetailEntry;

          return locallyDoneIdsRef.current.has(detailEntry.id) && detailEntry.status === "done"
            ? { ...detailEntry, is_changed: true }
            : detailEntry;
        });
        const nextEntries = mergePendingEntries(serverEntries, entriesRef.current, isStillPending);

        if (isMountedRef.current) {
          setEntries(nextEntries);
          setRecentlyUsed((currentItems) => filterRecentlyUsedItems(historyItems ?? currentItems, nextEntries));
        }

        return nextEntries;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      }
    },
    [createPendingFilter, listId, token, setEntries]
  );

  const reloadHistory = useCallback(
    async (entriesOverride?: DetailEntry[]): Promise<void> => {
      try {
        const historyResult = await fetchRecentlyUsed(listId, token);

        if (isMountedRef.current && currentListIdRef.current === listId) {
          setRecentlyUsed((currentItems) =>
            filterRecentlyUsedItems(historyResult?.history ?? currentItems, entriesOverride ?? entries)
          );
        }
      } catch (error) {
        console.error("Failed to load recently used history.", error);
      }
    },
    [entries, listId, token]
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

  const scheduleHistoryReload = useCallback((): void => {
    if (historyReloadTimerRef.current !== null) {
      clearTimeout(historyReloadTimerRef.current);
    }

    historyReloadTimerRef.current = setTimeout(() => {
      historyReloadTimerRef.current = null;
      void reloadHistory(entriesRef.current);
    }, HISTORY_RELOAD_DEBOUNCE_MS);
  }, [reloadHistory]);

  /**
   * Applies an SSE entry event by patching the local entries (no request). Only an event without
   * a usable payload (an older server) falls back to refetching entries and history. The history
   * is reloaded, debounced, only when an entry moved to or from done or a done entry was deleted.
   */
  const handleEntryEvent = useCallback(
    (type: EntryEventType, data: Record<string, unknown>): void => {
      // This tab's own create is still running: its response delivers the entry. Showing the
      // event's copy now would render the same entry twice until the response arrives.
      if (type === "entry:created" && isOwnInFlightCreate(data)) {
        return;
      }

      const result = applyEntryEvent(entriesRef.current, type, data, {
        currentUserId,
        locallyDoneIds: locallyDoneIdsRef.current
      });

      if (!result) {
        void loadEntries().then((nextEntries) => reloadHistory(nextEntries));
        return;
      }

      if (result.entries !== entriesRef.current) {
        const nextEntries = setEntries(result.entries);

        setRecentlyUsed((currentItems) => filterRecentlyUsedItems(currentItems, nextEntries));
        Promise.resolve(writeCachedResource(`entries:${listId}`, { entries: nextEntries })).catch((error: unknown) => {
          console.error("Failed to cache entries.", error);
        });
      }

      if (result.historyChanged) {
        scheduleHistoryReload();
      }
    },
    [currentUserId, isOwnInFlightCreate, listId, loadEntries, reloadHistory, scheduleHistoryReload, setEntries]
  );
  const handleEntryCreated = useCallback((data: Record<string, unknown>) => handleEntryEvent("entry:created", data), [handleEntryEvent]);
  const handleEntryUpdated = useCallback((data: Record<string, unknown>) => handleEntryEvent("entry:updated", data), [handleEntryEvent]);
  const handleEntryDeleted = useCallback((data: Record<string, unknown>) => handleEntryEvent("entry:deleted", data), [handleEntryEvent]);

  const loadMembers = useCallback(
    async ({ isOwner = false, throwOnError = false }: LoadMembersOptions = {}): Promise<DetailMember[]> => {
      if (!isOwner) {
        if (isMountedRef.current) {
          setMembers([]);
          setIsSharingLoading(false);
        }

        return [];
      }

      if (isMountedRef.current) {
        setIsSharingLoading(true);
      }

      try {
        const membersResult = await fetchListMembers(listId, token);
        const nextMembers = (membersResult.members ?? []) as DetailMember[];

        if (isMountedRef.current && currentListIdRef.current === listId) {
          setMembers(nextMembers);
        }

        return nextMembers;
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError);
        }

        if (throwOnError) {
          throw loadError;
        }

        return [];
      } finally {
        if (isMountedRef.current) {
          setIsSharingLoading(false);
        }
      }
    },
    [listId, token]
  );

  const updateEntries = useCallback(
    async (updater: (currentEntries: DetailEntry[]) => DetailEntry[]): Promise<void> => {
      const nextEntries = setEntries(updater);

      await writeCachedResource(`entries:${listId}`, { entries: nextEntries });
    },
    [listId, setEntries]
  );

  const addEntryByText = useCallback(
    async (text: string, icon: string | null, details = ""): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed) {
        return false;
      }

      const nextDetails = normalizeEntryDetails(details);
      const temporaryEntry: DetailEntry = {
        id: createTemporaryId("entry"),
        text: trimmed,
        icon: icon ?? null,
        details: nextDetails,
        status: "open",
        created_at: new Date().toISOString(),
        is_pending_sync: true
      };

      inFlightTempIdsRef.current.add(temporaryEntry.id);
      await updateEntries((currentEntries) => sortEntries([...currentEntries, temporaryEntry]));

      try {
        setEntryError("");
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
            : replaceTemporaryEntry(currentEntries, temporaryEntry.id, result.entry as DetailEntry)
        );
        return true;
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          currentEntries.filter((currentEntry) => currentEntry.id !== temporaryEntry.id)
        );
        setEntryError(getErrorMessage(submitError, t));
        return false;
      } finally {
        inFlightTempIdsRef.current.delete(temporaryEntry.id);
      }
    },
    [listId, t, token, updateEntries]
  );

  const toggleStatus = useCallback(
    async (entry: DetailEntry): Promise<void> => {
      const nextStatus: Entry["status"] = entry.status === "open" ? "done" : "open";
      const isCompletingEntry = nextStatus === "done";
      const optimisticEntry: DetailEntry = {
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
        setRecentlyUsed((currentItems) => upsertRecentlyUsedItems(currentItems, entry));
      }

      try {
        setEntryError("");
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
                          ...(result.entry as DetailEntry),
                          ...(isCompletingEntry ? { is_changed: true } : {})
                        })
                  }
                : currentEntry
            )
          )
        );

        if (isCompletingEntry && !result?.queued) {
          setRecentlyUsed((currentItems) =>
            upsertRecentlyUsedItems(currentItems, result?.entry ?? entry)
          );
        }
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          sortEntries(currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? entry : currentEntry)))
        );

        if (isCompletingEntry) {
          locallyDoneIdsRef.current.delete(entry.id);
          setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== entry.text));
        }

        setEntryError(getErrorMessage(submitError, t));
      }
    },
    [listId, t, token, updateEntries]
  );

  const submitEditEntry = useCallback(
    async (entryId: string, text: string, iconName: string | null, details = ""): Promise<boolean> => {
      const trimmed = text.trim();

      if (!trimmed) {
        return false;
      }

      try {
        setEntryError("");
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
                      : (result.entry as DetailEntry))
                  }
                : currentEntry
            )
          )
        );
        return true;
      } catch (submitError) {
        setEntryError(getErrorMessage(submitError, t));
        return false;
      }
    },
    [listId, t, token, updateEntries]
  );

  const addRecentlyUsedEntry = useCallback(
    async (text: string, icon: string | null, details?: string): Promise<void> => {
      const historyItem = recentlyUsed.find((item) => item.text === text);
      setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));

      const didAdd = await addEntryByText(text, icon, details ?? "");

      if (!didAdd && historyItem) {
        setRecentlyUsed((currentItems) => {
          if (currentItems.some((item) => item.text === historyItem.text)) {
            return currentItems;
          }

          return [historyItem, ...currentItems];
        });
      }
    },
    [addEntryByText, recentlyUsed]
  );

  const dismissRecentlyUsedEntry = useCallback(
    (text: string): void => {
      setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));
      void deleteFromHistory(listId, text, token).catch((error) => {
        console.error("Failed to delete recently used history item.", error);
      });
    },
    [listId, token]
  );

  useEffect(() => {
    let active = true;
    let networkFinished = false;

    async function loadListDetail(): Promise<void> {
      // Only merge pending entries from this list and session, never from the previous route.
      if (entriesScopeRef.current.listId !== listId || entriesScopeRef.current.token !== token) {
        entriesScopeRef.current = { listId, token };
        setEntries([]);
        setList(null);
        setMembers([]);
      }
      setEntryError(null);
      setIsLoading(true);
      setRecentlyUsed([]);
      locallyDoneIdsRef.current = new Set();
      onLoadStart?.();

      try {
        const [listResult, entriesResult, historyResult] = await Promise.all([
          // Only this list's metadata is needed, not every list the user has.
          fetchList(token, listId, {
            onCachedValue: (cached) => {
              if (!active || networkFinished) return;
              if (cached.list) setList(cached.list);
            }
          }).catch((listError: unknown) => {
            // 403/404: the list is gone or not shared with this user. Shown as the access error.
            if (listError instanceof ApiError && (listError.status === 403 || listError.status === 404)) {
              return { list: null };
            }
            throw listError;
          }),
          fetchEntries(listId, token, {
            onCachedValue: (cached) => {
              if (!active || networkFinished) return;
              const nextEntries = mergePendingEntries(cached.entries ?? [], entriesRef.current);
              setEntries(nextEntries);
              setRecentlyUsed((current) => filterRecentlyUsedItems(current, nextEntries));
              setIsLoading(false);
            }
          }),
          fetchRecentlyUsed(listId, token).catch((error) => {
            console.error("Failed to load recently used history.", error);
            return { history: [] };
          })
        ]);
        networkFinished = true;
        const activeList = (listResult.list ?? undefined) as DetailList | undefined;
        const isStillPending = await createPendingFilter();

        if (!active) {
          return;
        }

        if (!activeList) {
          // Translate at render time so arriving language resources cannot restart this load.
          setEntryError(new ListAccessError());
          setList(null);
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
          return;
        }

        setList(activeList);
        // Cached content is interactive while revalidating; preserve queued additions and
        // local completion badges just as subsequent SSE/recovery reloads do.
        const serverEntries = (entriesResult.entries ?? []).map((entry) =>
          locallyDoneIdsRef.current.has(entry.id) && entry.status === "done"
            ? { ...entry, is_changed: true }
            : entry
        );
        const nextEntries = mergePendingEntries(serverEntries, entriesRef.current, isStillPending);
        setEntries(nextEntries);
        setRecentlyUsed(filterRecentlyUsedItems(historyResult?.history ?? [], nextEntries));

        void markListViewed(token, listId).catch((error) => {
          console.error("Failed to mark list viewed.", error);
        });

        if (activeList.is_owner) {
          // Members own their loading/error state and must not delay or clear loaded entries.
          void loadMembers({ isOwner: true });
        } else {
          setMembers([]);
          onNonOwnerList?.();
        }
      } catch (loadError) {
        networkFinished = true;
        if (active) {
          setEntryError(loadError);
          setList(null);
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadListDetail();
    return () => { active = false; };
  }, [createPendingFilter, listId, loadMembers, onLoadStart, onNonOwnerList, syncVersion, token, setEntries]);

  // The offline queue resolved temporary ids: show the real entry instead of the queued one without
  // waiting for the next reload (and never both).
  useEffect(() => {
    if (!resolvedIds || Object.keys(resolvedIds).length === 0) {
      return;
    }

    const reconciled = reconcileResolvedEntries(entriesRef.current, resolvedIds);

    if (reconciled !== entriesRef.current) {
      const nextEntries = setEntries(reconciled);

      Promise.resolve(writeCachedResource(`entries:${listId}`, { entries: nextEntries })).catch((error: unknown) => {
        console.error("Failed to cache entries.", error);
      });
    }
  }, [listId, resolvedIds, setEntries]);

  return {
    addEntryByText,
    addRecentlyUsedEntry,
    dismissRecentlyUsedEntry,
    entries,
    entryError,
    handleEntryCreated,
    handleEntryDeleted,
    handleEntryUpdated,
    isLoading,
    isSharingLoading,
    list,
    loadEntries,
    loadMembers,
    members,
    recentlyUsed,
    reloadHistory,
    setEntryError,
    setIsSharingLoading,
    setList,
    setMembers,
    setRecentlyUsed,
    submitEditEntry,
    toggleStatus
  };
}

function normalizeEntryDetails(details: string): string | null {
  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

