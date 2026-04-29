import { useEffect, useState } from "react";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/push";

export function usePushNotifications({ enabled = false, token = "" }) {
  // `null` means the initial VAPID-key fetch has not completed yet.
  const [publicKey, setPublicKey] = useState(null);
  const [currentSubscription, setCurrentSubscription] = useState(null);

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

    async function loadPushState() {
      const keyResult = await fetchVapidPublicKey();

      if (cancelled) {
        return;
      }

      setPublicKey(keyResult.publicKey ?? "");
      const registration = await navigator.serviceWorker.ready;

      if (cancelled) {
        return;
      }

      setCurrentSubscription(await registration.pushManager.getSubscription());
    }

    void loadPushState().catch((error) => {
      console.error("Failed to initialize push notifications.", error);
    });

    return () => {
      cancelled = true;
    };
  }, [isSupported, publicKey]);

  async function subscribe() {
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

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeBase64Url(publicKey)
    });
    const serializedSubscription = subscription.toJSON();

    await subscribePush(token, serializedSubscription);
    setCurrentSubscription(subscription);
    return true;
  }

  async function unsubscribe() {
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

function decodeBase64Url(value) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalizedValue.length % 4 || 4)) % 4);
  const decoded = atob(`${normalizedValue}${padding}`);

  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
