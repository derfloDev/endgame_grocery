# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-10-15

#### Findings
1. **nit** — `frontend/src/sw/service-worker.js` (fallback wrapper): `createHandlerBoundToURL("/index.html")` is created on every fallback call rather than once after `precache(...)` as the plan suggested. This is a deliberate, commented deviation so dev mode (no precached `index.html`) does not throw at module evaluation, and it is covered by a unit test. Cost is negligible. Not a required fix.
2. **nit** — `docs/DEVELOPMENT.md` PWA regression paragraph: the new sentence about `e2e/pwa-navigation.spec.js` leaves a short line break before "Android Chrome/Brave installation, opt-in, subscription" (cosmetic wrapping only). Not a required fix.

No blocker or major findings. Every T-001 acceptance criterion maps to code and tests:
- passthrough (2xx, opaqueredirect, 3xx, 401, 403, `cf-mitigated: challenge` incl. on 503) and fallback (reject, timeout, 404/500/502/522) — `navigationHandler.js` plus `navigationHandler.test.js`;
- `__reconnect` removes the timeout but still falls back on rejection / 5xx — unit and E2E tested;
- no Cache API use (test proxies `caches` to throw); offline shell comes only from the precache;
- registration order `precache` → `registerRoute(NavigationRoute)` → `addRoute` asserted in `service-worker.test.js`; `vite-config.test.ts` assertions were adapted, not weakened;
- push / notificationclick handlers and tests unchanged;
- docs updated in `docs/DEVELOPMENT.md` and `docs/SETUP.md`; `playwright.pwa.config.js` includes the new spec.

#### Required Fixes
- None.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md`; reviewed the uncommitted diff and new files (`navigationHandler.js`, its test, `pwa-navigation.spec.js`).
- `npm run lint` — PASS (0 errors; one pre-existing `AuthContext.tsx` fast-refresh warning).
- `npm run build` — PASS (injectManifest, 38 precache entries).
- `npm test` — PASS: frontend 63 files / 934 tests; backend 421 tests, 0 failures.
- `node node_modules/@playwright/test/cli.js test --config playwright.pwa.config.js` (production preview, real worker) — PASS, 9/9 (5 existing push specs + 4 new navigation tests: `/` and `/lists/list-1` redirect-to-login then offline shell, origin 503, 3 s timeout vs `__reconnect`).
- `git diff --check` — no whitespace errors (only CRLF conversion warnings).
##### Findings
- Behaviour matches the plan end to end, including the late-response-ignored and timer-cleared paths. The offline-after-login-redirect E2E proves the login HTML is not cached.
##### Risks
- Offline cold start now waits up to 3 s before showing the shell (accepted, decision D3, documented).
- A legitimately slow network (> 3 s) gets the shell instead of a fresh navigation; the `__reconnect` bypass covers the explicit recovery path (consumed by T-002).
- E2E offline case combines `context.setOffline(true)` with origin connection destroy for determinism; real Android Chrome/Brave installed-PWA verification against Cloudflare Access remains a manual post-deployment check and is not claimed here.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

## Task: T-002

### Review Round 1

Status: **complete**

Reviewed: 2026-10-15

#### Findings
1. **major (required fix)** — `playwright.config.js:5`: `testIgnore` only excludes `push-notifications.spec.js`. The T-001 spec `e2e/pwa-navigation.spec.js` (committed in 8437e78) needs the production preview on `127.0.0.1:4173` and is only meant for `playwright.pwa.config.js`, but the default dev suite (`npm run e2e`, run by `.github/workflows/ci.yml:125`) discovers it (`playwright test --list` shows 4 pwa-navigation tests). Verified: `playwright test e2e/pwa-navigation.spec.js` under the default config fails (`Shared groceries` never appears, upstream 502). CI's full `npm run e2e` will therefore fail. The T-001 and T-002 E2E validations only ran selected specs, so this was never exercised. Fix: add `pwa-navigation.spec.js` to `testIgnore` in `playwright.config.js` (keep the comment pointing to `playwright.pwa.config.js`), then run the full `npm run e2e` (or at least `npx playwright test --list`) to confirm the dev suite no longer lists it.
2. **minor** — `e2e/edge-gate.spec.js:77`: on my first run (cold Vite dev server) the redirect case failed at `reconnect.click()`; it passed on 5 further runs (1 single + 2x repeat of the three requested specs). Likely cold-start timing, not reproducible, not a required fix. Consider tightening if it recurs in CI (e.g. wait for the `__reconnect` navigation with `Promise.all`).
3. **nit** — `frontend/src/api/connectivity.ts` `publishReachability`: `console.warn(reason, pathname)` gives the reason as first argument; if `reason` is ever `undefined` (e.g. `reportRequestOutcome("gated")` without a reason) a bare `undefined` is logged. All current callers pass a reason. Not required.

Everything else in the plan is satisfied: `detectEdgeGate`/`EdgeGateError` rules (JSON 401/403 not gated, health 401/403 always gated, `cf-mitigated`, opaqueredirect/3xx); `redirect: "manual"` on probe and `requestJson`; gate reports `gated` without `network-error` or an extra probe; `isNetworkError(EdgeGateError)` keeps GET cache fallback and write queuing; `getIsOnline()` contract preserved; `isOffline` false / `isReauthRequired` true while gated; EN/DE banner with plural count and Reconnect button taking precedence; `reconnect.ts` keeps path/search/hash and history state; `stripReconnectParam()` runs before render; log contains only reason and pathname; docs (DEVELOPMENT.md, SETUP.md, README.md anchor valid) updated. Existing assertions were not weakened (only fixtures gained JSON headers and `redirect: "manual"` in exact-init checks).

#### Required Fixes
- Finding 1: exclude `e2e/pwa-navigation.spec.js` from the default Playwright dev config and verify the full dev E2E suite no longer picks it up.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; reviewed the full uncommitted diff and new files (`edgeGate.ts`, `reconnect.ts`, tests, `e2e/edge-gate.spec.js`).
- `npm run lint` — PASS (0 errors; pre-existing `AuthContext.tsx` warning).
- `npm run typecheck` — PASS. `npm run build` — PASS.
- `npm test` — PASS: frontend 65 files / 979 tests; backend 421 tests.
- `npm run e2e` subset (`edge-gate`, `queue-retry`, `resync`, `--workers=1`, process-local test `JWT_SECRET`): first run 6 passed / 1 failed (finding 2); `edge-gate` alone 3/3; the three specs again with `--repeat-each=2` 14/14.
- `playwright test --list` shows `pwa-navigation.spec.js` in the default config; running it there fails (finding 1).
- `git diff --check` — clean (CRLF notices only).
##### Findings
- Functionality, state separation (gated vs offline), queue preservation and exactly-once drain behave as specified in unit and E2E tests; real offline still shows the offline banner and no Reconnect button.
##### Risks
- CI `npm run e2e` break (finding 1) until fixed.
- Possible minor flakiness of the Reconnect click on a cold dev server (finding 2).
- Real behaviour against deployed Cloudflare Access / challenges on Android Chrome/Brave (installed PWA) remains a manual post-deployment check; the live trigger is unconfirmed.

#### Open Questions
- None.

#### Verdict
`FAIL`

### Review Round 2

Status: **complete**

Reviewed: 2026-10-15

#### Findings
1. **resolved (was major, Round 1 finding 1)** — `playwright.config.js` now has `testIgnore: ["push-notifications.spec.js", "pwa-navigation.spec.js"]` with an explanatory comment; `docs/DEVELOPMENT.md` documents both discovery commands. `playwright test --list` reports 18 tests / 6 files (neither production spec); `--config playwright.pwa.config.js --list` reports 9 tests / 2 files (both production specs retained).
2. **minor (carried over, not required)** — Possible cold-start flakiness of the `Reconnect` click in `e2e/edge-gate.spec.js`; in this round the three edge-gate specs passed again on a full-suite run (cold server included).
3. **nit (carried over, not required)** — `publishReachability` would log a bare `undefined` reason if a future caller omits it; all current callers pass one.

No new findings. The rework changed only `playwright.config.js` and `docs/DEVELOPMENT.md`; scope and the previously reviewed T-002 implementation are unchanged.

#### Required Fixes
- None.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md`, `.ai/REVIEW.md`; reviewed the rework diff.
- `npm run lint` — PASS (0 errors; pre-existing `AuthContext.tsx` warning). `npm run typecheck` — PASS. `npm run build` — PASS.
- `npm test` — PASS: frontend 65 files / 979 tests; backend 421 tests.
- `playwright test --list` (dev) and `--config playwright.pwa.config.js --list` — as described above.
- Full dev suite `playwright test --workers=1` (process-local test `JWT_SECRET`): `edge-gate` 3/3, `queue-retry` 2/2, `resync` 2/2 and `lists` cold-visit test pass; `pwa-navigation` no longer runs. 11 DB-backed tests (`auth`, `lists`, `sharing`) fail locally because no PostgreSQL is listening on `localhost:5432` (`/api/test/*` setup cannot create users) — an environment limitation unrelated to this diff (no code touched by T-002 is involved in those specs).
- `git diff --check` — clean (CRLF notices only).
##### Findings
- The CI-breaking discovery problem is fixed; all T-002 acceptance behaviour remains covered by passing unit and E2E tests.
##### Risks
- DB-backed dev E2E specs were not runnable locally; they rely on CI's PostgreSQL service to confirm no regression from the `redirect: "manual"` change to `requestJson` (unit tests for the affected API modules pass).
- Real behaviour against deployed Cloudflare Access / challenges on Android Chrome/Brave (installed PWA) remains a manual post-deployment check; the live trigger is unconfirmed.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

## Task: T-003

### Review Round 1

Status: **complete**

Reviewed: 2026-10-15

#### Findings
1. **nit** — `frontend/src/components/OfflineBanner/OfflineBanner.tsx`: while gated with a blocked change, the banner now shows two adjacent `Reconnect`/`Discard` buttons plus an `eg-error-banner` paragraph in a fragment with no wrapper, matching the existing non-gated structure. Layout/styling of this combined state is only unit-tested, not visually verified. Not a required fix.
2. **nit** — The `RECONNECT_PARAM` alignment is enforced by a test importing `../api/reconnect` into `navigationHandler.test.js` (as planned: no shared module, no service-worker build change). Acceptable; a rename in both files together remains possible without the test failing, which is intended.

No blocker or major findings. Acceptance criteria are met:
- gated + `failedMutationId` renders the reconnect message, **Reconnect**, the error text (translated via `syncErrorKey` with `syncError` default, shared `errorText` variable, no duplication) in an `eg-error-banner` paragraph, and **Discard queued change**; gated without a failed mutation is unchanged;
- unit tests cover EN/DE × plain error / `offline.dependencyDiscarded`, each button calls only its own action; the context test shows discarding while gated removes only the blocked row, sends no fetch and leaves reachability `gated`;
- both `RECONNECT_PARAM` constants carry cross-reference comments and an equality test; no assertions weakened; no translation, E2E or service-worker behaviour changes;
- docs updated in `docs/DEVELOPMENT.md` and `docs/SETUP.md` as planned.

#### Required Fixes
- None.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md` (Phase 3), `.ai/REVIEW.md`; reviewed the uncommitted diff (banner, tests, comments, docs).
- `npm run lint` — PASS (0 errors; pre-existing `AuthContext.tsx` warning). `npm run typecheck` — PASS. `npm run build` — PASS.
- `npm test` — PASS: frontend 65 files / 985 tests; backend 421 tests.
- `playwright test e2e/edge-gate.spec.js --workers=1` (process-local test `JWT_SECRET`) — PASS 3/3 (regression; spec unchanged).
- `git diff --check` — clean (CRLF notices only).
##### Findings
- Behaviour matches the plan; the change is limited to the banner's gated branch and comments/tests/docs.
##### Risks
- Combined gated + blocked-change layout not checked visually in a real browser; DB-backed dev E2E specs not run locally (no PostgreSQL), as in the T-002 review. Real Android Chrome/Brave verification against deployed Cloudflare remains manual.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
