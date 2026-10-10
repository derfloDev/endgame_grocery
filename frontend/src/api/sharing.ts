import { createCacheKey, sendJsonRequest } from "./client";
import type { Member, MutationResult } from "../types";

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

/** The invitation a successful share request created. */
export type ShareInviteResponse = MutationResult<{ invite: { invited_email?: string } }>;

type EmptyMutationResponse = MutationResult<Record<string, never>> | null;

/** Cache key of the members of one list; the only place that spells it out. */
export function createMembersCacheKey(listId: string): string {
  return createCacheKey("members", listId);
}

function sendSharingRequest<T>(
  listId: string,
  token: string,
  path = "",
  options: SharingRequestOptions = {}
): Promise<T> {
  const method = options.method ?? "GET";

  return sendJsonRequest<T>(`/api/lists/${listId}/members${path}`, {
    method,
    token,
    payload: options.payload,
    cacheKey: method === "GET" ? createMembersCacheKey(listId) : "",
    offlineFallbackMessage: "Offline sharing data is unavailable.",
    queueable: method !== "GET"
  });
}

export function fetchListMembers(listId: string, token: string): Promise<MembersResponse> {
  return sendSharingRequest<MembersResponse>(listId, token);
}

export function shareListWithMember(listId: string, token: string, payload: SharePayload): Promise<ShareInviteResponse> {
  return sendSharingRequest<ShareInviteResponse>(listId, token, "", {
    method: "POST",
    payload
  });
}

/** Revoking and leaving answer `204 No Content` (`null`) or are queued while offline. */
export function revokeListMember(listId: string, memberId: string, token: string): Promise<EmptyMutationResponse> {
  return sendSharingRequest<EmptyMutationResponse>(listId, token, `/${memberId}`, {
    method: "DELETE"
  });
}

export function leaveList(listId: string, token: string): Promise<EmptyMutationResponse> {
  return sendJsonRequest<EmptyMutationResponse>(`/api/lists/${listId}/leave`, {
    method: "DELETE",
    token,
    queueable: true
  });
}

export function acceptInvite(token: string, authToken: string): Promise<InviteAcceptResponse> {
  return sendJsonRequest<InviteAcceptResponse>(`/api/invites/${encodeURIComponent(token)}`, {
    method: "GET",
    token: authToken
  });
}
