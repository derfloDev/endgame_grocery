import { enqueueOfflineMutation, readCachedResource, writeCachedResource } from "./offlineStore";
import type { QueueMeta } from "../types";
import { isNetworkError, requestJson } from "./request";
import { REQUEST_TIMEOUT_MS } from "./connectionTimings";

export const OFFLINE_SYNC_COMPLETE_EVENT = "endgame_grocery.offline_sync_complete";

export interface CachedReadOptions<T> {
  onCachedValue?: (value: T) => void;
}

interface SendJsonRequestOptions<T> extends CachedReadOptions<T> {
  token?: string;
  method?: string;
  payload?: unknown;
  headers?: HeadersInit;
  cacheKey?: string;
  offlineFallbackMessage?: string;
  queueable?: boolean;
  queueMeta?: QueueMeta | null;
  timeoutMs?: number;
}

interface ErrorResponse {
  error?: string;
}

export class AuthExpiredError extends Error {
  constructor(message = "session:expired") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

export function createCacheKey(resource: string, suffix = ""): string {
  return suffix ? `${resource}:${suffix}` : resource;
}

export function createTemporaryId(resource: string): string {
  return `temp-${resource}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function sendJsonRequest<T = unknown>(
  url: string,
  {
    token = "",
    method = "GET",
    payload,
    headers = {},
    cacheKey = "",
    onCachedValue,
    offlineFallbackMessage = "Offline data is unavailable.",
    queueable = false,
    queueMeta = null,
    timeoutMs = REQUEST_TIMEOUT_MS
  }: SendJsonRequestOptions<T> = {}
): Promise<unknown> {
  let networkSettled = false;
  if (method === "GET" && cacheKey && onCachedValue) {
    // Read alongside the network, never delaying it. Once the response settles (including
    // access errors), a late cache read must not restore stale data, even during persistence.
    void readCachedResource(cacheKey).then((cachedValue) => {
      if (!networkSettled && cachedValue != null) onCachedValue(cachedValue as T);
    }).catch(() => {
      // An unavailable cache must not prevent an online read from succeeding.
    });
  }

  try {
    const { response, data } = await requestJson<ErrorResponse>(url, {
      method,
      headers: {
        ...(payload ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      ...(payload ? { body: JSON.stringify(payload) } : {})
    }, timeoutMs);
    networkSettled = true;

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      if (response.status === 401 && token) {
        window.dispatchEvent(new Event("auth:expired"));
        throw new AuthExpiredError();
      }

      throw new Error(data.error ?? "Request failed.");
    }

    if (method === "GET" && cacheKey) {
      await writeCachedResource(cacheKey, data);
    }

    return data;
  } catch (error) {
    networkSettled = true;
    if (method === "GET" && cacheKey && isNetworkError(error)) {
      const cachedValue = await readCachedResource(cacheKey);

      if (cachedValue) {
        return {
          ...(cachedValue as Record<string, unknown>),
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
