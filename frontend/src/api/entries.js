import { createCacheKey, sendJsonRequest } from "./client";

function createEntriesCacheKey(listId) {
  return createCacheKey("entries", listId);
}

function sendEntryRequest(listId, token, path = "", options = {}) {
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

export function fetchEntries(listId, token) {
  return sendEntryRequest(listId, token);
}

export function createEntry(listId, token, { text, icon }, options = {}) {
  return sendEntryRequest(listId, token, "", {
    method: "POST",
    payload: { text, icon },
    queueMeta: {
      resourceType: "entry",
      tempId: options.tempId ?? ""
    }
  });
}

export function updateEntry(listId, entryId, token, payload) {
  return sendEntryRequest(listId, token, `/${entryId}`, {
    method: "PATCH",
    payload
  });
}

export function deleteEntry(listId, entryId, token) {
  return sendEntryRequest(listId, token, `/${entryId}`, {
    method: "DELETE"
  });
}
