# Plan

Status: **ready**

Revision 2 — replanned 2026-09-20 after the T-001 review (`rework_plan`). Two findings were
escalated to the planner and are resolved here; see "Replan decisions" below.

Goal: implement the scope defined in `ROADMAP.md` — remove the blocking work from the cold
start of `/lists/<id>` so entries are visible immediately, without losing icon suggestions,
offline behaviour or i18n.

## Replan decisions

Both decisions were taken by the user on 2026-09-20 in response to `.ai/REVIEW.md` findings 1
and 2 for T-001.

1. **No idle warm-up ships.** The roadmap's optional connection-gated idle prefetch is dropped
   outright. `warmIconWorkerWhenIdle()`, its unit tests, its `ListDetailPage.test.tsx`
   assertions and the README sentence describing it are removed. The icon model is fetched on
   sheet open and nowhere else. This removes the contradiction the reviewer identified: an
   automatic warm-up cannot coexist with "a cold load issues no model-host request", and a
   helper with no call site is dead code. The `saveData` / `2g` / `3g` criterion disappears with
   the helper, since there is no longer a speculative download to gate.
2. **The `< 500 KiB` transfer budget moves to a new task, T-006.** It is unreachable from
   T-001's four files: the measured 1266.7 KiB is `icon-512.png`, the precached but never
   executed `iconWorker-*.js` chunk, a double-fetched main bundle, the logo, the PWA icons and
   the Google Fonts pair. T-006 owns the static assets and the precache manifest; T-005 removes
   the font weight. The budget is verified once both have landed.

## Scope

Six tasks, derived from the Lighthouse run of 2026-09-20 recorded in `ROADMAP.md` and from the
cold-load measurement taken during the T-001 review:

| Task | Subject |
| --- | --- |
| T-001 | Icon model no longer loads during the cold start |
| T-002 | Detail page loads each endpoint once and renders entries without waiting for members |
| T-003 | Cached list data renders immediately, network response replaces it |
| T-004 | No startup reachability probe when the offline queue is empty |
| T-005 | Self-hosted fonts, precached, no third-party render blocking |
| T-006 | Static assets and precache manifest trimmed to a real transfer budget |

T-002 lands before T-003: cache-first rendering builds on a load path that runs once.
T-006 is verified after T-005, because the font weight is part of the same budget; it can be
implemented at any point, but its transfer criterion is only meaningful once T-005 has landed.
T-001, T-004 and T-005 are independent of the others and of each other.

## Acceptance Criteria

Verified in a Chrome incognito window with no extensions, mobile Lighthouse, on `/lists/<id>`
with an authenticated session. Cold start means Cache Storage and IndexedDB cleared first.

1. A cold load issues no request to `huggingface.co`, `hf.co`, `cdn.jsdelivr.net`,
   `fonts.googleapis.com` or `fonts.gstatic.com`. (T-001, T-005)
2. Total transfer of a cold load is below 500 KiB, and no single cold-load response exceeds
   150 KiB. Owned by T-006, verified after T-005 has landed.
3. Each of `/api/lists`, `/api/lists/:id/entries`, `/api/lists/:id/history`,
   `/api/lists/:id/members`, `/api/lists/:id/mark-viewed` is requested exactly once per visit.
4. Entries become visible as soon as `/entries` has responded; `/members` does not delay them.
5. With a populated cache, entries are visible as soon as the asynchronous cache read completes,
   without waiting for the network and with no spinner while cached content is displayed.
6. `/api/health` is not requested at startup while the offline queue is empty.
7. Adding an entry still yields an icon suggestion, with a visible loading state while the
   model is still being fetched.
8. Typography is visually unchanged and the app renders with its own fonts while offline.
9. Offline reads, the mutation queue, SSE resync and push behave as before.
10. The PWA still installs and still works offline after the precache exclusions in T-006.

CPU-bound numbers (TBT, main-thread work, bootup time) are recorded as observations in the
review evidence, not used as pass/fail gates — the baseline run was polluted by browser
extensions and is not a fair comparison.

## Implementation Phases

### Phase 1 — T-001: keep the icon model out of the cold start

Status: implemented and reviewed `FAIL`; this phase is now a **rework**. Run it with
`rework_task T-001` and treat `.ai/REVIEW.md` "Required Fixes" as the checklist.

The core deferral already works and was confirmed in a real browser during review: after the
list renders there are zero dedicated workers and zero model requests; opening the add sheet
creates the worker and starts the download; a non-catalogue term shows the spinner while
`EXACT_MATCH_MAP` hits stay instant. **Do not re-open that behaviour.** The rework is
subtractive: remove the idle warm-up that never runs, and stop claiming a budget this task
cannot control.

Files to change:

- `frontend/src/workers/iconWorkerClient.ts`: delete `warmIconWorkerWhenIdle()` and the
  `idleWarmUpScheduled` module flag. `primeIconWorker()` stays as the single explicit warm-up.
  Keep the `// Explicit first-use warm-up; importing this module must not download the model.`
  comment above it and extend it to say the model is fetched only on sheet open, with no
  speculative or idle prefetch.
- `frontend/src/workers/iconWorkerClient.test.ts`: delete the four idle warm-up cases (no-op
  under `saveData`, no-op under slow `effectiveType`, schedules only once, `setTimeout`
  fallback). Keep the cases that must survive: importing the module creates no worker;
  `primeIconWorker()` posts `init`; a worker error rejects pending matches and recreates the
  worker.
- `frontend/src/pages/ListDetailPage.test.tsx`: drop `warmIconWorkerWhenIdle` from the import
  on line 16 and from the `vi.mock` factory on line 20, and drop the two
  `expect(warmIconWorkerWhenIdle).not.toHaveBeenCalled()` assertions. The surrounding test must
  keep both of its `expect(primeIconWorker).not.toHaveBeenCalled()` assertions — before the
  entries resolve and after they render — since that is the actual regression guard.
- `README.md` line 301: delete the final sentence, "The worker client also exposes an optional,
  once-per-page idle warm-up that skips data-saving connections and slow-2g/2g/3g, but list
  visits do not invoke it automatically." The rest of the paragraph is accurate and stays.
- `frontend/src/main.tsx`, `frontend/src/components/AddItemSheet/AddItemSheet.tsx`,
  `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`, `e2e/lists.spec.js`: **unchanged**.
  `ListDetailPage.tsx` was correctly left unwired and stays that way.

Optional, from REVIEW.md finding 4 (`nit`, not required): replace the fixed
`page.waitForTimeout(1500)` in `e2e/lists.spec.js:91` with an explicit load-state or
network-idle wait, so a slow runner cannot hide a late request. Take it only if it does not
destabilise the spec.

Do **not** attempt the transfer budget here — it is T-006. REVIEW.md finding 3 (the precached
`iconWorker-*.js` chunk) is also T-006 scope, not a T-001 fix.

Verification for the rework: confirm by repository-wide search that `warmIconWorkerWhenIdle`
has no remaining occurrence in any file, including `README.md`.

Suggested commit subject: `perf(icons): load the icon model on first use instead of at startup`

### Phase 2 — T-002: load the detail page exactly once

`useListDetailData` takes `accessErrorMessage: t("detail.accessError")` and lists it in the
dependency array of the load effect. i18n resolves resources lazily (`resourcesToBackend`,
`useSuspense: false`), so `t()` switches from the key to the translated string mid-load and the
effect re-runs, refetching all five endpoints. Separately, `loadMembers` is awaited inside the
effect before `setIsLoading(false)` runs in `finally`, so entries wait for a second round trip.

Files to change:

- `frontend/src/pages/ListDetailPage/useListDetailData.ts`:
  - Remove the `accessErrorMessage` option. On a list that is not in the `fetchLists` result,
    set a stable sentinel error instead of a translated string — a `ListAccessError` class
    exported from this module is the clearest form.
  - Confirm the remaining dependencies are stable: `listId`, `token`, `syncVersion`,
    `setEntries`, `loadMembers`, `onLoadStart`, `onNonOwnerList` — the last two are already
    memoised with empty dependency arrays in `ListDetailPage`.
  - Move `setIsLoading(false)` so it runs once the list, entries and history are applied, and
    start the member load without awaiting it. Keep `isSharingLoading` as the members' own
    indicator, and let member failures continue to surface through `setEntryError` (the
    existing `throwOnError: false` branch already does this).
- `frontend/src/pages/ListDetailPage/listDetailUtils.ts`: teach `getErrorMessage` to recognise
  the sentinel, or return the key so the caller can translate it.
- `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`: stop passing `accessErrorMessage`, and
  translate the sentinel with `t("detail.accessError")` at render time.

Tests:

- `frontend/src/pages/ListDetailPage.test.tsx`: a language-resource load after mount does not
  cause a second round of fetches — each endpoint is called exactly once; entries render while
  the members request is still pending; a list missing from the lists response still shows the
  translated access error; a failing members request still surfaces an error banner.
- `frontend/src/pages/ListDetailPage/listDetailUtils.test.ts`: sentinel handling in
  `getErrorMessage`.

Documentation:

- Comments in `useListDetailData.ts` explaining why the error is stored as a sentinel and why
  members are deliberately outside the loading gate.
- `README.md` if it describes the detail page loading behaviour.

Suggested commit subject: `perf(lists): show list entries without waiting for member data`

### Phase 3 — T-003: render cached data first

Timing clarification accepted by the user — 2026-09-21T04:59:12Z: show cached entries as soon
as the cache read completes. A loading frame before IndexedDB returns is acceptable; preloading
before detail-page mount is not required. This supersedes the original first-frame wording.

`sendJsonRequest` writes every successful GET into `offlineStore` but only reads the cache in
the `isNetworkError` branch, so an online cold start always shows a spinner even when the
previous payload is on disk.

Files to change:

- `frontend/src/api/client.ts`: add an opt-in cache-first read for GETs with a `cacheKey` — an
  `onCachedValue` callback (or an equivalent explicit option) that delivers the cached payload
  as soon as it is read, while the network request continues and its response still wins. Do not
  change the existing offline fallback behaviour, and do not emit the cached value after the
  network response has already been applied.
- `frontend/src/api/entries.ts` and `frontend/src/api/lists.ts`: expose that option on
  `fetchEntries` and `fetchLists`.
- `frontend/src/pages/ListDetailPage/useListDetailData.ts`: on mount, apply the cached entries
  and list immediately (`isLoading` false, entries rendered), then replace them with the network
  result. Pending local entries must keep surviving through `mergePendingEntries`, and a cached
  render must not break the `locallyDoneIdsRef` handling or the recently-used filtering.

Tests:

- `frontend/src/api/client.test.ts`: cache-first callback fires before the network resolves; it
  does not fire after the network response; the existing offline fallback path is unchanged.
- `frontend/src/pages/ListDetailPage.test.tsx`: with a populated cache, entries render without a
  loading state and are then replaced by the server payload; with an empty cache the current
  behaviour is unchanged.

Documentation:

- `README.md`: describe the cache-first read behaviour alongside the existing offline section.
- Comments in `client.ts` covering the ordering guarantee.

Suggested commit subject: `perf(lists): show the last known list contents instantly on open`

### Phase 4 — T-004: no reachability probe when there is nothing to sync

`OfflineQueueContext.checkAndDrain()` calls `ensureFreshState()` before it looks at the queue,
so every startup fires `/api/health` — 372 ms in the baseline — even with an empty queue, while
real API calls are already proving reachability through `reportRequestOutcome`.

Files to change:

- `frontend/src/context/OfflineQueueContext.tsx`: read `listOfflineMutations()` first and return
  early when the queue is empty, so `ensureFreshState()` only runs when there is something to
  drain. Keep the existing retry scheduling for the non-empty case, and keep the generation
  guard semantics intact.

Tests:

- `frontend/src/context/OfflineQueueContext.test.tsx`: no probe on mount with an empty queue; a
  probe and a drain with a queued mutation; recovery after an offline period still drains.

Documentation:

- Comment in `OfflineQueueContext.tsx` explaining that reachability is established by real
  requests and only probed when the queue has work.

Suggested commit subject: `perf(sync): stop probing the server at startup when nothing is queued`

### Phase 5 — T-005: self-host the fonts

`frontend/index.html` loads a render-blocking stylesheet from `fonts.googleapis.com`, worth
788 ms in the baseline, and the font files are never precached, so they are refetched on every
cold start and are unavailable offline.

Files to change:

- Inventory the weights actually used: `Exo 2`, `Orbitron` and `JetBrains Mono` appear in the
  CSS with weights 400-800, while `index.html` currently requests Orbitron up to 900. Ship only
  what the stylesheets use.
- Add the woff2 files to the repository (suggested location `frontend/public/fonts/`) with local
  `@font-face` declarations carrying `font-display: swap`.
- `frontend/index.html`: remove the Google Fonts `<link>` and both `preconnect` hints.
- `frontend/vite.config.ts`: add `woff2` to `injectManifest.globPatterns` so the service worker
  precaches the fonts.
- Check the licences (all three are SIL OFL) and record the attribution.

Tests:

- `frontend/src/vite-config.test.ts`: `globPatterns` includes `woff2`.
- A check that `index.html` references no `fonts.googleapis.com` or `fonts.gstatic.com` host —
  extend `frontend/src/styles/index-cleanup.test.ts` or add an equivalent assertion.
- `frontend/src/styles/shared.test.ts` if it asserts anything about font declarations.

Documentation:

- `README.md`: note that fonts are self-hosted and precached, and where they live.
- `LICENSE` or a `frontend/public/fonts/README.md`: font licences and attribution.

Suggested commit subject: `perf(ui): self-host the app fonts so the first paint needs no third-party request`

### Phase 6 — T-006: bring the cold load under a real transfer budget

New task, added in revision 2. It owns the `< 500 KiB` criterion that REVIEW.md finding 2
showed is unreachable from T-001. The review measured a cold load at 1266.7 KiB; the weight is
static assets and the precache manifest, so this task owns both.

Measured cold-load responses to attack, largest first:

| Response | Transfer | Action |
| --- | --- | --- |
| `icon-512.png` | 503.6 KiB | re-encode |
| `assets/iconWorker-*.js` | 162.2 KiB | exclude from precache |
| `assets/index-*.js` | 158.3 KiB, fetched twice | investigate the duplicate fetch |
| `endgame_grocery_logo.png` | 127.4 KiB | re-encode |
| `icon-192.png` | 73.3 KiB | re-encode |
| Google Fonts woff2 pair | 52.1 KiB | removed by T-005 |

Files to change:

- `frontend/public/icon-512.png` (515,411 B on disk) and `frontend/public/icon-192.png`
  (74,777 B): re-encode losslessly or near-losslessly. These are flat PWA icons and should be a
  fraction of their current size. They must stay PNG at exactly 512×512 and 192×192, because
  `vite.config.ts` declares them in the manifest with `purpose: "any maskable"` and lists them
  in `includeAssets`. Do not change the filenames, the dimensions or the maskable safe zone.
- `frontend/src/assets/endgame_grocery_logo.png`: re-encode. It is imported by seven pages
  (`LoginPage`, `RegisterPage`, `OverviewPage`, `ForgotPasswordPage`, `ResetPasswordPage`,
  `VerifyEmailPage`, `InviteAcceptPage`), so it is a hashed bundle asset and is swept into the
  precache by the `png` glob. Check the largest size it is actually rendered at before choosing
  the target resolution; keep the file a PNG so the seven imports need no change.
- `frontend/vite.config.ts`: narrow `injectManifest.globPatterns`, currently
  `["**/*.{js,css,html,svg,png,webmanifest,json}"]`, so that `assets/iconWorker-*.js` is not
  precached. After T-001 that chunk never executes on a cold visit. Prefer adding an explicit
  `globIgnores` entry over rewriting the whole pattern, so nothing else silently drops out of
  the manifest. Note that T-005 adds `woff2` to the same option — expect a conflict there and
  keep both changes.
- Investigate the duplicate `assets/index-*.js` and CSS fetch (once by the page, once by
  service-worker precaching). If it is inherent to `injectManifest` install behaviour, record
  that finding in the handoff and in a comment rather than forcing a fix; if it is avoidable
  through cache headers or manifest scope, fix it.

Tests:

- `frontend/src/vite-config.test.ts`: assert the precache configuration excludes the icon
  worker chunk, alongside the existing assertions. Do not weaken the `woff2` assertion T-005
  adds to the same file.
- Assert the PWA manifest still declares both icons at 192×192 and 512×512 with
  `purpose: "any maskable"`, so a re-encode cannot silently break installability.
- Re-encoding is not unit-testable on its own; it is verified by the reviewer's cold-load
  measurement and the visual check below.

Documentation:

- `README.md`: document the cold-load transfer budget, where the asset weight lives, and that
  the icon worker chunk is deliberately excluded from the precache because it only loads on
  first use.
- Comment in `frontend/vite.config.ts` explaining the precache exclusion and its link to the
  first-use icon loading in `iconWorkerClient.ts`.

Manual verification required before handing to review:

- Cold-load measurement against the production build, after T-005 has landed, recording total
  transfer and the per-response breakdown.
- Visual check of both PWA icons at their installed sizes and of the logo on the login page.
- Install the PWA and load it offline once, to confirm the precache exclusions broke nothing.

Suggested commit subject: `perf(assets): cut the cold-load download weight of icons, logo and precache`

## Validation

Every task runs, before handing over to review:

- `npm run lint`
- `npm run build`
- `npm test`

T-001 and any other task touching the E2E specs additionally run `npx playwright test`.

Environment note carried over from the T-001 review: PostgreSQL and Docker are unavailable in
this environment, so the DB-backed Playwright specs fail with `ECONNREFUSED`. Those failures are
environmental. Report them as such rather than treating them as regressions, and cover the
affected behaviour with API-fixture specs instead.

Reviewer verification, on the finished cycle:

- Cold-start Lighthouse run in an extension-free incognito window, recording transfer weight,
  the list of requested hosts, and the per-endpoint request counts.
- Warm-start run confirming entries appear without a spinner.
- Offline exploratory check: read a cached list, queue a mutation, come back online, confirm the
  queue drains and the fonts still render.
- After T-005 and T-006: the cold-load transfer figure against the 500 KiB budget, with the
  per-response breakdown, plus a PWA install-and-open-offline check.
