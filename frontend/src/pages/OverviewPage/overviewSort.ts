import type { List } from "../../types";

export type OverviewSortMode = "created_asc" | "name_asc" | "activity_desc";

export const DEFAULT_OVERVIEW_SORT: OverviewSortMode = "created_asc";

export function isOverviewSortMode(value: string | null): value is OverviewSortMode {
  return value === "created_asc" || value === "name_asc" || value === "activity_desc";
}

export function sortLists<T extends List>(lists: T[], mode: OverviewSortMode): T[] {
  return [...lists].sort((left, right) => {
    if (mode === "name_asc") {
      return comparePresentValues(left.name, right.name, (a, b) => a.localeCompare(b));
    }

    if (mode === "activity_desc") {
      return comparePresentValues(left.last_activity, right.last_activity, (a, b) =>
        b.localeCompare(a)
      );
    }

    return comparePresentValues(left.created_at, right.created_at, (a, b) =>
      a.localeCompare(b)
    );
  });
}

function comparePresentValues(
  left: string | undefined,
  right: string | undefined,
  compare: (left: string, right: string) => number
): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return compare(left, right);
}
