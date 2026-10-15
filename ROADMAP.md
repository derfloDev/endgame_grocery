# ROADMAP

Goal: the app must never stay stuck in "offline mode" while the device has a working internet
connection, and recovering from that state must never require deleting site data (which
destroys unsynced offline changes).

Status: roadmap refinement (2026-10-15). All decisions are resolved (see end); ready for
`start_plan`.

## Bug report (user, 2026-10-15)

- The web app regularly gets stuck in "offline mode" (offline banner, changes only queued).
- Affected: Android Chrome, Android Brave, Windows Chrome.
- Typically appears several hours to about one day after the app was opened.
- A normal reload does not help, although the device is definitely online.
- Desktop: a hard reload (`Ctrl+F5`) fixes it.
- Android: only deleting all site data of the app and reopening it fixes it. Offline changes
  that were not yet synchronized are lost permanently.

## Root-cause analysis (planner, from code and deployment docs; not yet verified live)

Most likely cause: the Cloudflare Access session of the deployment expires, and the app has no
way to recover from that.

1. The deployment is behind Cloudflare Access (`docs/SETUP.md`, "Cloudflare and reverse proxy"):
   only the PWA shell resources (`/service-worker.js`, `/index.html`, `/assets/*`, `/fonts/*`,
   icons, manifest) are public; `/`, app routes and all of `/api/*` require a valid Access
   session cookie. Access sessions have a limited lifetime (Cloudflare default 24 h, configurable
   per application) — matching "after several hours or a day".
2. Once the Access cookie has expired, every same-origin API call (`/api/health`, the SSE ticket,
   list/entry requests) is answered by Access with a redirect to the cross-origin Access login
   page (or an Access error page). `fetch` cannot follow that redirect (CORS) and rejects with a
   `TypeError`, which the app treats as a network error.
3. `frontend/src/api/connectivity.ts` (`probeReachability`) treats every failed or non-`ok`
   `/api/health` response as "offline". The app therefore shows the offline banner and queues all
   writes (`frontend/src/api/client.ts`), although the network is fine.
4. A normal reload does not help: the service worker (`frontend/src/sw/service-worker.js`)
   answers every navigation with the precached `/index.html` (`NavigationRoute`), so the browser
   never sends a navigation request to the network and Access never gets the chance to
   redirect to its login and issue a new cookie. The reloaded app hits the same gated API again.
5. `Ctrl+F5` bypasses the service worker for that navigation; the request reaches Access, the
   login/SSO refreshes the cookie, and the app works again. Android has no hard reload, so only
   deleting site data (which unregisters the service worker) has the same effect — and it also
   deletes the IndexedDB offline queue (`endgame-grocery-offline`), losing unsynced changes.

The app's own JWT is not the cause: an expired app session answers `401`, which already leads
to `auth:expired` and the login page rather than to the offline banner.

Update after D1: the administrator reports Access is active with an application session
duration of **1 month**. A plain application-session expiry therefore does not explain failures
after hours to one day. The mechanism above (an edge component in front of the origin answers
same-origin API calls with a redirect/challenge that only a top-level network navigation can
clear, and the cache-first service-worker navigation prevents that navigation) still matches
every symptom, including "hard reload fixes it, normal reload does not". Candidate triggers, to
be checked by the administrator outside the repository:

- an Access **policy-level** session duration, which overrides the application duration;
- Cloudflare security features that issue a challenge to API requests (Bot Fight Mode, Browser
  Integrity Check, WAF managed challenge, rate limiting); the resulting `cf_clearance` cookie is
  short-lived (Challenge Passage, default 30 minutes) and can only be renewed by a top-level page
  load;
- an Access/IdP global session shorter than the application session.

The fix is therefore designed for a generic **edge gate** ("server reachable, but the request
was intercepted by Access or a Cloudflare challenge"), not for one specific Cloudflare setting.
Because the trigger is unconfirmed, the probe also records the reason why it failed (see
Priority 1), so the next occurrence leaves evidence without DevTools.

Optional evidence (not blocking): next time the app is stuck on desktop, open DevTools > Network
before `Ctrl+F5` and note status, response type and redirect target of `/api/health` (never
share cookies or Access query strings).

## Priority 1 — detect a gated connection instead of reporting "offline"

Objective: distinguish "network unreachable" from "server reachable, but access session
expired" and never put the app into offline mode for the latter.

- The reachability probe recognises an edge gate deterministically (for example: same-origin
  `/api/health` requested with `redirect: "manual"` returns an opaque redirect, or any response
  that is not the backend's JSON health body, such as an HTML `401`/`403`/`503` challenge or login
  page) and reports a distinct state such as `reauth-required`, separate from `offline`. Only a
  rejected fetch or a timeout counts as `offline`.
- The probe logs the classification reason (`opaqueredirect`, status code, non-JSON body,
  network error, timeout) to the browser console without URLs' query strings, cookies or tokens,
  so the trigger can be identified on the next occurrence.
- API requests failing because of the gate do not mark the app offline; queued writes stay in
  the queue untouched until the session is restored, then drain normally.
- The banner shows a distinct, translated (EN/DE) message for this state instead of the offline
  message.

## Priority 2 — recover without hard reload or deleting site data

Objective: the user can restore the Access session from inside the app on every affected
browser, including installed Android PWAs, and no queued change is lost.

- Recovery mechanism (D2, decided): the banner for the gated state shows a translated (EN/DE)
  button such as "Reconnect". Clicking it performs a top-level page load that reaches the network
  (and therefore Access login or the Cloudflare challenge) and returns to the current app route.
  No automatic redirect.
- Service-worker navigations (D3, decided): switch from cache-first (precached `/index.html` via
  `NavigationRoute`) to network-first with a short timeout (about 3 s) and the precached
  `/index.html` as fallback when the network fails or times out. Consequences:
  - a normal reload re-authenticates / passes the challenge again;
  - redirect, login or challenge responses are passed through to the browser but never stored
    as the app shell; only the precache provides the offline shell;
  - starting the app while truly offline takes up to the timeout before the cached shell
    appears.
- Queued offline changes in IndexedDB survive the whole re-authentication round trip and are
  sent after it (D4, decided: queue preservation is sufficient, no extra warnings).

## Priority 3 — documentation

- `docs/SETUP.md` (Cloudflare and reverse proxy): explain how an edge gate (Access session or
  policy duration, Cloudflare challenges on `/api/*`) affects the PWA, the in-app recovery, the
  network-first navigation, and which Cloudflare settings to check (policy session duration,
  Bot Fight Mode / Browser Integrity Check / WAF challenges on `/api/*`, Challenge Passage).
- `docs/DEVELOPMENT.md`: update the service-worker / offline-shell description to network-first
  navigations with precache fallback.
- Troubleshooting note for users: never delete site data to escape offline mode while changes
  are queued; what to do instead.
- Update code comments in `connectivity.ts`, `service-worker.js` and affected docs in the same
  commit as the behaviour change (`AGENTS.md` documentation rules).

## Acceptance criteria (draft)

- With an expired/missing Access session (simulated in tests by a redirecting or `401` HTML
  `/api/health`), the app does not show the offline banner and does not report `isOffline`;
  it shows the re-authentication state instead.
- With a real network failure (fetch rejects, timeout), behaviour is unchanged: offline banner,
  writes are queued, queue drains on reconnect.
- After re-authentication the queued writes are sent exactly once, in order, and the banner
  disappears without a hard reload or deleting site data.
- A normal reload while the edge gate is active no longer leaves the app stuck: the navigation
  reaches the network; redirect/challenge responses are never cached as the app shell.
- With the network unavailable, a reload still shows the precached app shell (after at most the
  navigation timeout) with cached lists and the offline banner.
- Unit tests cover the new probe classification and the recovery trigger; an E2E test (Playwright,
  `e2e/`) simulates a gated `/api/*` and verifies the recovery path and queue survival.
- `npm run lint`, `npm run build`, `npm test` pass.

## Out of scope (unless decided otherwise)

- Changing Cloudflare account settings from the repository (the session duration is an
  administrator setting; it is only documented).
- Adding a public Access exception for `/api/*` or `/api/health` (contradicts `docs/SETUP.md`;
  it would also make the probe report "online" while all real API calls still fail).
- Export/backup of the offline queue.

## Decisions (user, 2026-10-15)

- D1 — Cloudflare Access is active; application session duration is 1 month. The exact trigger
  is unconfirmed (see root-cause update); the fix targets any edge gate.
- D2 — Recovery: manual "Reconnect" button in the banner, no automatic redirect.
- D3 — Service worker: network-first navigations with ~3 s timeout and precached shell fallback.
- D4 — Data safety: preserving the queue across re-authentication is sufficient.

## Follow-up — review notes on T-001/T-002 (ultrareview, 2026-10-15)

Status: planned as T-003 (2026-10-15, see .ai/PLAN.md Phase 3). T-001 and T-002 are `done` and committed (`8437e78`, `1e33742`);
these two non-blocking polish items would be a new task, not a rework of T-002.

- N1 — Banner hides a blocked mutation while gated
  (`frontend/src/components/OfflineBanner/OfflineBanner.tsx`, early return for
  `isReauthRequired`). When a queued mutation is already blocked by a permanent 4xx
  (`failedMutationId` set) and the shared state then becomes `gated`, the banner shows only the
  reconnect message. The failed-mutation error text and the "Discard queued change" button
  disappear, although discarding only removes an IndexedDB row and needs no network.
  Outcome: while gated, the banner keeps the reconnect message and Reconnect button and also
  shows the failed-mutation error text and the Discard button when `failedMutationId` is set.
  Tests in `OfflineBanner.test.tsx` cover gated + failed mutation (EN/DE) and the Discard action.
  Docs: update the banner description in `docs/DEVELOPMENT.md` (edge-gate E2E paragraph, "the
  distinct Reconnect banner replaces offline messages") and any matching banner description in
  `docs/SETUP.md`, plus the code comment above the gated branch in `OfflineBanner.tsx`.
- N2 — `RECONNECT_PARAM` is defined twice (`frontend/src/sw/navigationHandler.js` and
  `frontend/src/api/reconnect.ts`), tied only by a "keep aligned" comment. If they drift, the
  service worker no longer recognises explicit reconnect navigations and the 3 s timeout
  applies again. Approach: see decisions below.

Decisions (user, 2026-10-15):

- Scope: implement N1 and N2 together as one polish task (T-003) in this cycle.
- N2 approach: keep both constants and add a unit test that imports both exported values and
  asserts they are equal; update the "keep aligned" comments in both files to name that test.
  No shared module, no service-worker build change.
