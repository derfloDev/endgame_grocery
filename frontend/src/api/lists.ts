import { AuthExpiredError, createCacheKey, sendJsonRequest } from "./client";
import { ApiError } from "./errors";
import { readCachedResource } from "./offlineStore";
import type { CachedReadOptions } from "./client";
import type { List, QueueMeta } from "../types";

const LISTS_CACHE_KEY = createCacheKey("lists");

/** Cache key of the metadata of one list (name, owner, ...). */
export function createListCacheKey(listId: string): string {
  return createCacheKey("list", listId);
}

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

interface ListResponse {
  list: List;
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

/**
 * Loads the metadata of a single list. Cached under `list:<id>`, so the detail page can show the
 * title from the cache while the request is still in flight or the device is offline.
 */
export async function fetchList(
  token: string,
  listId: string,
  options: CachedReadOptions<ListResponse> = {}
): Promise<ListResponse> {
  try {
    return (await sendJsonRequest(`/api/lists/${listId}`, {
      token,
      cacheKey: createListCacheKey(listId),
      onCachedValue: options.onCachedValue,
      offlineFallbackMessage: "Offline list data is unavailable."
    })) as ListResponse;
  } catch (error) {
    // Offline and never opened before: the overview cache still knows the list's title and owner.
    // Server answers (403/404) must stay visible, so only non-HTTP failures fall back.
    if (!(error instanceof ApiError) && !(error instanceof AuthExpiredError)) {
      const cachedLists = (await readCachedResource(LISTS_CACHE_KEY).catch(() => null)) as ListsResponse | null;
      const cachedList = cachedLists?.lists?.find((candidate) => candidate.id === listId);

      if (cachedList) {
        return { list: cachedList, offline: true };
      }
    }

    throw error;
  }
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
