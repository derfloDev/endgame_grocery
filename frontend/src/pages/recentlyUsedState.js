export function upsertRecentlyUsedItems(currentItems, entry) {
  const text = entry?.text?.trim();

  if (!text) {
    return currentItems;
  }

  const existing = currentItems.find((item) => item.text === text);
  const nextItem = {
    text,
    icon: entry.icon ?? existing?.icon ?? null,
    useCount: (existing?.useCount ?? 0) + 1
  };

  return [nextItem, ...currentItems.filter((item) => item.text !== text)].slice(0, 20);
}

export function filterRecentlyUsedItems(historyItems, entriesOrOpenEntries) {
  const openTexts = new Set(
    entriesOrOpenEntries.filter((entry) => entry.status === "open").map((entry) => entry.text)
  );

  return historyItems.filter((item) => !openTexts.has(item.text));
}
