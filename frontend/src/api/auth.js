async function sendAuthRequest(path, payload) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? "Authentication request failed.");
  }

  return data;
}

export function registerUser(payload) {
  return sendAuthRequest("register", payload);
}

export function loginUser(payload) {
  return sendAuthRequest("login", payload);
}
