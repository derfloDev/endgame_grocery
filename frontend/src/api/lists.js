async function sendListRequest(path, token, options = {}) {
  const response = await fetch(`/api/lists${path}`, {
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
    throw new Error(data.error ?? "List request failed.");
  }

  return data;
}

export function fetchLists(token) {
  return sendListRequest("", token);
}

export function createList(token, payload) {
  return sendListRequest("", token, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function renameList(token, listId, payload) {
  return sendListRequest(`/${listId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteList(token, listId) {
  return sendListRequest(`/${listId}`, token, {
    method: "DELETE"
  });
}
