async function sendEntryRequest(listId, token, path = "", options = {}) {
  const response = await fetch(`/api/lists/${listId}/entries${path}`, {
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
    throw new Error(data.error ?? "Entry request failed.");
  }

  return data;
}

export function fetchEntries(listId, token) {
  return sendEntryRequest(listId, token);
}

export function createEntry(listId, token, payload) {
  return sendEntryRequest(listId, token, "", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateEntry(listId, entryId, token, payload) {
  return sendEntryRequest(listId, token, `/${entryId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteEntry(listId, entryId, token) {
  return sendEntryRequest(listId, token, `/${entryId}`, {
    method: "DELETE"
  });
}
