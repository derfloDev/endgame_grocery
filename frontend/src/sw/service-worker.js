import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

self.skipWaiting();
clientsClaim();
const precacheManifest = self.__WB_MANIFEST;

precacheAndRoute(precacheManifest || []);

self.addEventListener("push", (event) => {
  if (import.meta.env.DEV) {
    console.log("Push event received", { hasData: Boolean(event.data) });
  }

  const payload = event.data?.json?.() ?? {
    title: "Endgame Grocery",
    body: "A shared list has new activity.",
    listId: ""
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: {
        listId: payload.listId ?? ""
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const listPath = event.notification.data?.listId
    ? `/lists/${event.notification.data.listId}`
    : "/";
  const targetUrl = new URL(listPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});
