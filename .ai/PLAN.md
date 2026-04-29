# Plan

Status: **ready_for_implement**

Goal: Fix the push-notification subscription race condition so "Enable notifications" works
reliably on desktop and mobile.

## Scope

Bugfix confined to the frontend push-notification hook and its consumer.
No backend changes are required.

## Root Causes (confirmed by code inspection)

| # | Location | Problem |
|---|----------|---------|
| 1 | `usePushNotifications.js` — `subscribe()` | Stale closure: captures `publicKey = ""` at render time before the async VAPID-key fetch completes. `decodeBase64Url("")` → empty `Uint8Array` → browser throws "Registration failed – push service error". |
| 2 | `usePushNotifications.js` — `subscribe()` | No guard against missing `publicKey`; only `!isSupported` is checked. |
| 3 | `usePushNotifications.js` — `useEffect` | Initial state `""` cannot distinguish "not yet fetched" from "fetched but empty". If the server returns an empty key (VAPID not configured) the condition `!publicKey` stays truthy and the effect attempts a re-fetch on every relevant render. |
| 4 | `ListDetailPage.jsx` — push toggle button | `isPushSupported` becomes true as soon as the list and members load; the button is clickable before the hook finishes its async init (VAPID key + existing subscription query). |

## Acceptance Criteria

- [ ] Clicking "Enable notifications" before the VAPID key is loaded is a no-op (button disabled).
- [ ] After permission is granted and the browser subscription succeeds, the button changes to
      "Disable notifications" immediately.
- [ ] On desktop (Chrome/Brave/Firefox): full subscribe/unsubscribe cycle works with two
      users sharing a list.
- [ ] On mobile: same cycle works; no silent failure after the system permission dialog.
- [ ] `npm run lint`, `npm run build`, and `npm test` pass.

## Implementation Phases

### Phase 1 — Fix `usePushNotifications.js`

**Step 1.1 — Change `publicKey` initial state from `""` to `null`**

`null` means "not yet fetched"; `""` means "fetched but server returned no key";
a non-empty string means "ready to use".

```js
const [publicKey, setPublicKey] = useState(null);
```

**Step 1.2 — Fix the `useEffect` guard**

Change from:
```js
if (!isSupported || publicKey) {
```
to:
```js
if (!isSupported || publicKey !== null) {
```

This ensures the fetch runs exactly once when `isSupported` first becomes true,
regardless of whether the key is empty or non-empty.

**Step 1.3 — Guard `subscribe()` against missing `publicKey`**

Add as the second guard (before `requestPermission()`):
```js
if (!publicKey) {
  return false;
}
```

This prevents the empty-key path even if the user somehow clicks before initialization
and prevents showing the system permission dialog for a doomed subscription.

**Step 1.4 — Return `isReady` from the hook**

```js
const isReady = Boolean(publicKey);
// ...
return { isSubscribed, isSupported, isReady, subscribe, unsubscribe };
```

`isReady` lets the consumer disable the button while the key is loading.

### Phase 2 — Update `ListDetailPage.jsx`

**Step 2.1 — Consume `isReady`**

```js
const {
  isSubscribed,
  isSupported: isPushSupported,
  isReady: isPushReady,
  subscribe,
  unsubscribe
} = usePushNotifications({ enabled: shouldShowPushToggle, token });
```

**Step 2.2 — Disable the button while not ready**

```jsx
<button
  className="eg-btn-secondary"
  type="button"
  disabled={!isPushReady}
  onClick={() => void handlePushToggle()}
>
  {isSubscribed ? "Disable notifications" : "Enable notifications"}
</button>
```

### Phase 3 — Update Tests

**`usePushNotifications.test.js` — new / updated cases**

1. **Existing test** "loads the VAPID key only when enabled and subscribes the browser endpoint":
   — assert `isReady` is `true` after key is loaded (extend existing assertion).

2. **New test** "subscribe() returns false and does not call requestPermission when key is not yet loaded":
   — mock `fetchVapidPublicKey` with a never-resolving promise (or delay it);
   — click subscribe immediately;
   — assert `Notification.requestPermission` was NOT called;
   — assert `subscribePush` was NOT called.

3. **New test** "isReady is false while the VAPID key is loading and true once loaded":
   — use a deferred promise for `fetchVapidPublicKey`;
   — assert `isReady = false` initially;
   — resolve the deferred promise;
   — assert `isReady = true`.

## Files to Change

| File | Change |
|------|--------|
| `frontend/src/hooks/usePushNotifications.js` | Phases 1.1 – 1.4 |
| `frontend/src/hooks/usePushNotifications.test.js` | Phase 3 |
| `frontend/src/pages/ListDetailPage.jsx` | Phase 2 |

## Validation

```
npm run lint
npm run build
npm test
```
