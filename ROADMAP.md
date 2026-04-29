# ROADMAP

Goal: Fix push notification subscription so "Enable notifications" reliably registers the browser
and toggles the button state, on both desktop and mobile.

## Priority 1

Objective: Eliminate the race condition and stale-closure bug in `usePushNotifications` that causes
"Registration failed – push service error" on desktop and a silent no-op on mobile.

Root causes identified:
1. **Race condition / stale closure** — `subscribe()` captures `publicKey` at render time. The
   VAPID key is fetched asynchronously in a `useEffect` that only starts when `isSupported` becomes
   true (i.e. after list + members have loaded). The "Enable notifications" button is visible as
   soon as `isSupported` is true, so the user can click it before `publicKey` is populated.
   `decodeBase64Url("")` produces an empty `Uint8Array`; the browser push service rejects it with
   "Registration failed – push service error".
2. **No guard in `subscribe()`** — the function only checks `!isSupported`, not whether
   `publicKey` is actually available.
3. **Button active while hook not ready** — `isPushSupported` (= `isSupported`) becomes true
   before the VAPID key and existing-subscription queries complete, so the button is clickable
   during the initialization window.

Planned outcomes:
- Clicking "Enable notifications" after the permission dialog always succeeds when VAPID keys are
  configured correctly.
- Clicking before the hook has finished loading is a no-op (button is disabled).
- The button text switches to "Disable notifications" immediately after a successful subscription.
- Errors from the push service are surfaced in the existing error banner.
