import { useEffect, useRef, useState } from "react";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/push";

interface PushNotificationsOptions {
  enabled?: boolean;
  token?: string;
}

interface PushNotificationsResult {
  isReady: boolean;
  isSubscribed: boolean;
  isSupported: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
}

export function usePushNotifications({
  enabled = false,
  token = ""
}: PushNotificationsOptions): PushNotificationsResult {
  // `null` means the initial VAPID-key fetch has not completed yet.
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<PushSubscription | null>(null);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  const isSupported = Boolean(
    enabled &&
      token &&
      "Notification" in window &&
      "serviceWorker" in navigator
  );
  const isSubscribed = Boolean(currentSubscription);

  useEffect(() => {
    if (!isSupported || publicKey !== null) {
      return;
    }

    let cancelled = false;

    async function loadPushState(): Promise<void> {
      const keyResult = await fetchVapidPublicKey();

      if (cancelled) {
        return;
      }

      setPublicKey(keyResult.publicKey ?? "");
      const registration = await navigator.serviceWorker.ready;

      if (cancelled) {
        return;
      }

      registrationRef.current = registration;
      setCurrentSubscription(await registration.pushManager.getSubscription());
    }

    void loadPushState().catch((error) => {
      console.error("Failed to initialize push notifications.", error);
    });

    return () => {
      cancelled = true;
    };
  }, [isSupported, publicKey]);

  async function subscribe(): Promise<boolean> {
    if (!isSupported) {
      return false;
    }

    if (!publicKey) {
      return false;
    }

    const permission = await window.Notification.requestPermission();

    if (permission !== "granted") {
      return false;
    }

    const registration =
      registrationRef.current ??
      (await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) => {
          window.setTimeout(
            () => reject(new Error("Service worker is not available. Try refreshing the page.")),
            8000
          );
        })
      ]));
    registrationRef.current = registration;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey)
    });
    const serializedSubscription = subscription.toJSON();

    await subscribePush(token, serializedSubscription);
    setCurrentSubscription(subscription);
    return true;
  }

  async function unsubscribe(): Promise<boolean> {
    if (!currentSubscription) {
      return false;
    }

    const endpoint = currentSubscription.endpoint;

    await currentSubscription.unsubscribe();
    await unsubscribePush(token, endpoint);
    setCurrentSubscription(null);
    return true;
  }

  return {
    isReady: Boolean(publicKey),
    isSubscribed,
    isSupported,
    subscribe,
    unsubscribe
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
