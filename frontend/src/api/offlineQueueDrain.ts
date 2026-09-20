import { abortable } from "./connectionTimings";
import { completeOfflineMutation, listOfflineMutations } from "./offlineStore";
import { requestJson } from "./request";

// Remember accepted responses until local persistence succeeds, so a storage retry cannot resend them.
export type AcceptedMutations = Map<string, Record<string, string>>;

export async function drainOfflineQueue(signal: AbortSignal, timeoutMs: number, accepted: AcceptedMutations): Promise<{ count: number; failed?: { id: string; error: string } }> {
  let count = 0;
  while (!signal.aborted) {
    const pending = await abortable(listOfflineMutations(), signal);
    signal.throwIfAborted();
    const mutation = pending[0];
    if (!mutation) return { count };
    const idMap = Object.assign({}, ...pending.map((entry) => entry.resolvedIds ?? {})) as Record<string, string>;
    let resolvedIds = accepted.get(mutation.id);
    if (!resolvedIds) {
      const payload = replaceTemporaryIds(mutation.payload, idMap);
      const { response, data } = await requestJson(
        replaceTemporaryIds(mutation.url, idMap),
        {
          method: mutation.method,
          headers: {
            ...(payload ? { "Content-Type": "application/json" } : {}),
            ...(mutation.token ? { Authorization: `Bearer ${mutation.token}` } : {})
          },
          ...(payload ? { body: JSON.stringify(payload) } : {})
        },
        timeoutMs,
        signal
      );
      signal.throwIfAborted();
      if (!response.ok) {
        const error = isRecord(data) && typeof data.error === "string" ? data.error : "Failed to sync queued changes.";
        // Client errors require discard; network errors, deadlines and server errors retry quietly.
        if (response.status >= 400 && response.status < 500) return { count, failed: { id: mutation.id, error } };
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
    accepted.delete(mutation.id);
    count += 1;
  }
  signal.throwIfAborted();
  return { count };
}

function replaceTemporaryIds<T>(value: T, ids: Record<string, string>): T {
  if (typeof value === "string") {
    let result: string = value;
    for (const [temporary, real] of Object.entries(ids)) result = result.replaceAll(temporary, real);
    return result as T;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceTemporaryIds(entry, ids)) as T;
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceTemporaryIds(entry, ids)])) as T;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}
