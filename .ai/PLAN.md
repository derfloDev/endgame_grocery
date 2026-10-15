# Plan

Status: **ready_for_implement**

Goal: implement the scope defined in `ROADMAP.md` — the app must never stay stuck in "offline
mode" while the device is online because an edge component (Cloudflare Access session or a
Cloudflare challenge) intercepts `/api/*`, and recovery must never require a hard reload or
deleting site data (which destroys the IndexedDB offline queue).

Decisions (ROADMAP.md, 2026-10-15): D2 manual "Reconnect" button, no automatic redirect;
D3 network-first service-worker navigations with ~3 s timeout and precached shell fallback;
D4 preserving the queue is sufficient.

## Scope

Two tasks, in this order (T-002 relies on the service-worker behaviour from T-001):

- **T-001** — Service worker: network-first navigations with precached shell fallback, so a
  normal reload reaches the network (and therefore Access login / Cloudflare challenge) again;
  login/challenge/redirect responses are never stored as the shell; reserved `__reconnect` query
  parameter disables the navigation timeout.
- **T-002** — Edge-gate detection and recovery in the app: classify "gated" separately from
  "offline", never show offline mode for a gate, keep/queue writes, show a distinct banner with a
  "Reconnect" button that reloads through the network with `__reconnect`, strip the parameter on
  startup, log the classification reason.

Out of scope: Cloudflare account changes, any public Access exception for `/api/*`, queue
export/backup, extra warnings (D4), automatic redirects (D2).

## Acceptance Criteria

T-001
- A navigation (including `/` and `/lists/<id>`) is answered from the network when the network
  answers within `NAVIGATION_NETWORK_TIMEOUT_MS` (3000 ms) with: a 2xx response, a redirect
  (`opaqueredirect` / 3xx), a `401`/`403`, or any response carrying `cf-mitigated: challenge`.
- The precached `/index.html` is returned when the navigation fetch rejects, exceeds the timeout,
  or answers with any other non-OK status (e.g. 5xx such as a Cloudflare 52x / nginx 502).
- A navigation whose URL contains the `__reconnect` query parameter waits for the network without
  the timeout; it still falls back to the precached shell when the fetch rejects or answers 5xx.
- No navigation response is ever written into any cache; the offline shell comes only from the
  Workbox precache. After a redirect/login response was served, an offline reload still shows the
  precached app shell.
- `/` is handled by the network-first navigation route, not by the precache route's
  `directoryIndex` match (navigation route registered before the precache route).
- Existing push / notificationclick behaviour and tests unchanged.
- Docs updated: `docs/DEVELOPMENT.md`, `docs/SETUP.md` (see files list).

T-002
- `/api/health` probe uses `redirect: "manual"`. Classification:
  - `gated`: `response.type === "opaqueredirect"` or 3xx status; `401`/`403`; any response with
    header `cf-mitigated: challenge`.
  - `online`: other 2xx.
  - `offline`: rejected fetch, probe timeout, other non-OK status (unchanged behaviour).
- All app API requests through `requestJson` use `redirect: "manual"`; a response is classified
  `gated` when it is `opaqueredirect`/3xx, carries `cf-mitigated: challenge`, or is `401`/`403`
  whose `Content-Type` is not JSON. Backend JSON `401`/`403` keep their current meaning (JSON
  `401` still triggers `auth:expired`; JSON `403` still an `ApiError`).
- A gated API response throws `EdgeGateError`, reports `gated` to the shared connectivity state
  (not `network-error`), and does not start an extra probe. `isNetworkError(EdgeGateError)` is
  `true`, so GETs fall back to the cache and queueable writes are queued exactly as on a network
  error; the drain retries (never marks the mutation failed, never discards, never triggers
  `auth:expired`).
- Connectivity state exposes `getReachability(): "online" | "offline" | "gated" | null`;
  `getIsOnline()` keeps its contract (`null` unknown, `true` only for `online`, `false` for
  `offline` and `gated`) so the queue never drains while gated.
- `OfflineQueueContextValue` gains `isReauthRequired: boolean`; `isOffline` is `false` while gated.
- `OfflineBanner` shows, while gated, a distinct EN/DE message (with queued count when > 0) and a
  "Reconnect" button; the offline messages are not shown in that state.
- The button navigates to the current path + search + hash with `__reconnect=<timestamp>` added
  (`window.location.assign`). On startup (`main.tsx`, before React renders) the parameter is
  removed via `history.replaceState`, keeping every other query parameter and the hash.
- A classification change to `gated` or `offline` is logged once per state change with
  `console.warn`, containing only the reason (`redirect`, `status-401`, `status-403`,
  `challenge`, `network-error`, `timeout`, `status-<code>`) and the path `/api/health` or the
  request pathname — never query strings, headers, cookies or tokens.
- After the gate is gone, the queue drains exactly once in order and the banner disappears,
  without hard reload or deleting site data (E2E).
- Real network failures behave as before (offline banner, queued writes, drain on reconnect).
- Docs updated: `docs/DEVELOPMENT.md`, `docs/SETUP.md`, `README.md` (see files list).

Both: `npm run lint`, `npm run build`, `npm test` pass; listed E2E specs pass locally.

## Implementation Phases

### Phase 1 — T-001: network-first service-worker navigations

Files to change
- `frontend/src/sw/navigationHandler.js` (new): pure, testable factory
  `createNavigationHandler({ fetchImpl, fallback, timeoutMs, setTimer, clearTimer })` returning
  `async ({ request, url }) => Response`. Exports `NAVIGATION_NETWORK_TIMEOUT_MS = 3000` and
  `RECONNECT_PARAM = "__reconnect"`. Rules:
  1. Start `fetchImpl(request)` (no cache writes anywhere).
  2. Unless `url.searchParams.has(RECONNECT_PARAM)`, race it against the timeout; timeout →
     `fallback(...)`.
  3. Response passes through when `response.type === "opaqueredirect"`, `response.ok`,
     status 3xx/401/403, or `response.headers.get("cf-mitigated") === "challenge"`.
  4. Otherwise (other non-OK) and on rejection → `fallback(...)`.
  5. Clear the timer in every path. Comment each rule with the reason (edge gate needs a
     top-level network navigation; 5xx keeps the offline-capable shell).
- `frontend/src/sw/service-worker.js`:
  - Replace `precacheAndRoute(...)` with `precache(manifest)` → `registerRoute(new
    NavigationRoute(networkFirstHandler))` → `addRoute()` (all from `workbox-precaching` /
    `workbox-routing`), so the navigation route wins over the precache route's `directoryIndex`
    match for `/`.
  - `fallback` = `createHandlerBoundToURL("/index.html")` (created after `precache(...)`).
  - Keep `self.skipWaiting()`, `clientsClaim()`, push and notificationclick handlers unchanged.
  - Update the file header comment: why navigations are network-first (edge gates, normal reload
    must reach Access/challenge), why nothing is runtime-cached, what `__reconnect` does.
  - Dev mode (`devOptions.enabled`) must keep working; if the precache lookup is unavailable in
    dev, the fallback may return the network error — do not throw at module evaluation.
- Tests first:
  - `frontend/src/sw/navigationHandler.test.js` (new, vitest): 2xx passthrough; opaqueredirect
    passthrough; 302/401/403 passthrough; `cf-mitigated: challenge` passthrough (e.g. on 503);
    500/502/522/404 → fallback; rejected fetch → fallback; timeout → fallback (fake timers) and
    the late network response is ignored; `__reconnect` → no timeout, still falls back on
    rejection/5xx; timer cleared on every path; no cache API used.
  - `frontend/src/sw/service-worker.test.js`: update workbox mocks (`precache`, `addRoute`,
    `createHandlerBoundToURL`, `NavigationRoute`, `registerRoute`); assert registration order
    `precache` → `registerRoute(NavigationRoute)` → `addRoute`; existing push/click assertions
    unchanged.
  - `e2e/pwa-navigation.spec.js` (new, production preview via `playwright.pwa.config.js`; HTTP
    fault proxy pattern as in `e2e/push-notifications.spec.js`, API fixtures like the push spec):
    after the worker is activated —
    a. proxy answers navigations to `/` and `/lists/list-1` with `302 → /access-login`;
       `page.reload()` shows "Access login required" (reached the network);
    b. after that, with `context.setOffline(true)`, reload shows the app shell (login page was
       not cached);
    c. proxy answers navigation with 503 → app shell is shown;
    d. proxy delays navigation beyond 3 s → app shell is shown; with `?__reconnect=1` the delayed
       network response is shown instead.
  - `playwright.pwa.config.js`: `testMatch` becomes an array including
    `pwa-navigation.spec.js`; update its header comment.
- Documentation (same commit):
  - `docs/DEVELOPMENT.md` — "Cold-load assets and offline precache": replace "routes app
    navigations to the cached shell when offline" with the network-first rule set (timeout,
    passthrough statuses, 5xx/timeout/offline fallback, no runtime caching, `__reconnect`);
    offline start now waits up to 3 s. "Playwright PWA regression": mention the new spec and
    what it covers.
  - `docs/SETUP.md` — "Cloudflare and reverse proxy": add a short subsection "Service-worker
    navigations and Access" explaining that navigations reach the origin through Access on every
    load, login/challenge responses are shown and never cached, the Cache Rules for
    `/index.html` remain required, and an origin outage (5xx/52x) falls back to the offline shell.

Suggested commit: `fix(pwa): load pages from the network first so a normal reload recovers
from an expired Cloudflare session`

### Phase 2 — T-002: edge-gate detection, reconnect banner and recovery

Files to change
- `frontend/src/api/edgeGate.ts` (new):
  - `type EdgeGateReason = "redirect" | "challenge" | "status-401" | "status-403"`.
  - `detectEdgeGate(response, { anyAuthStatus }): EdgeGateReason | null` — redirect
    (opaqueredirect/3xx), `cf-mitigated: challenge`, 401/403 (always when `anyAuthStatus`, used
    by the health probe; otherwise only when `Content-Type` is not JSON).
  - `class EdgeGateError extends Error` (`name = "EdgeGateError"`, `reason`).
- `frontend/src/api/connectivity.ts`:
  - Internal state `reachability: "online" | "offline" | "gated" | null` replacing the boolean;
    add `getReachability()`; keep `getIsOnline()` contract (see acceptance criteria).
  - `reportRequestOutcome("ok" | "network-error" | "gated", reason?)`; `gated` is a definitive
    answer like `ok` (sets state, clears `stale`, updates `lastCheckedAt`, cancels an in-flight
    probe, notifies on change).
  - Probe: `fetch("/api/health", { cache: "no-store", redirect: "manual", signal })`, classify via
    `detectEdgeGate(..., { anyAuthStatus: true })`, then 2xx → online, else offline.
  - `console.warn` on transitions into `gated`/`offline` with reason and path only.
  - Fast-path checks that use `isOnline === true` keep working with the new state.
  - Update module comments (three states, why gate ≠ offline).
- `frontend/src/api/request.ts`:
  - Add `redirect: "manual"` to the fetch init.
  - After fetch resolves: `detectEdgeGate(response)` → report `gated`, throw `EdgeGateError`;
    else report `ok`.
  - `isNetworkError` returns `true` for `EdgeGateError`; the catch block must not report
    `network-error` nor start `probeReachability()` for an `EdgeGateError`.
  - Comment: gate errors are treated like network errors for caching/queueing but report a
    distinct reachability.
- `frontend/src/api/reconnect.ts` (new): `RECONNECT_PARAM = "__reconnect"` (same literal as the
  service worker; comment cross-references `frontend/src/sw/navigationHandler.js`),
  `buildReconnectUrl(location, now)`, `reconnect()` (`window.location.assign(...)`),
  `stripReconnectParam()` (`history.replaceState`, keeps other params, hash and `history.state`).
- `frontend/src/main.tsx`: call `stripReconnectParam()` before `createRoot(...)`.
- `frontend/src/types.ts`: `OfflineQueueContextValue.isReauthRequired: boolean` with doc comment.
- `frontend/src/context/OfflineQueueContext.tsx`: derive `isOffline = reachability === "offline"`
  and `isReauthRequired = reachability === "gated"` from the connectivity subscription and the
  initial state; drain/retry logic otherwise unchanged (gated → `getIsOnline() === false` → no
  drain, retry backoff continues; recovery to `online` triggers `checkAndDrain` as today).
  Add to the memoised value.
- `frontend/src/components/OfflineBanner/OfflineBanner.tsx`: gated state renders
  `offline.reauth` / `offline.reauthQueued` (count) plus button `offline.reconnect` calling
  `reconnect()`; takes precedence over offline/sync messages; existing states unchanged.
- `frontend/src/locales/en/translation.json`, `frontend/src/locales/de/translation.json`: add
  `offline.reauth`, `offline.reauthQueued` (ICU plural), `offline.reconnect`. Suggested EN:
  "Connected, but your access session has expired. Reconnect to continue syncing." /
  "Connected, but your access session has expired. {count, plural, one {# change} other
  {# changes}} will sync after you reconnect." / "Reconnect". DE: "Verbunden, aber die
  Zugangssitzung ist abgelaufen. Erneut verbinden, um weiter zu synchronisieren." /
  "Verbunden, aber die Zugangssitzung ist abgelaufen. {count, plural, one {# Änderung wird}
  other {# Änderungen werden}} nach dem erneuten Verbinden synchronisiert." / "Erneut verbinden".
- Tests first (add/extend; fixtures may gain realistic fields, existing assertions must not be
  weakened — where an assertion checks the exact fetch init, extend it with `redirect: "manual"`):
  - `frontend/src/api/edgeGate.test.ts` (new): every classification rule incl. JSON vs HTML
    401/403, `cf-mitigated`, opaqueredirect (mock object), 3xx, 2xx/5xx → null.
  - `frontend/src/api/connectivity.test.ts`: probe sends `redirect: "manual"`; redirect/401/403/
    challenge → `gated`, `getIsOnline() === false`; 503/rejection/timeout → `offline`;
    `reportRequestOutcome("gated")` notifies once and cancels an in-flight probe; recovery from
    gated to online notifies; warn log contains reason and no query string.
  - `frontend/src/api/client.test.ts` (or `request` tests): gated GET returns cached value with
    `offline: true`; gated queueable write is queued; HTML 401 does not dispatch `auth:expired`;
    JSON 401 still does; no `network-error` report / extra probe for gate errors.
  - `frontend/src/api/offlineQueueDrain.test.ts`: gated response during drain throws (retry),
    mutation stays queued, not `failed`, not `authExpired`.
  - `frontend/src/api/reconnect.test.ts` (new): URL building keeps path/search/hash; strip keeps
    other params/hash/state and is a no-op without the param.
  - `frontend/src/context/OfflineQueueContext.test.tsx`: gated → `isReauthRequired` true,
    `isOffline` false, no drain; gated → online drains once.
  - `frontend/src/components/OfflineBanner/OfflineBanner.test.tsx`: gated message EN/DE with and
    without queued count, Reconnect button calls `reconnect()`; existing mocks gain
    `isReauthRequired: false`.
  - Other tests mocking `useOfflineQueue` / `OfflineQueueContextValue` gain
    `isReauthRequired: false` where TypeScript requires it.
  - `e2e/edge-gate.spec.js` (new, dev suite with `serviceWorkers: "block"`, API fixtures like
    `e2e/queue-retry.spec.js`): gate active (`/api/*` fulfilled with `302` to a cross-origin
    login URL, and a second case `403` `text/html` with `cf-mitigated: challenge`) → reconnect
    banner visible, offline text absent; add an item → queued count shown; remove the gate, click
    "Reconnect" → URL briefly carries `__reconnect`, ends without it, queued write sent exactly
    once, banner gone; real offline (`context.setOffline(true)`) still shows the offline banner.
- Documentation (same commit):
  - `docs/DEVELOPMENT.md`: offline-support paragraph (around "Offline support caches successful
    reads…") — three reachability states, `redirect: "manual"`, gate classification, gated writes
    are queued, Reconnect + `__reconnect`, console reason logging; E2E section lists
    `e2e/edge-gate.spec.js`.
  - `docs/SETUP.md` — new subsection under "Cloudflare and reverse proxy", e.g. "Expired Access
    session or Cloudflare challenge (stuck offline mode)": symptoms, what the app shows, the
    Reconnect action, the console reason, Cloudflare settings to check (Access policy-level
    session duration overriding the application duration, global/IdP session, Bot Fight Mode,
    Browser Integrity Check, WAF/managed challenges and rate-limit rules matching `/api/*`,
    Challenge Passage), and the user rule: never delete site data while changes are queued —
    use Reconnect (or a normal reload).
  - `README.md`: in the "Works offline" feature bullet or the docs link list, one short sentence
    that an expired access session is shown as such with a Reconnect action and queued changes
    are kept (link to the SETUP subsection).

Suggested commit: `fix(offline): show a reconnect action instead of offline mode when Cloudflare
blocks the app, keeping queued changes`

## Validation
- `npm run lint`
- `npm run build`
- `npm test`
- T-001: `npm run build && npx playwright test --config playwright.pwa.config.js`
- T-002: `npm run e2e -- e2e/edge-gate.spec.js e2e/queue-retry.spec.js e2e/resync.spec.js`

## Risks and notes for the implementer
- Workbox route order: `precacheAndRoute` registers its route first and matches `/` via
  `directoryIndex`; that is why `precache` + navigation route + `addRoute` is required.
- A navigation response of type `opaqueredirect` may be returned to the browser only for
  navigation requests (redirect mode `manual`); never return it for subresource requests.
- Do not add any Cache Storage writes for navigations (a cached login/challenge page would make
  the stuck state permanent).
- Do not treat backend JSON 401/403 as a gate; do not add an `/api/*` Access exception.
- The live trigger (policy session duration vs. challenge) is unconfirmed; the console reason is
  the evidence channel. Real-device verification (Android Chrome/Brave, installed PWA) remains a
  manual check after deployment and must be reported as such, not claimed.
