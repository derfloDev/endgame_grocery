import { createCacheKey, sendJsonRequest } from "./client";
import type { Entry, QueueMeta } from "../types";

interface EntryRequestOptions {
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

interface EntryMutationResponse {
  entry: Entry;
  queued?: boolean;
}

function createEntriesCacheKey(listId: string): string {
  return createCacheKey("entries", listId);
}

function sendEntryRequest(
  listId: string,
  token: string,
  path = "",
  options: EntryRequestOptions = {}
): Promise<unknown> {
  const method = options.method ?? "GET";

  return sendJsonRequest(`/api/lists/${listId}/entries${path}`, {
    method,
    token,
    payload: options.payload,
    cacheKey: method === "GET" ? createEntriesCacheKey(listId) : "",
    offlineFallbackMessage: "Offline entry data is unavailable.",
    queueable: method !== "GET",
    queueMeta: options.queueMeta ?? null
  });
}

export function fetchEntries(listId: string, token: string): Promise<EntriesResponse> {
  return sendEntryRequest(listId, token) as Promise<EntriesResponse>;
}

export function createEntry(
  listId: string,
  token: string,
  { text, icon, details }: EntryPayload,
  options: CreateEntryOptions = {}
): Promise<EntryMutationResponse> {
  return sendEntryRequest(listId, token, "", {
    method: "POST",
    payload: { text, icon, details },
    queueMeta: {
      resourceType: "entry",
      tempId: options.tempId ?? ""
    }
  }) as Promise<EntryMutationResponse>;
}

export function updateEntry(
  listId: string,
  entryId: string,
  token: string,
  payload: Partial<EntryPayload> & { status?: Entry["status"] }
): Promise<EntryMutationResponse> {
  return sendEntryRequest(listId, token, `/${entryId}`, {
    method: "PATCH",
    payload
  }) as Promise<EntryMutationResponse>;
}
