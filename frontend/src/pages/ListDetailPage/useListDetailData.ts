import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/errors";
import { fetchEntries } from "../../api/entries";
import { fetchRecentlyUsed } from "../../api/history";
import { fetchList, markListViewed, renameList as renameListRequest } from "../../api/lists";
import type { Entry, List } from "../../types";
import { createAccessError, toListDetailError } from "./listDetailErrors";
import type { ListDetailError } from "./listDetailErrors";
import { useActiveList } from "./useActiveList";
import { useListEntries } from "./useListEntries";
import { useListMembers } from "./useListMembers";
import { useRecentlyUsed } from "./useRecentlyUsed";

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

/**
 * Everything the list detail page shows and does, composed from three focused hooks:
 * `useListEntries` (entries and their commands), `useListMembers` (sharing) and `useRecentlyUsed`
 * (history suggestions). This hook adds the list's own metadata, the initial load that brings the
 * three together, and one error state.
 *
 * It exposes state and commands only; nothing in the result is a state setter.
 */
export function useListDetailData({
  currentUserId,
  listId,
  onLoadStart,
  onNonOwnerList,
  resolvedIds,
  syncVersion,
  token
}: UseListDetailDataOptions) {
  const active = useActiveList(listId);
  const [list, setList] = useState<List | null>(null);
  const [error, setError] = useState<ListDetailError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const scopeRef = useRef({ listId, token });
  const reportError = useCallback((reported: unknown): void => setError(toListDetailError(reported)), []);
  const clearError = useCallback((): void => setError(null), []);

  // The history needs the current entries and the entries need the history commands; the accessor
  // breaks that cycle.
  const entriesAccessorRef = useRef<() => Entry[]>(() => []);
  const getEntries = useCallback(() => entriesAccessorRef.current(), []);
  const recentlyUsed = useRecentlyUsed({ active, getEntries, listId, token });
  const history = recentlyUsed.commands;
  const entryList = useListEntries({ active, clearError, currentUserId, history, listId, reportError, resolvedIds, token });
  entriesAccessorRef.current = entryList.getEntries;
  const memberList = useListMembers({ active, listId, reportError, token });
  const { loadMembers } = memberList;

  const clearMembers = memberList.clear;
  const clearEntries = entryList.clear;
  const { addEntry, applyCachedEntries, applyServerEntries, beginLoad, createPendingFilter, loadEntries } = entryList;

  useEffect(() => {
    let isActive = true;
    let networkFinished = false;

    async function loadListDetail(): Promise<void> {
      // Only merge pending entries from this list and session, never from the previous route.
      if (scopeRef.current.listId !== listId || scopeRef.current.token !== token) {
        scopeRef.current = { listId, token };
        clearEntries();
        setList(null);
        clearMembers();
      }
      clearError();
      setIsLoading(true);
      history.reset();
      beginLoad();
      onLoadStart?.();

      try {
        const [listResult, entriesResult, historyResult] = await Promise.all([
          // Only this list's metadata is needed, not every list the user has.
          fetchList(token, listId, {
            onCachedValue: (cached) => {
              if (!isActive || networkFinished) return;
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
              if (!isActive || networkFinished) return;
              applyCachedEntries(cached.entries ?? []);
              setIsLoading(false);
            }
          }),
          fetchRecentlyUsed(listId, token).catch((historyError) => {
            console.error("Failed to load recently used history.", historyError);
            return { history: [] };
          })
        ]);
        networkFinished = true;
        const activeList = listResult.list ?? undefined;
        const isStillPending = await createPendingFilter();

        if (!isActive) {
          return;
        }

        if (!activeList) {
          // Kept as a kind, not as text, so arriving language resources cannot restart this load.
          setError(createAccessError());
          setList(null);
          clearEntries();
          clearMembers();
          history.reset();
          return;
        }

        setList(activeList);
        // Cached content is interactive while revalidating; preserve queued additions and
        // local completion badges just as subsequent SSE/recovery reloads do.
        const nextEntries = applyServerEntries(entriesResult.entries ?? [], isStillPending);
        history.replaceFromServer(historyResult?.history ?? [], nextEntries);

        void markListViewed(token, listId).catch((viewError) => {
          console.error("Failed to mark list viewed.", viewError);
        });

        if (activeList.is_owner) {
          // Members own their loading/error state and must not delay or clear loaded entries.
          void loadMembers({ isOwner: true });
        } else {
          clearMembers();
          onNonOwnerList?.();
        }
      } catch (loadError) {
        networkFinished = true;
        if (isActive) {
          reportError(loadError);
          setList(null);
          clearEntries();
          clearMembers();
          history.reset();
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadListDetail();
    return () => { isActive = false; };
  }, [
    applyCachedEntries,
    applyServerEntries,
    beginLoad,
    clearEntries,
    clearError,
    clearMembers,
    createPendingFilter,
    history,
    listId,
    loadMembers,
    onLoadStart,
    onNonOwnerList,
    reportError,
    syncVersion,
    token
  ]);

  /** Renames the list on the server and shows the new name (queued while offline). Throws on failure. */
  const renameList = useCallback(
    async (newName: string): Promise<void> => {
      try {
        clearError();
        const result = await renameListRequest(token, listId, { name: newName });
        setList((currentList) =>
          currentList
            ? {
                ...currentList,
                name: result?.queued ? newName : result.list?.name ?? newName,
                is_pending_sync: result?.queued ? true : currentList.is_pending_sync
              }
            : currentList
        );
      } catch (submitError) {
        reportError(submitError);
        throw submitError;
      }
    },
    [clearError, listId, reportError, token]
  );

  /** Fetches the list's own metadata again (somebody renamed it); the entries stay untouched. */
  const refreshList = useCallback((): void => {
    void fetchList(token, listId)
      .then((result) => setList((currentList) => (currentList ? { ...currentList, ...result.list } : result.list)))
      .catch((refreshError: unknown) => console.error("Failed to refresh the list.", refreshError));
  }, [listId, token]);

  /** Re-adds a suggestion from the history; it comes back when adding fails. */
  const addRecentlyUsedEntry = useCallback(
    async (text: string, icon: string | null, details?: string): Promise<void> => {
      const restore = history.reserve(text);
      const didAdd = await addEntry(text, icon, details ?? "");

      if (!didAdd) {
        restore();
      }
    },
    [addEntry, history]
  );

  const isOwner = list?.is_owner ?? false;

  /** Reloads members after somebody joined or left (a no-op request for non-owners). */
  const handleMemberChange = useCallback(() => void loadMembers({ isOwner }), [isOwner, loadMembers]);
  /** Reloads only the history (it changed on the server). */
  const handleHistoryChange = useCallback(() => void history.reload(), [history]);

  /** Refetches everything after a reconnect or a return to the foreground. */
  const resync = useCallback(
    () =>
      loadEntries().then((nextEntries) =>
        Promise.all([history.reload(nextEntries), loadMembers({ isOwner })])
      ),
    [history, isOwner, loadEntries, loadMembers]
  );

  return {
    addEntry,
    addRecentlyUsedEntry,
    clearError,
    dismissRecentlyUsedEntry: history.dismiss,
    editEntry: entryList.editEntry,
    entries: entryList.entries,
    error,
    handleEntryCreated: entryList.handleEntryCreated,
    handleEntryDeleted: entryList.handleEntryDeleted,
    handleEntryUpdated: entryList.handleEntryUpdated,
    handleHistoryChange,
    handleMemberChange,
    isLoading,
    isSharingLoading: memberList.isSharingLoading,
    list,
    loadEntries,
    loadMembers,
    members: memberList.members,
    recentlyUsed: recentlyUsed.items,
    refreshList,
    reloadHistory: history.reload,
    renameList,
    reportError,
    resync,
    revokeMember: memberList.revokeMember,
    shareWithMember: memberList.shareWithMember,
    toggleEntry: entryList.toggleEntry
  };
}
