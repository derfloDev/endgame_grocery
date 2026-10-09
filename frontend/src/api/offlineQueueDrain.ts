import { getAuthToken } from "./authSession";
import { abortable } from "./connectionTimings";
import { completeOfflineMutation, listOfflineMutations } from "./offlineStore";
import { requestJson } from "./request";

// Remember accepted responses until local persistence succeeds, so a storage retry cannot resend them.
export type AcceptedMutations = Map<string, Record<string, string>>;

/** Message of a mutation that points at a temporary id whose creating change no longer exists. */
export const DEPENDENCY_DISCARDED_MESSAGE = "A change this one depends on was discarded.";

export interface DrainResult {
  /** Mutations accepted by the server in this run. */
  count: number;
  /** Client error on one mutation; it stays queued until the user discards it. */
  failed?: { id: string; error: string; code?: "dependency" };
  /** The server rejected the session (or there is none): the queue is paused and nothing was discarded. */
  authExpired?: true;
  /** Temporary ids that received their real id in this run. */
  resolvedIds?: Record<string, string>;
}

// The shape produced by `createTemporaryId`: temp-<resource>-<timestamp>-<random>.
const TEMPORARY_ID_PATTERN = /^temp-[a-z]+-\d{10,}-[a-z0-9]+$/;

/**
 * Sends the signed-in user's queued mutations in order.
 *
 * The `Authorization` header uses the token that is current *now*; tokens are not stored with the
 * mutations, so a change queued before a re-login is sent with the new session. A 401 stops the run
 * without discarding anything, so the queue resumes after the next login.
 */
export async function drainOfflineQueue(signal: AbortSignal, timeoutMs: number, accepted: AcceptedMutations): Promise<DrainResult> {
  let count = 0;
  const newlyResolved: Record<string, string> = {};
  const finish = (extra: Partial<DrainResult> = {}): DrainResult => ({
    count,
    ...(Object.keys(newlyResolved).length ? { resolvedIds: { ...newlyResolved } } : {}),
    ...extra
  });

  while (!signal.aborted) {
    const pending = await abortable(listOfflineMutations(), signal);
    signal.throwIfAborted();
    const mutation = pending[0];
    if (!mutation) return finish();
    const idMap = Object.assign({}, ...pending.map((entry) => entry.resolvedIds ?? {})) as Record<string, string>;
    let resolvedIds = accepted.get(mutation.id);
    if (!resolvedIds) {
      const token = getAuthToken();
      if (!token) return finish({ authExpired: true });
      const url = replaceTemporaryIds(mutation.url, idMap);
      const payload = replaceTemporaryIds(mutation.payload, idMap);
      // The change that would have created this id was discarded; sending it would hit a 404/400.
      if (containsTemporaryId(url) || containsTemporaryId(payload)) {
        return finish({ failed: { id: mutation.id, error: DEPENDENCY_DISCARDED_MESSAGE, code: "dependency" } });
      }
      const { response, data } = await requestJson(
        url,
        {
          method: mutation.method,
          headers: {
            ...(payload ? { "Content-Type": "application/json" } : {}),
            Authorization: `Bearer ${token}`
          },
          ...(payload ? { body: JSON.stringify(payload) } : {})
        },
        timeoutMs,
        signal
      );
      signal.throwIfAborted();
      if (response.status === 401) return finish({ authExpired: true });
      if (!response.ok) {
        const error = isRecord(data) && typeof data.error === "string" ? data.error : "Failed to sync queued changes.";
        // Client errors require discard; network errors, deadlines and server errors retry quietly.
        if (response.status >= 400 && response.status < 500) return finish({ failed: { id: mutation.id, error } });
        throw new Error(error);
      }
      resolvedIds = { ...idMap };
      const resourceType = mutation.queueMeta?.resourceType;
      const resource = isRecord(data) && resourceType ? data[resourceType] : null;
      if (mutation.queueMeta?.tempId && isRecord(resource) && typeof resource.id === "string") {
        resolvedIds[mutation.queueMeta.tempId] = resource.id;
      }
      accepted.set(mutation.id, resolvedIds);
    }
    await abortable(completeOfflineMutation(mutation.id, resolvedIds), signal);
    signal.throwIfAborted();
    if (mutation.queueMeta?.tempId && resolvedIds[mutation.queueMeta.tempId]) {
      newlyResolved[mutation.queueMeta.tempId] = resolvedIds[mutation.queueMeta.tempId];
    }
    accepted.delete(mutation.id);
    count += 1;
  }
  signal.throwIfAborted();
  return finish();
}

/**
 * Swaps temporary ids for real ones, matching *whole* path segments and *whole* string values.
 * Substring replacement would turn `temp-10` into `real-10`'s prefix mess when `temp-1` resolved
 * first, and would also rewrite free text that merely mentions an id.
 */
export function replaceTemporaryIds<T>(value: T, ids: Record<string, string>): T {
  if (typeof value === "string") {
    if (Object.hasOwn(ids, value)) return ids[value] as T;
    if (!value.includes("/")) return value;
    return value.split("/").map((segment) => (Object.hasOwn(ids, segment) ? ids[segment] : segment)).join("/") as T;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceTemporaryIds(entry, ids)) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceTemporaryIds(entry, ids)])) as T;
  return value;
}

function containsTemporaryId(value: unknown): boolean {
  if (typeof value === "string") {
    // Whole path segments or whole values only, so free text that merely starts with "temp-" is sent.
    return value.split("/").some((segment) => TEMPORARY_ID_PATTERN.test(segment.split("?")[0]));
  }
  if (Array.isArray(value)) return value.some(containsTemporaryId);
  if (isRecord(value)) return Object.values(value).some(containsTemporaryId);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
