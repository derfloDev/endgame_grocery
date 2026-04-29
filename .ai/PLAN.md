# Plan

Status: **ready_for_implement**

Goal: Fix the two remaining causes of push notifications not working in Vite dev mode.

## Background

T-001 fixed the production race condition (committed).
T-002 decoupled the VAPID-key fetch, added `isReady`, and enabled `devOptions` (committed).

After T-002, `isReady` becomes `true` (button enabled), but clicking "Enable notifications"
still hangs. Two root causes remain.

## Root Causes (T-003)

### Root Cause 1 — SW activation failure in dev mode

`service-worker.js` calls `precacheAndRoute(self.__WB_MANIFEST)` unconditionally.
In production, `vite-plugin-pwa` replaces `self.__WB_MANIFEST` at build time.
In dev mode (injectManifest strategy), this replacement may not happen, causing the SW
to throw `ReferenceError: __WB_MANIFEST is not defined` during installation and
never reach the "activated" state. `navigator.serviceWorker.ready` then never resolves,
blocking both `loadPushState()` (after the VAPID key is set) and `subscribe()`.

### Root Cause 2 — `subscribe()` re-awaits `serviceWorker.ready` independently

```js
// loadPushState() — already resolved the registration once
const registration = await navigator.serviceWorker.ready;
registrationRef.current = registration;   // ← not yet done; this ref doesn't exist

// subscribe() — re-awaits independently
const registration = await navigator.serviceWorker.ready;  // hangs again
```

`subscribe()` has no access to the registration obtained in `loadPushState()`.
If Root Cause 1 is fixed (SW activates), the second wait would eventually resolve,
but it adds unnecessary latency. If SW is unavailable for any reason, `subscribe()`
hangs indefinitely with no user feedback.

## Acceptance Criteria

- [ ] SW activates in Vite dev mode; browser DevTools → Application → Service Workers
      shows status "activated and running" after page load on localhost.
- [ ] Clicking "Enable notifications" on localhost shows the browser permission dialog.
- [ ] After granting permission, the subscription is saved and the button switches to
      "Disable notifications".
- [ ] "Disable notifications" removes the subscription.
- [ ] If the SW is unavailable (no registration at all), `subscribe()` rejects with a
      human-readable error within 8 seconds instead of hanging.
- [ ] `npm run lint`, `npm run build`, `npm test` all pass.

## Implementation Phases

### Phase 1 — Fix `service-worker.js`

Guard `precacheAndRoute` so the SW can activate even when `__WB_MANIFEST` is not injected:

```js
// Before (crashes in dev if __WB_MANIFEST not injected):
precacheAndRoute(self.__WB_MANIFEST);

// After:
precacheAndRoute(typeof self.__WB_MANIFEST !== "undefined" ? self.__WB_MANIFEST : []);
```

This is safe in production — the build always injects `self.__WB_MANIFEST`, so the
`typeof` guard evaluates to the injected array. In dev mode it falls back to `[]`
(no precaching), which is correct.

### Phase 2 — Cache SW registration in `usePushNotifications.js`

Add a `registrationRef` to share the SW registration obtained in `loadPushState()`
with `subscribe()` and `unsubscribe()`.

**Add `useRef` import:**
```js
import { useEffect, useRef, useState } from "react";
```

**Add ref inside the hook:**
```js
const registrationRef = useRef(null);
```

**Store registration when obtained in `loadPushState()`:**
```js
const registration = await navigator.serviceWorker.ready;
if (cancelled) return;
registrationRef.current = registration;
setCurrentSubscription(await registration.pushManager.getSubscription());
```

**Use cached registration in `subscribe()` with timeout fallback:**

Replace the existing line:
```js
const registration = await navigator.serviceWorker.ready;
```

With:
```js
const registration =
  registrationRef.current ??
  (await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Service worker is not available. Try refreshing the page.")),
        8000
      )
    )
  ]));
```

Behaviour:
- **Normal path (SW active):** `registrationRef.current` is already set by `loadPushState()`;
  `subscribe()` proceeds immediately without any additional wait.
- **Race path (SW activates after subscribe() called):** falls back to
  `navigator.serviceWorker.ready`, which now resolves because Root Cause 1 is fixed.
- **SW completely unavailable:** rejects after 8 s with a clear, user-visible error.

### Phase 3 — Update Tests

**`usePushNotifications.test.js`**

1. **Update existing setup** — add `registrationRef`-compatible mock: the existing mock
   already resolves `serviceWorker.ready` immediately, so tests continue to pass without
   changes to existing test logic.

2. **New test: "subscribe() succeeds immediately using the cached SW registration"**
   - Let `loadPushState()` complete (existing SW mock resolves ready).
   - Spy on `navigator.serviceWorker.ready` to confirm it is not awaited a second time
     during `subscribe()`.
   - Assert subscription succeeds and `isSubscribed` becomes `true`.

3. **New test: "subscribe() rejects with a timeout error when no SW is available"**
   - Stub `navigator.serviceWorker.ready` with a never-resolving promise AND
     set `registrationRef.current` to null (simulate: VAPID key loaded but SW never activated).
   - Use fake timers to advance 8 s.
   - Assert `subscribe()` rejects with the timeout message.
   - Assert `subscribePush` was NOT called.

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/sw/service-worker.js` | Phase 1 — guard `__WB_MANIFEST` |
| `frontend/src/hooks/usePushNotifications.js` | Phase 2 — `registrationRef`, timeout fallback |
| `frontend/src/hooks/usePushNotifications.test.js` | Phase 3 — two new tests |

## Validation

```
npm run lint
npm run build
npm test
```
