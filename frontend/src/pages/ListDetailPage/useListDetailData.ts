import { useCallback, useEffect, useRef, useState } from "react";
import { createTemporaryId } from "../../api/client";
import { createEntry, fetchEntries, updateEntry } from "../../api/entries";
import { deleteFromHistory, fetchRecentlyUsed } from "../../api/history";
import { fetchLists } from "../../api/lists";
import { writeCachedResource } from "../../api/offlineStore";
import { fetchListMembers } from "../../api/sharing";
import type { Entry, List, Member, Suggestion } from "../../types";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "../recentlyUsedState";

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
  accessErrorMessage: string;
  listId: string;
  onLoadStart?: () => void;
  onNonOwnerList?: () => void;
  syncVersion: number;
  token: string;
}

export function useListDetailData({
  accessErrorMessage,
  listId,
  onLoadStart,
  onNonOwnerList,
  syncVersion,
  token
}: UseListDetailDataOptions) {
  const [list, setList] = useState<DetailList | null>(null);
  const [entries, setEntries] = useState<DetailEntry[]>([]);
  const [members, setMembers] = useState<DetailMember[]>([]);
  const [recentlyUsed, setRecentlyUsed] = useState<Suggestion[]>([]);
  const [entryError, setEntryError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSharingLoading, setIsSharingLoading] = useState<boolean>(false);
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadEntries = useCallback(
    async ({ historyItems = null, throwOnError = false }: LoadEntriesOptions = {}): Promise<DetailEntry[]> => {
      try {
        const entriesResult = await fetchEntries(listId, token);
        const nextEntries = (entriesResult.entries ?? []) as DetailEntry[];

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
    [listId, token]
  );

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

        if (isMountedRef.current) {
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
      let nextEntries: DetailEntry[] = [];

      setEntries((currentEntries) => {
        nextEntries = updater(currentEntries);
        return nextEntries;
      });

      await writeCachedResource(`entries:${listId}`, { entries: nextEntries });
    },
    [listId]
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
          sortEntries(
            currentEntries.map((currentEntry) =>
              currentEntry.id === temporaryEntry.id
                ? result?.queued
                  ? temporaryEntry
                  : (result.entry as DetailEntry)
                : currentEntry
            )
          )
        );
        return true;
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          currentEntries.filter((currentEntry) => currentEntry.id !== temporaryEntry.id)
        );
        setEntryError(getErrorMessage(submitError));
        return false;
      }
    },
    [listId, token, updateEntries]
  );

  const toggleStatus = useCallback(
    async (entry: DetailEntry): Promise<void> => {
      const nextStatus: Entry["status"] = entry.status === "open" ? "done" : "open";
      const optimisticEntry: DetailEntry = { ...entry, status: nextStatus, is_pending_sync: true };

      await updateEntries((currentEntries) =>
        sortEntries(
          currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? optimisticEntry : currentEntry))
        )
      );

      if (nextStatus === "done") {
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
                    ...(result?.queued ? { is_pending_sync: true, status: nextStatus } : (result.entry as DetailEntry))
                  }
                : currentEntry
            )
          )
        );

        if (nextStatus === "done" && !result?.queued) {
          setRecentlyUsed((currentItems) =>
            upsertRecentlyUsedItems(currentItems, result?.entry ?? entry)
          );
        }
      } catch (submitError) {
        await updateEntries((currentEntries) =>
          sortEntries(currentEntries.map((currentEntry) => (currentEntry.id === entry.id ? entry : currentEntry)))
        );

        if (nextStatus === "done") {
          setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== entry.text));
        }

        setEntryError(getErrorMessage(submitError));
      }
    },
    [listId, token, updateEntries]
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
        setEntryError(getErrorMessage(submitError));
        return false;
      }
    },
    [listId, token, updateEntries]
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
    async function loadListDetail(): Promise<void> {
      setEntryError(null);
      setIsLoading(true);
      setRecentlyUsed([]);
      onLoadStart?.();

      try {
        const [listsResult, entriesResult, historyResult] = await Promise.all([
          fetchLists(token),
          fetchEntries(listId, token),
          fetchRecentlyUsed(listId, token).catch((error) => {
            console.error("Failed to load recently used history.", error);
            return { history: [] };
          })
        ]);
        const activeList = ((listsResult.lists ?? []) as DetailList[]).find((candidate) => candidate.id === listId);

        if (!isMountedRef.current) {
          return;
        }

        if (!activeList) {
          setEntryError(accessErrorMessage);
          setList(null);
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
          return;
        }

        setList(activeList);
        const nextEntries = (entriesResult.entries ?? []) as DetailEntry[];
        setEntries(nextEntries);
        setRecentlyUsed(filterRecentlyUsedItems(historyResult?.history ?? [], nextEntries));

        if (activeList.is_owner) {
          await loadMembers({
            isOwner: true,
            throwOnError: true
          });
        } else {
          setMembers([]);
          onNonOwnerList?.();
        }
      } catch (loadError) {
        if (isMountedRef.current) {
          setEntryError(loadError);
          setList(null);
          setEntries([]);
          setMembers([]);
          setRecentlyUsed([]);
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsSharingLoading(false);
        }
      }
    }

    void loadListDetail();
  }, [accessErrorMessage, listId, loadMembers, onLoadStart, onNonOwnerList, syncVersion, token]);

  return {
    addEntryByText,
    addRecentlyUsedEntry,
    dismissRecentlyUsedEntry,
    entries,
    entryError,
    isLoading,
    isSharingLoading,
    list,
    loadEntries,
    loadMembers,
    members,
    recentlyUsed,
    setEntryError,
    setIsSharingLoading,
    setList,
    setMembers,
    setRecentlyUsed,
    submitEditEntry,
    toggleStatus
  };
}

function sortEntries(entries: DetailEntry[]): DetailEntry[] {
  return [...entries].sort((left, right) => {
    if (left.status === right.status) {
      return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
    }

    return left.status === "open" ? -1 : 1;
  });
}

function normalizeEntryDetails(details: string): string | null {
  const trimmedDetails = details.trim();
  return trimmedDetails ? trimmedDetails : null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
