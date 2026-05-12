import { describe, expect, it } from "vitest";
import { filterRecentlyUsedItems, upsertRecentlyUsedItems } from "./recentlyUsedState";

describe("recentlyUsedState", () => {
  it("prepends a new item and caps the list at 20", () => {
    const currentItems = Array.from({ length: 20 }, (_, index) => ({
      text: `Item ${index + 1}`,
      icon: null,
      useCount: index + 1
    }));

    const nextItems = upsertRecentlyUsedItems(currentItems, { text: "Newest", icon: "IconSparkles" });

    expect(nextItems).toHaveLength(20);
    expect(nextItems[0]).toEqual({ text: "Newest", icon: "IconSparkles", useCount: 1 });
    expect(nextItems.at(-1)?.text).toBe("Item 19");
  });

  it("moves an existing item to the front and increments its use count", () => {
    const currentItems = [
      { text: "Bread", icon: "IconBread", useCount: 2 },
      { text: "Tomatoes", icon: "IconSalad", useCount: 7 },
      { text: "Milk", icon: "IconMilk", useCount: 1 }
    ];

    const nextItems = upsertRecentlyUsedItems(currentItems, { text: "Tomatoes", icon: "IconSalad" });

    expect(nextItems).toEqual([
      { text: "Tomatoes", icon: "IconSalad", useCount: 8 },
      { text: "Bread", icon: "IconBread", useCount: 2 },
      { text: "Milk", icon: "IconMilk", useCount: 1 }
    ]);
  });

  it("filters out items that are currently open on the list", () => {
    const historyItems = [
      { text: "Bread", icon: "IconBread", useCount: 2 },
      { text: "Tomatoes", icon: "IconSalad", useCount: 7 }
    ];
    const entries = [
      { id: "entry-1", text: "Tomatoes", status: "open" as const },
      { id: "entry-2", text: "Milk", status: "done" as const }
    ];

    expect(filterRecentlyUsedItems(historyItems, entries)).toEqual([
      { text: "Bread", icon: "IconBread", useCount: 2 }
    ]);
  });
});
