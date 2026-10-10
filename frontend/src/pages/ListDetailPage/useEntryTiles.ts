import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import type { Entry } from "../../types";

interface UseEntryTilesOptions {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onToggle: (entry: Entry) => void;
  searchQuery: string;
}

/**
 * Everything the tile grid needs to stay cheap with a long list.
 *
 * - The open and visible entries are memoised, and the search term is deferred, so typing stays
 *   responsive and the grid is only recomputed when entries or the (deferred) term change.
 * - `handleEdit` / `handleToggle` take an entry id and read the current entries from a ref, which
 *   lets one stable function serve every memoised tile.
 */
export function useEntryTiles({ entries, onEdit, onToggle, searchQuery }: UseEntryTilesOptions) {
  const entriesRef = useRef(entries);
  const onEditRef = useRef(onEdit);
  const onToggleRef = useRef(onToggle);

  useEffect(() => {
    entriesRef.current = entries;
    onEditRef.current = onEdit;
    onToggleRef.current = onToggle;
  });

  const handleEdit = useCallback((entryId: string) => {
    const entry = entriesRef.current.find((candidate) => candidate.id === entryId);

    if (entry) {
      onEditRef.current(entry);
    }
  }, []);
  const handleToggle = useCallback((entryId: string) => {
    const entry = entriesRef.current.find((candidate) => candidate.id === entryId);

    if (entry) {
      onToggleRef.current(entry);
    }
  }, []);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim().toLowerCase();
  const openEntries = useMemo(() => entries.filter((entry) => entry.status === "open"), [entries]);
  const visibleEntries = useMemo(
    () =>
      normalizedSearchQuery
        ? openEntries.filter(
            (entry) =>
              entry.text.toLowerCase().includes(normalizedSearchQuery) ||
              (entry.details ?? "").toLowerCase().includes(normalizedSearchQuery)
          )
        : openEntries,
    [normalizedSearchQuery, openEntries]
  );

  return { handleEdit, handleToggle, normalizedSearchQuery, openEntries, visibleEntries };
}
