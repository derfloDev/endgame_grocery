# ROADMAP

Goal: Fix push notification subscription so "Enable notifications" reliably registers the browser
and toggles the button state — both in production (mobile/desktop) and in the local dev environment.

## Priority 1 — Production race condition (DONE — T-001)

Objective: Eliminate the stale-closure bug in `usePushNotifications` that caused
"Registration failed – push service error" on desktop and a silent no-op on mobile.

- Fixed: `publicKey` initial state changed from `""` to `null`.
- Fixed: `subscribe()` guards against empty/null `publicKey` before calling `requestPermission()`.
- Fixed: `isReady` flag exposed so the button is disabled until the VAPID key is loaded.
- Fixed: VAPID-key fetch decoupled from `serviceWorker.ready` so `isReady` becomes true
  as soon as the HTTP response returns.
- Fixed: `devOptions: { enabled: true, type: "module" }` added to VitePWA.

## Priority 2 — Dev-mode push testing (T-003)

Objective: Allow the full subscribe/unsubscribe cycle to complete on `localhost` with the
Vite dev server.

Two remaining root causes (confirmed after T-002 landed):

1. **`service-worker.js` crashes on activation in dev mode.**
   `precacheAndRoute(self.__WB_MANIFEST)` throws a `ReferenceError` when
   `vite-plugin-pwa` does not inject `__WB_MANIFEST` for the `injectManifest` strategy
   in dev mode. The SW fails to activate → `navigator.serviceWorker.ready` never resolves.

2. **`subscribe()` makes its own redundant `await navigator.serviceWorker.ready`.**
   Even when the registration was already obtained in `loadPushState()`, `subscribe()`
   re-awaits `serviceWorker.ready` independently, causing a hang if the cached result
   is not reused.

Planned outcomes:
- SW activates in dev mode; `navigator.serviceWorker.ready` resolves.
- `subscribe()` reuses the already-resolved registration from `loadPushState()`.
- If SW is somehow unavailable, `subscribe()` fails with a clear error after a timeout
  instead of hanging forever.
- `npm run lint`, `npm run build`, and `npm test` pass.
