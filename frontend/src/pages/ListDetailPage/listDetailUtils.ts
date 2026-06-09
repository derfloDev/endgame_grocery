import type { DetailEntry } from "./useListDetailData";

export function getInitials(name: unknown): string {
  if (typeof name !== "string") {
    return "?";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  return parts.length
    ? parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
    : "?";
}

export function getChangeKind(entry: DetailEntry): "new" | "edited" | "done" | undefined {
  if (!entry.is_changed) {
    return undefined;
  }

  if (entry.status === "done") {
    return "done";
  }

  const createdAt = Date.parse(entry.created_at ?? "");
  const updatedAt = Date.parse(entry.updated_at ?? "");

  return Number.isFinite(createdAt) && Number.isFinite(updatedAt) && updatedAt > createdAt
    ? "edited"
    : "new";
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
