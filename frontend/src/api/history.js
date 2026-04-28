import { sendJsonRequest } from "./client";

export function fetchRecentlyUsed(listId, token) {
  return sendJsonRequest(`/api/lists/${listId}/history`, {
    token
  });
}

export function deleteFromHistory(listId, text, token) {
  return sendJsonRequest(`/api/lists/${listId}/history`, {
    method: "DELETE",
    token,
    payload: { text }
  });
}
