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
