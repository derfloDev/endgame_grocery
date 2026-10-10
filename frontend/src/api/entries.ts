import { createCacheKey, sendJsonRequest } from "./client";
import type { CachedReadOptions } from "./client";
import type { Entry, MutationResult, QueueMeta } from "../types";

interface EntryRequestOptions<T> extends CachedReadOptions<T> {
  method?: string;
  payload?: unknown;
  queueMeta?: QueueMeta | null;
}

interface EntryPayload {
  text: string;
  icon?: string | null;
  details?: string;
}

interface CreateEntryOptions {
  tempId?: string;
}

interface EntriesResponse {
  entries: Entry[];
  offline?: boolean;
}

type EntryMutationResponse = MutationResult<{ entry: Entry }>;

function createEntriesCacheKey(listId: string): string {
  return createCacheKey("entries", listId);
}

function sendEntryRequest<T>(
  listId: string,
  token: string,
  path = "",
  options: EntryRequestOptions<T> = {}
): Promise<T> {
  const method = options.method ?? "GET";

  return sendJsonRequest<T>(`/api/lists/${listId}/entries${path}`, {
    method,
    token,
    payload: options.payload,
    cacheKey: method === "GET" ? createEntriesCacheKey(listId) : "",
    onCachedValue: options.onCachedValue,
    offlineFallbackMessage: "Offline entry data is unavailable.",
    queueable: method !== "GET",
    queueMeta: options.queueMeta ?? null
  });
}

export function fetchEntries(listId: string, token: string, options: CachedReadOptions<EntriesResponse> = {}): Promise<EntriesResponse> {
  return sendEntryRequest<EntriesResponse>(listId, token, "", options);
}

export function createEntry(
  listId: string,
  token: string,
  { text, icon, details }: EntryPayload,
  options: CreateEntryOptions = {}
): Promise<EntryMutationResponse> {
  return sendEntryRequest<EntryMutationResponse>(listId, token, "", {
    method: "POST",
    payload: { text, icon, details },
    queueMeta: {
      resourceType: "entry",
      tempId: options.tempId ?? ""
    }
  });
}

export function updateEntry(
  listId: string,
  entryId: string,
  token: string,
  payload: Partial<EntryPayload> & { status?: Entry["status"] }
): Promise<EntryMutationResponse> {
  return sendEntryRequest<EntryMutationResponse>(listId, token, `/${entryId}`, {
    method: "PATCH",
    payload
  });
}
