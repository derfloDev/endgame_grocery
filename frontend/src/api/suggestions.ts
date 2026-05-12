import { createCacheKey, sendJsonRequest } from "./client";
import type { Suggestion } from "../types";

interface SuggestionsResponse {
  suggestions: Suggestion[];
  offline?: boolean;
}

export function fetchSuggestions(listId: string, token: string, query: string): Promise<SuggestionsResponse> {
  return sendJsonRequest(`/api/lists/${listId}/suggestions?q=${encodeURIComponent(query)}`, {
    method: "GET",
    token,
    cacheKey: createCacheKey("suggestions", listId),
    offlineFallbackMessage: "Offline suggestions unavailable."
  }) as Promise<SuggestionsResponse>;
}
