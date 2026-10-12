import { useEffect, useRef, useState } from "react";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/push";
import { ensureServiceWorker } from "../sw/register";

interface PushNotificationsOptions { enabled?: boolean; token?: string; }
export type PushFailure = "unsupported" | "configuration" | "permissionDenied" | "workerRegistration" | "workerInstallation" | "workerTimeout" | "subscription";
interface PushNotificationsResult {
  isReady: boolean;
  isSubscribed: boolean;
  isSupported: boolean;
  isPending: boolean;
  error: PushFailure | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}
function failureCode(error: unknown): PushFailure {
  const message = error instanceof Error ? error.message : "";
  return ["workerRegistration", "workerInstallation", "workerTimeout"].includes(message)
    ? message as PushFailure : "subscription";
}

export function usePushNotifications({ enabled = false, token = "" }: PushNotificationsOptions): PushNotificationsResult {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);
  const [error, setError] = useState<PushFailure | null>(null);
  const [isPending, setIsPending] = useState(false);
  const pendingRef = useRef(false);
  const attemptVersion = useRef(0);
  const session = useRef<AbortController | null>(null);
  const isSupported = Boolean(enabled && token && typeof window.Notification !== "undefined" &&
    "serviceWorker" in navigator && typeof window.PushManager !== "undefined");

  useEffect(() => {
    const controller = new AbortController();
    session.current = controller;
    pendingRef.current = false;
    const backgroundVersion = ++attemptVersion.current;
    setIsPending(false);
    setPublicKey(null);
    setCurrentSubscription(null);
    setError(null);
    if (isSupported) {
      // Key loading and subscription restoration share one session, independent of key
      // state updates. StrictMode cleanup and token changes invalidate stale results.
      void (async () => {
        let key: string;
        try { key = (await fetchVapidPublicKey()).publicKey ?? ""; }
        catch { if (!controller.signal.aborted) { setPublicKey(""); setError("configuration"); } return; }
        if (controller.signal.aborted) return;
        setPublicKey(key);
        if (!key) { setError("configuration"); return; }
        try {
          const registration = await ensureServiceWorker(controller.signal);
          const subscription = await registration.pushManager.getSubscription();
          if (!controller.signal.aborted && attemptVersion.current === backgroundVersion) setCurrentSubscription(subscription);
        } catch (cause) {
          if (!controller.signal.aborted && attemptVersion.current === backgroundVersion) setError(failureCode(cause));
        }
      })();
    }
    return () => controller.abort();
  }, [isSupported, token]);

  async function runAttempt(unsubscribing: boolean): Promise<boolean> {
    if (pendingRef.current || publicKey === null) return false;
    if (!isSupported) { setError("unsupported"); return false; }
    const controller = session.current!;
    pendingRef.current = true;
    attemptVersion.current += 1;
    setIsPending(true);
    setError(null);
    try {
      if (unsubscribing) {
        if (!currentSubscription) return false;
        await currentSubscription.unsubscribe();
        await unsubscribePush(token, currentSubscription.endpoint);
        if (controller.signal.aborted) return false;
        setCurrentSubscription(null);
      } else {
        // Request permission synchronously from the click, before configuration or worker
        // recovery awaits. Background initialization never prompts; denial never re-prompts.
        const permission = Notification.permission === "default"
          ? await Notification.requestPermission() : Notification.permission;
        if (controller.signal.aborted) return false;
        if (permission !== "granted") { setError("permissionDenied"); return false; }
        let key = publicKey;
        if (!key) {
          try { key = (await fetchVapidPublicKey()).publicKey ?? ""; }
          catch { if (!controller.signal.aborted) setError("configuration"); return false; }
          if (controller.signal.aborted) return false;
          setPublicKey(key);
          if (!key) { setError("configuration"); return false; }
        }
        const registration = await ensureServiceWorker(controller.signal);
        const existing = await registration.pushManager.getSubscription();
        if (controller.signal.aborted) return false;
        const subscription = existing ?? await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: decodeBase64Url(key)
        });
        if (controller.signal.aborted) return false;
        await subscribePush(token, subscription.toJSON());
        if (controller.signal.aborted) return false;
        setCurrentSubscription(subscription);
        setError(null);
      }
      return true;
    } catch (cause) {
      if (!controller.signal.aborted) setError(failureCode(cause));
      return false;
    } finally {
      if (!controller.signal.aborted) { pendingRef.current = false; setIsPending(false); }
    }
  }
  return {
    // Ready means configuration loading has settled and the user can attempt/retry.
    // It is intentionally separate from worker activation and pending subscription work.
    isReady: isSupported && publicKey !== null,
    isSubscribed: Boolean(currentSubscription), isSupported, isPending, error,
    subscribe: () => runAttempt(false), unsubscribe: () => runAttempt(true)
  };
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalizedValue.length % 4 || 4)) % 4);
  const decoded = atob(`${normalizedValue}${padding}`);
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length));

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes.buffer;
}
