import type { Entry, Suggestion } from "../types";

type RecentlyUsedEntry = Pick<Entry, "text" | "icon"> & { details?: string | null };
type OpenEntry = Pick<Entry, "text" | "status">;
type RecentlyUsedDisplayEntry = Pick<Entry, "text" | "icon" | "details" | "status" | "is_changed">;

interface RecentlyUsedDisplayState {
  changedDoneTexts: ReadonlySet<string>;
  visibleRecentlyUsed: Suggestion[];
}

export function upsertRecentlyUsedItems(currentItems: Suggestion[], entry: RecentlyUsedEntry): Suggestion[] {
  const text = entry?.text?.trim();

  if (!text) {
    return currentItems;
  }

  const existing = currentItems.find((item) => item.text === text);
  const details = entry.details ?? existing?.details;
  const nextItem = {
    text,
    icon: entry.icon ?? existing?.icon ?? null,
    ...(details !== undefined ? { details } : {}),
    useCount: (existing?.useCount ?? 0) + 1
  };

  return [nextItem, ...currentItems.filter((item) => item.text !== text)].slice(0, 20);
}

export function filterRecentlyUsedItems(historyItems: Suggestion[], entriesOrOpenEntries: OpenEntry[]): Suggestion[] {
  const openTexts = new Set(
    entriesOrOpenEntries.filter((entry) => entry.status === "open").map((entry) => entry.text)
  );

  return historyItems.filter((item) => !openTexts.has(item.text));
}

export function getRecentlyUsedDisplayState(
  historyItems: Suggestion[],
  entries: RecentlyUsedDisplayEntry[],
  openEntries: OpenEntry[]
): RecentlyUsedDisplayState {
  const changedDoneTexts = new Set<string>();
  const changedDoneItems: Suggestion[] = [];

  for (const entry of entries) {
    if (entry.status !== "done" || !entry.is_changed || changedDoneTexts.has(entry.text)) {
      continue;
    }

    changedDoneTexts.add(entry.text);
    changedDoneItems.push({
      text: entry.text,
      icon: entry.icon ?? null,
      ...(entry.details ? { details: entry.details } : {})
    });
  }

  return {
    changedDoneTexts,
    visibleRecentlyUsed: [
      ...changedDoneItems,
      ...filterRecentlyUsedItems(historyItems, openEntries).filter((item) => !changedDoneTexts.has(item.text))
    ]
  };
}
