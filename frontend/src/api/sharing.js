async function sendSharingRequest(listId, token, path = "", options = {}) {
  const response = await fetch(`/api/lists/${listId}/members${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Sharing request failed.");
  }

  return data;
}

export function fetchListMembers(listId, token) {
  return sendSharingRequest(listId, token);
}

export function shareListWithMember(listId, token, payload) {
  return sendSharingRequest(listId, token, "", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function revokeListMember(listId, memberId, token) {
  return sendSharingRequest(listId, token, `/${memberId}`, {
    method: "DELETE"
  });
}
