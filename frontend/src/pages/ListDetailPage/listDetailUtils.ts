import type { DetailEntry } from "./useListDetailData";

export class ListAccessError extends Error {
  constructor() {
    super("detail.accessError");
    this.name = "ListAccessError";
  }
}

/** Keep queued local entries absent from the server until sync can return their IDs. */
export function mergePendingEntries(serverEntries: readonly DetailEntry[], currentEntries: readonly DetailEntry[]): DetailEntry[] {
  const serverIds = new Set(serverEntries.map((entry) => entry.id));
  return [
    ...serverEntries,
    ...currentEntries.filter((entry) => entry.is_pending_sync && !serverIds.has(entry.id))
  ];
}

interface ShareInviteResult {
  queued?: boolean;
  invite?: { invited_email?: string };
}

export function isShareInviteResult(value: unknown): value is ShareInviteResult {
  return Boolean(value) && typeof value === "object";
}

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

export function getErrorMessage(error: unknown, accessErrorMessage = "detail.accessError"): string {
  if (error instanceof ListAccessError) {
    return accessErrorMessage;
  }

  return error instanceof Error ? error.message : String(error);
}
