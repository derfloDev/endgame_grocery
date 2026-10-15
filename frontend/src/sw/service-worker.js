// Network-first navigations let normal reloads reach Access login / Cloudflare challenges.
// Navigation responses are never runtime-cached; only the precached shell is the fallback.
// __reconnect disables the three-second timeout for an explicit access recovery attempt.
import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { addRoute, createHandlerBoundToURL, precache } from "workbox-precaching";
import { createNavigationHandler } from "./navigationHandler.js";

self.skipWaiting();
clientsClaim();
const precacheManifest = self.__WB_MANIFEST;

precache(precacheManifest || []);
registerRoute(new NavigationRoute(createNavigationHandler({
  // Development may not precache index.html. Defer lookup to fallback so registration
  // still works; a missing development shell can fail the request rather than evaluation.
  fallback: (options) => createHandlerBoundToURL("/index.html")(options)
})));
// Register after navigations so '/' cannot match the precache directoryIndex first.
addRoute();

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
