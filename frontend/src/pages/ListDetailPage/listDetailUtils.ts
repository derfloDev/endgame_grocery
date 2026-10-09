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

/** Open entries first, then by creation time. */
export function sortEntries(entries: DetailEntry[]): DetailEntry[] {
  return [...entries].sort((left, right) => {
    if (left.status === right.status) {
      return new Date(left.created_at ?? 0).getTime() - new Date(right.created_at ?? 0).getTime();
    }

    return left.status === "open" ? -1 : 1;
  });
}

export type EntryEventType = "entry:created" | "entry:updated" | "entry:deleted";

export interface EntryEventResult {
  entries: DetailEntry[];
  /** Whether the recently used history may have changed (an entry moved to/from done, or a done entry was deleted). */
  historyChanged: boolean;
}

interface ApplyEntryEventOptions {
  currentUserId: string | undefined;
  /** Ids of entries this client completed itself; they keep their "done" badge. */
  locallyDoneIds: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Patches the entry list with the payload of an SSE entry event instead of refetching it.
 *
 * - `entry:created` / `entry:updated` upsert the entry carried in `data.entry`; `entry:deleted`
 *   removes `data.entryId`.
 * - Idempotent: when the event changes nothing (the same event twice, or the actor's own change that
 *   this client already holds), the very same array is returned so React skips the update.
 * - Entries queued locally (`is_pending_sync`) are never replaced or dropped; an event about an
 *   entry whose local change is still in flight is ignored, because the response of that request
 *   delivers the authoritative state.
 * - `is_changed` marks changes by other users, like the server does for the entries GET; entries
 *   completed on this client keep their done badge.
 *
 * @returns The new entries and whether the history needs a reload, or `null` when the payload is
 *   incomplete (an older server); the caller then falls back to a full refetch.
 */
export function applyEntryEvent(
  entries: DetailEntry[],
  type: EntryEventType,
  data: Record<string, unknown>,
  { currentUserId, locallyDoneIds }: ApplyEntryEventOptions
): EntryEventResult | null {
  if (type === "entry:deleted") {
    // Without the status of the deleted entry (an older server) nobody can tell whether the
    // history changed, so the caller refetches.
    if (typeof data.entryId !== "string" || (data.entryStatus !== "open" && data.entryStatus !== "done")) {
      return null;
    }

    const existing = entries.find((candidate) => candidate.id === data.entryId);

    return {
      entries: existing ? entries.filter((candidate) => candidate.id !== data.entryId) : entries,
      historyChanged: data.entryStatus === "done"
    };
  }

  const payload = data.entry;

  if (!isRecord(payload) || typeof payload.id !== "string" || (data.entryId !== undefined && data.entryId !== payload.id)) {
    return null;
  }

  const existing = entries.find((candidate) => candidate.id === payload.id);

  if (existing?.is_pending_sync) {
    return { entries, historyChanged: false };
  }

  const nextStatus = payload.status;
  const previousStatus = existing?.status ?? (type === "entry:created" ? "open" : null);
  const historyChanged =
    (nextStatus === "done" && previousStatus !== "done") || (previousStatus === "done" && nextStatus !== "done");
  const isChanged =
    nextStatus === "done" && locallyDoneIds.has(payload.id) ? true : payload.last_updated_by !== currentUserId;
  const nextEntry = { ...payload, is_changed: isChanged } as unknown as DetailEntry;

  if (existing && Object.entries(nextEntry).every(([key, value]) => (existing as unknown as Record<string, unknown>)[key] === value)) {
    return { entries, historyChanged };
  }

  const nextEntries = existing
    ? entries.map((candidate) => (candidate.id === payload.id ? nextEntry : candidate))
    : [...entries, nextEntry];

  return { entries: sortEntries(nextEntries), historyChanged };
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
