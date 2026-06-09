import { createCacheKey, sendJsonRequest } from "./client";
import type { Member } from "../types";

interface SharingRequestOptions {
  method?: string;
  payload?: unknown;
}

interface MembersResponse {
  members: Member[];
  offline?: boolean;
}

interface SharePayload {
  email: string;
}

interface InviteAcceptResponse {
  listId: string;
}

function createMembersCacheKey(listId: string): string {
  return createCacheKey("members", listId);
}

function sendSharingRequest(
  listId: string,
  token: string,
  path = "",
  options: SharingRequestOptions = {}
): Promise<unknown> {
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

export function fetchListMembers(listId: string, token: string): Promise<MembersResponse> {
  return sendSharingRequest(listId, token) as Promise<MembersResponse>;
}

export function shareListWithMember(listId: string, token: string, payload: SharePayload): Promise<unknown> {
  return sendSharingRequest(listId, token, "", {
    method: "POST",
    payload
  });
}

export function revokeListMember(listId: string, memberId: string, token: string): Promise<unknown> {
  return sendSharingRequest(listId, token, `/${memberId}`, {
    method: "DELETE"
  });
}

export function leaveList(listId: string, token: string): Promise<unknown> {
  return sendJsonRequest(`/api/lists/${listId}/leave`, {
    method: "DELETE",
    token,
    queueable: true
  });
}

export function acceptInvite(token: string, authToken: string): Promise<InviteAcceptResponse> {
  return sendJsonRequest(`/api/invites/${encodeURIComponent(token)}`, {
    method: "GET",
    token: authToken
  }) as Promise<InviteAcceptResponse>;
}
