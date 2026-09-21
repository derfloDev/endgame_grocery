import { createCacheKey, sendJsonRequest } from "./client";
import type { CachedReadOptions } from "./client";
import type { List, QueueMeta } from "../types";

const LISTS_CACHE_KEY = createCacheKey("lists");

interface ListRequestOptions extends CachedReadOptions<ListsResponse> {
  method?: string;
  payload?: unknown;
  queueable?: boolean;
  queueMeta?: QueueMeta | null;
}

interface CreateListOptions {
  tempId?: string;
}

interface ListPayload {
  name: string;
}

interface ListsResponse {
  lists: List[];
  offline?: boolean;
}

interface ListMutationResponse {
  list: List;
  queued?: boolean;
}

function sendListRequest(path: string, token: string, options: ListRequestOptions = {}): Promise<unknown> {
  const method = options.method ?? "GET";

  return sendJsonRequest(`/api/lists${path}`, {
    method,
    token,
    payload: options.payload,
    cacheKey: method === "GET" ? LISTS_CACHE_KEY : "",
    onCachedValue: options.onCachedValue,
    offlineFallbackMessage: "Offline list data is unavailable.",
    queueable: options.queueable ?? method !== "GET",
    queueMeta: options.queueMeta ?? null
  });
}

export function fetchLists(token: string, options: CachedReadOptions<ListsResponse> = {}): Promise<ListsResponse> {
  return sendListRequest("", token, options) as Promise<ListsResponse>;
}

export function createList(
  token: string,
  payload: ListPayload,
  options: CreateListOptions = {}
): Promise<ListMutationResponse> {
  return sendListRequest("", token, {
    method: "POST",
    payload,
    queueMeta: {
      resourceType: "list",
      tempId: options.tempId ?? ""
    }
  }) as Promise<ListMutationResponse>;
}

export function renameList(token: string, listId: string, payload: ListPayload): Promise<ListMutationResponse> {
  return sendListRequest(`/${listId}`, token, {
    method: "PATCH",
    payload
  }) as Promise<ListMutationResponse>;
}

export function deleteList(token: string, listId: string): Promise<unknown> {
  return sendListRequest(`/${listId}`, token, {
    method: "DELETE"
  });
}

export function markListViewed(token: string, listId: string): Promise<void> {
  return sendListRequest(`/${listId}/mark-viewed`, token, {
    method: "POST",
    queueable: false
  }) as Promise<void>;
}
