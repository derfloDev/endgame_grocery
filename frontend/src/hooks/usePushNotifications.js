import { useEffect, useState } from "react";
import { fetchVapidPublicKey, subscribePush, unsubscribePush } from "../api/push";

export function usePushNotifications({ enabled = false, token = "" }) {
  const [publicKey, setPublicKey] = useState("");
  const [currentSubscription, setCurrentSubscription] = useState(null);

  const isSupported = Boolean(
    enabled &&
      token &&
      "Notification" in window &&
      "serviceWorker" in navigator
  );
  const isSubscribed = Boolean(currentSubscription);

  useEffect(() => {
    if (!isSupported || publicKey) {
      return;
    }

    let cancelled = false;

    async function loadPushState() {
      const [keyResult, registration] = await Promise.all([
        fetchVapidPublicKey(),
        navigator.serviceWorker.ready
      ]);

      if (cancelled) {
        return;
      }

      setPublicKey(keyResult.publicKey ?? "");
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
