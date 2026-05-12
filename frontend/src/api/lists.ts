import { createCacheKey, sendJsonRequest } from "./client";
import type { List, QueueMeta } from "../types";

const LISTS_CACHE_KEY = createCacheKey("lists");

interface ListRequestOptions {
  method?: string;
  payload?: unknown;
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
    offlineFallbackMessage: "Offline list data is unavailable.",
    queueable: method !== "GET",
    queueMeta: options.queueMeta ?? null
  });
}

export function fetchLists(token: string): Promise<ListsResponse> {
  return sendListRequest("", token) as Promise<ListsResponse>;
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
