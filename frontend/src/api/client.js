import { enqueueOfflineMutation, readCachedResource, writeCachedResource } from "./offlineStore";

export const OFFLINE_SYNC_COMPLETE_EVENT = "endgame_grocery.offline_sync_complete";

export function createCacheKey(resource, suffix = "") {
  return suffix ? `${resource}:${suffix}` : resource;
}

export function isNetworkError(error) {
  return error instanceof TypeError || error?.message === "Failed to fetch";
}

export function createTemporaryId(resource) {
  return `temp-${resource}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function sendJsonRequest(
  url,
  {
    token = "",
    method = "GET",
    payload,
    headers = {},
    cacheKey = "",
    offlineFallbackMessage = "Offline data is unavailable.",
    queueable = false,
    queueMeta = null
  } = {}
) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    });

    if (response.status === 204) {
      return null;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error ?? "Request failed.");
    }

    if (method === "GET" && cacheKey) {
      await writeCachedResource(cacheKey, data);
    }

    return data;
  } catch (error) {
    if (method === "GET" && cacheKey && isNetworkError(error)) {
      const cachedValue = await readCachedResource(cacheKey);

      if (cachedValue) {
        return {
          ...cachedValue,
          offline: true
        };
      }

      throw new Error(offlineFallbackMessage);
    }

    if (queueable && isNetworkError(error)) {
      await enqueueOfflineMutation({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        method,
        payload: payload ?? null,
        token,
        createdAt: new Date().toISOString(),
        queueMeta
      });

      return { queued: true };
    }

    throw error;
  }
}
