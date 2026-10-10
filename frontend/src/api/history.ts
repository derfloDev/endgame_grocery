import { sendJsonRequest } from "./client";
import type { Suggestion } from "../types";

interface HistoryResponse {
  history: Suggestion[];
  offline?: boolean;
}

export function fetchRecentlyUsed(listId: string, token: string): Promise<HistoryResponse> {
  return sendJsonRequest<HistoryResponse>(`/api/lists/${listId}/history`, {
    token
  });
}

export function deleteFromHistory(listId: string, text: string, token: string): Promise<unknown> {
  return sendJsonRequest(`/api/lists/${listId}/history`, {
    method: "DELETE",
    token,
    payload: { text }
  });
}
