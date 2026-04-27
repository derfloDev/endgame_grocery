import { createCacheKey, sendJsonRequest } from "./client";

export function fetchSuggestions(listId, token, query) {
  return sendJsonRequest(`/api/lists/${listId}/suggestions?q=${encodeURIComponent(query)}`, {
    method: "GET",
    token,
    cacheKey: createCacheKey("suggestions", listId),
    offlineFallbackMessage: "Offline suggestions unavailable."
  });
}
