import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteFromHistory, fetchRecentlyUsed } from "../../api/history";
import type { Entry, Suggestion } from "../../types";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "../recentlyUsedState";
import type { ActiveList } from "./useActiveList";

// Several entries are often completed within a moment (shopping); one history reload covers them.
const HISTORY_RELOAD_DEBOUNCE_MS = 250;

interface UseRecentlyUsedOptions {
  active: ActiveList;
  /** Current entries of the list; history items that are open again are hidden. */
  getEntries: () => Entry[];
  listId: string;
  token: string;
}

export type RecentlyUsedCommands = ReturnType<typeof useRecentlyUsed>["commands"];

/**
 * The "recently used" suggestions of a list: items that were completed before and can be re-added.
 * Exposes commands only; the items are derived from the server's history and the open entries.
 */
export function useRecentlyUsed({ active, getEntries, listId, token }: UseRecentlyUsedOptions) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const itemsRef = useRef<Suggestion[]>([]);
  itemsRef.current = items;
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (reloadTimerRef.current !== null) {
        clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
    },
    []
  );

  /** Loads the history from the server. `entries` defaults to the current entries. */
  const reload = useCallback(
    async (entries?: Entry[]): Promise<void> => {
      try {
        const historyResult = await fetchRecentlyUsed(listId, token);

        if (active.isMounted() && active.isCurrent(listId)) {
          setItems((currentItems) => filterRecentlyUsedItems(historyResult?.history ?? currentItems, entries ?? getEntries()));
        }
      } catch (error) {
        console.error("Failed to load recently used history.", error);
      }
    },
    [active, getEntries, listId, token]
  );

  /** Reloads once after a burst of calls (debounced). */
  const scheduleReload = useCallback((): void => {
    if (reloadTimerRef.current !== null) {
      clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      void reload(getEntries());
    }, HISTORY_RELOAD_DEBOUNCE_MS);
  }, [getEntries, reload]);

  /** Hides items that are open entries again; `historyItems` replaces the items when given. */
  const filterAgainst = useCallback((entries: Entry[], historyItems?: Suggestion[] | null): void => {
    setItems((currentItems) => filterRecentlyUsedItems(historyItems ?? currentItems, entries));
  }, []);

  /** Replaces the items by the server's history, hiding the ones that are open entries. */
  const replaceFromServer = useCallback((history: Suggestion[], entries: Entry[]): void => {
    setItems(filterRecentlyUsedItems(history, entries));
  }, []);

  /** An entry was completed: it becomes a suggestion right away. */
  const markCompleted = useCallback((entry: Entry): void => {
    setItems((currentItems) => upsertRecentlyUsedItems(currentItems, entry));
  }, []);

  /** Takes back {@link markCompleted} for an entry whose completion failed. */
  const unmarkCompleted = useCallback((text: string): void => {
    setItems((currentItems) => currentItems.filter((item) => item.text !== text));
  }, []);

  const reset = useCallback((): void => {
    setItems([]);
  }, []);

  /** Removes a suggestion for good (also on the server). */
  const dismiss = useCallback(
    (text: string): void => {
      setItems((currentItems) => currentItems.filter((item) => item.text !== text));
      void deleteFromHistory(listId, text, token).catch((error) => {
        console.error("Failed to delete recently used history item.", error);
      });
    },
    [listId, token]
  );

  /**
   * Hides a suggestion while it is being re-added. The returned function puts it back when adding
   * failed, unless an equal item is back already.
   */
  const reserve = useCallback(
    (text: string): (() => void) => {
      const historyItem = itemsRef.current.find((item) => item.text === text);
      setItems((currentItems) => currentItems.filter((item) => item.text !== text));

      return () => {
        if (!historyItem) {
          return;
        }

        setItems((currentItems) =>
          currentItems.some((item) => item.text === historyItem.text) ? currentItems : [historyItem, ...currentItems]
        );
      };
    },
    []
  );

  // One stable object, so hooks that call these commands do not change identity with every render.
  const commands = useMemo(
    () => ({ dismiss, filterAgainst, markCompleted, reload, replaceFromServer, reserve, reset, scheduleReload, unmarkCompleted }),
    [dismiss, filterAgainst, markCompleted, reload, replaceFromServer, reserve, reset, scheduleReload, unmarkCompleted]
  );

  return { commands, items };
}
