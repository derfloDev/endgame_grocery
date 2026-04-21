import { createCacheKey, sendJsonRequest } from "./client";

const LISTS_CACHE_KEY = createCacheKey("lists");

function sendListRequest(path, token, options = {}) {
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

export function fetchLists(token) {
  return sendListRequest("", token);
}

export function createList(token, payload, options = {}) {
  return sendListRequest("", token, {
    method: "POST",
    payload,
    queueMeta: {
      resourceType: "list",
      tempId: options.tempId ?? ""
    }
  });
}

export function renameList(token, listId, payload) {
  return sendListRequest(`/${listId}`, token, {
    method: "PATCH",
    payload
  });
}

export function deleteList(token, listId) {
  return sendListRequest(`/${listId}`, token, {
    method: "DELETE"
  });
}
