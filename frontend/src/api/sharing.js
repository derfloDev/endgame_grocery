import { createCacheKey, sendJsonRequest } from "./client";

function createMembersCacheKey(listId) {
  return createCacheKey("members", listId);
}

function sendSharingRequest(listId, token, path = "", options = {}) {
  const method = options.method ?? "GET";

  return sendJsonRequest(`/api/lists/${listId}/members${path}`, {
    method,
    token,
    payload: options.payload,
    cacheKey: method === "GET" ? createMembersCacheKey(listId) : "",
    offlineFallbackMessage: "Offline sharing data is unavailable.",
    queueable: method !== "GET"
  });
}

export function fetchListMembers(listId, token) {
  return sendSharingRequest(listId, token);
}

export function shareListWithMember(listId, token, payload) {
  return sendSharingRequest(listId, token, "", {
    method: "POST",
    payload
  });
}

export function revokeListMember(listId, memberId, token) {
  return sendSharingRequest(listId, token, `/${memberId}`, {
    method: "DELETE"
  });
}

export function acceptInvite(token, authToken) {
  return sendJsonRequest(`/api/invites/${encodeURIComponent(token)}`, {
    method: "GET",
    token: authToken
  });
}
