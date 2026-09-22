# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-09-20

#### Findings

1. `major` — `frontend/src/workers/iconWorkerClient.ts:99` — required fix.
   `warmIconWorkerWhenIdle()` is exported, unit-tested and described in `README.md`, but has zero
   production call sites. PLAN.md Phase 1 requires `ListDetailPage.tsx` to call it from an effect
   once `isLoading` is false; `ListDetailPage.tsx` is unchanged and never calls it. The implementer
   flagged this as a deliberate deviation because an automatic idle warm-up would re-introduce a
   `huggingface.co` request on a cold visit and break acceptance criterion 1. The reviewer agrees
   the stricter no-model-request reading is correct, so the helper must not be wired up — which
   leaves shipped dead code plus a `README.md` paragraph documenting behaviour that never runs.
   Resolve in one direction: either delete `warmIconWorkerWhenIdle()`, its tests and the README
   sentence about the idle warm-up, or take the conflict back to the planner via `rework_plan`
   so PLAN.md and the task acceptance criteria stop asking for a call site that cannot exist.

2. `major` — `.ai/TASKS.md:23` / `.ai/PLAN.md:31` — required fix.
   The acceptance criterion "cold-load transfer < 500 KiB" is not met and cannot be met within
   T-001's declared file scope. Independently measured at 1266.7 KiB over 20 static responses
   against the production build (see Verification). The weight comes from assets no T-001 file
   controls: `icon-512.png` 503.6 KiB (over the whole budget on its own), the precached
   `endgame_grocery_logo` 127.4 KiB, `icon-192.png` 73.3 KiB, the Google Fonts woff2 pair
   52.1 KiB (T-005 scope), and duplicate page-load/service-worker fetches of the same JS and CSS.
   This is a planning defect rather than an implementation defect: the budget belongs to a task
   that owns the PWA precache manifest and the icon/logo assets. Replan the criterion — move it
   to a new asset/precache task or restate it as a cycle-level goal — before T-001 can pass.

3. `minor` — `frontend/vite.config.ts` (precache manifest) — not a required fix.
   `assets/iconWorker-*.js` (162.2 KiB transfer) is still precached and downloaded on a cold
   visit even though the worker never starts and the module never executes. T-001 removed the
   22.9 MB model and the 23.5 MB ONNX WASM runtime from the cold path, but the icon feature still
   costs 162.2 KiB there. Excluding that chunk from `injectManifest.globPatterns` would be the
   natural completion of this task's intent; it is outside the planned file scope, so it is
   recorded as a follow-up rather than a required fix.

4. `nit` — `e2e/lists.spec.js:91` — not a required fix.
   The cold-load spec settles with a fixed `page.waitForTimeout(1500)` before asserting that no
   worker and no model request appeared. A fixed sleep can hide a request that arrives late on a
   slower runner. Consider asserting after an explicit network-idle or load-state wait instead.

#### Required Fixes

1. Resolve finding 1: remove `warmIconWorkerWhenIdle()` together with its tests and its README
   paragraph, or return to the planner to legitimise a call site.
2. Resolve finding 2: replan the `< 500 KiB` transfer criterion out of T-001, since it is
   unreachable from `main.tsx`, `iconWorkerClient.ts`, `AddItemSheet.tsx` and `ListDetailPage.tsx`.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; 1 pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS (pre-existing chunk-size warning; precache reported as 14 entries,
  1845.01 KiB).
- `npm test` — PASS, 763 tests (589 frontend via `vitest run --environment jsdom`, 174 backend).
- `npx playwright test -g "cold list visits do not request the icon model"` — PASS (10.6 s).
- Automated cold-load measurement against `vite preview` of the production build, with API
  fixtures and a fresh browser context, recording per-response transfer weight, requested hosts
  and dedicated-worker creation.
- Manual browser walkthrough of the first-use path against the same production build:
  load `/lists/list-1`, open the add sheet, type a non-catalogue term, then type an exact
  catalogue match.
- Source review of the diff across `main.tsx`, `iconWorkerClient.ts`, `AddItemSheet.tsx`,
  `useIconSuggestion.ts`, `README.md` and the four test files.
- Repository-wide search for `warmIconWorkerWhenIdle` and `primeIconWorker` call sites.

##### Findings

- Acceptance criterion "no `huggingface.co`, `hf.co` or `cdn.jsdelivr.net` host on a cold load"
  — PASS. Measured hosts on a cold `/lists/<id>` load: `localhost`, `fonts.googleapis.com`,
  `fonts.gstatic.com`. Model hosts: none. Dedicated workers created: none.
- Acceptance criterion "cold-load transfer < 500 KiB" — FAIL at 1266.7 KiB. Largest responses:
  `icon-512.png` 503.6 KiB, `assets/iconWorker-*.js` 162.2 KiB, `assets/index-*.js` 158.3 KiB
  (fetched twice, once by the page and once by service-worker precaching),
  `endgame_grocery_logo` 127.4 KiB, `icon-192.png` 73.3 KiB. This reproduces the ~1263 KiB the
  implementer reported. See finding 2 for the scope conclusion.
- Acceptance criterion "adding an entry still yields an icon suggestion with a visible loading
  state" — PASS, confirmed manually in a real browser. After the list rendered: 0 workers,
  0 model requests. After opening the add sheet: 1 dedicated worker and 10 requests to
  `huggingface.co` (first: `Xenova/all-MiniLM-L6-v2/resolve/main/config.json`), so priming is
  correctly deferred to first use. Typing a non-catalogue term rendered the
  `aria-label="Loading icon suggestion"` spinner; typing `milk` rendered the icon preview with no
  spinner, so the `EXACT_MATCH_MAP` fast path is unaffected.
- Acceptance criterion "idle warm-up skipped on `saveData` or 2g/3g" — the guard is implemented
  and unit-tested (`saveData`, `slow-2g`, `2g`, `3g` all no-op; scheduling happens once;
  `setTimeout` fallback when `requestIdleCallback` is missing), but the helper is never invoked in
  production, so the criterion is vacuous as shipped. See finding 1.
- `AddItemSheet` is the component behind both the add and the edit sheet, so the README claim that
  the add/edit sheet starts the download is accurate. The `useEffect` guard fires only on the
  `open` transition, and the component test covers closed, open, re-render, close and re-open.
- The new E2E spec is a genuine regression guard: it asserts zero dedicated workers, which the
  previous module-scope `primeIconWorker()` in `main.tsx` would have violated.
- The loading state in `useIconSuggestion` is set before `requestIconMatch` resolves and is
  independent of whether the model is already cached, so it covers the first-use download window.
- Documentation rule satisfied for the behaviour that ships: `README.md` explains first-use
  fetching, the slower first suggestion, and the offline consequence for semantic matches. The
  final sentence of that paragraph documents the unused idle warm-up and must go with finding 1.

##### Risks

- PostgreSQL is not reachable in this environment and Docker is unavailable, so the DB-backed
  Playwright specs and a true end-to-end manual test against the live backend could not run. The
  9 failures the implementer reported are `ECONNREFUSED` on the database and are environmental,
  unrelated to this diff. Coverage was obtained instead through the API-fixture E2E spec and the
  manual production-build walkthrough, both of which exercise real frontend startup and real
  worker creation.
- A real model download completing and semantic matching succeeding offline from browser cache
  were not exercised end to end. The download was confirmed to start on first use; its completion
  and cache reuse remain unverified.
- Deferring the download to sheet-open means the very first semantic suggestion after a cold start
  now waits on a ~23 MB model fetch. On a slow connection this is a visibly longer spinner than
  before. Exact catalogue matches are unaffected and cover the common case.

#### Open Questions

- Should `warmIconWorkerWhenIdle()` be removed outright, or kept with a call site the planner
  sanctions? The reviewer's recommendation is removal, because any automatic warm-up conflicts
  with the no-model-request criterion that this task exists to satisfy.

#### Verdict

`FAIL`

### Review Round 2

Status: **complete**

Reviewed: 2026-09-20

Scope: the subtractive rework required by Round 1 and sanctioned by PLAN.md revision 2 — removal
of `warmIconWorkerWhenIdle()` and everything that documented or tested it. The deferral behaviour
itself was re-verified rather than assumed.

#### Findings

1. `minor` — `.ai/TASKS.md:23` (acceptance criterion) — not a required fix.
   The criterion "no `warmIconWorkerWhenIdle` occurrence left in the repository" is not literally
   met: four occurrences remain, in `.ai/PLAN.md`, `.ai/TASKS.md`, `.ai/REVIEW.md` and
   `.ai/HANDOFF.md`. All four are append-only workflow records that document the decision to
   remove the helper, and one of them is the criterion's own text, so the criterion is
   self-referential and cannot be satisfied as written. Zero occurrences remain in implementation
   code, tests, `README.md` or `ROADMAP.md`, which is the intent. Accepted as written; the
   implementer's reasoning in the `rework_task` handoff entry is correct.

2. `minor` — repository root (commit hygiene) — required action at `commit_task`, not a code fix.
   The working tree carries two changes unrelated to T-001: untracked `get-docker.sh` (23,731 B,
   the upstream Docker Engine install script) and modified `.claude/settings.local.json`.
   `commit_task` runs `git add -A && git commit`, which would sweep both into the
   `perf(icons): …` commit and pollute the release notes. Exclude them from the T-001 commit —
   delete or ignore `get-docker.sh` and keep the settings file out — or commit them separately
   beforehand. No change to T-001's code is needed.

3. `nit` — `e2e/lists.spec.js:91` — not a required fix.
   The fixed `page.waitForTimeout(1500)` from Round 1 finding 4 is unchanged. PLAN.md Phase 1
   explicitly made this optional and conditioned it on not destabilising the spec, so leaving it
   is a sanctioned choice. The spec passed in 6.3 s here and is a genuine regression guard.

4. `nit` — `frontend/src/app.test.tsx:172` — not a required fix, not a regression.
   "submits the login form and shows the protected overview" exceeded its 10 s budget on the
   reviewer's first full frontend run (81.6 s wall) and passed on an immediate re-run (60.0 s
   wall, 582/582). The file is untouched by this diff and exercises the login flow, not the icon
   worker. Recorded as a pre-existing load-sensitive flake so it is not mistaken for T-001 fallout
   later in the cycle.

#### Required Fixes

None blocking. Finding 2 is a commit-time action for `commit_task`, not a change to the diff.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the one pre-existing `react-refresh` warning in
  `AuthContext.tsx`).
- `npm run build` — PASS (pre-existing chunk-size warning; precache 14 entries, 1845.01 KiB).
- `npm test` — backend PASS, 174/174.
- `npx vitest run --environment jsdom` (frontend) — run 1: 581/582 with the `app.test.tsx` timeout
  in finding 4; run 2: 582/582 PASS, exit 0.
- `node node_modules/@playwright/test/cli.js test -g "cold list visits do not request the icon model"`
  — PASS (6.3 s, 18.3 s total), first attempt, no retry needed.
- Real-browser verification against `vite preview` of the production build on port 4318, with API
  fixtures and a fresh context: cold load of `/lists/list-1`, then sheet open, then a
  non-catalogue term, then an exact catalogue match.
- Source review of the full working-tree diff across `main.tsx`, `iconWorkerClient.ts`,
  `AddItemSheet.tsx`, `README.md` and the four test files.
- Repository-wide search for `warmIconWorkerWhenIdle` and `idleWarmUpScheduled`.
- `git diff --check` — clean.

##### Findings

- Criterion "cold load requests no `huggingface.co`, `hf.co` or `cdn.jsdelivr.net` host" — PASS.
  Measured hosts on a cold `/lists/<id>` load: `localhost`, `fonts.googleapis.com`,
  `fonts.gstatic.com`. Model-host requests: 0. Dedicated workers created: 0.
- Criterion "adding an entry still yields an icon suggestion with a visible loading state" — PASS.
  Opening the add sheet created exactly 1 dedicated worker (`assets/iconWorker-C_LknZ8d.js`) and
  started 10 requests to `huggingface.co`, the first being
  `Xenova/all-MiniLM-L6-v2/resolve/main/config.json`. Typing the non-catalogue term
  `zzqqx widget` rendered the `aria-label="Loading icon suggestion"` spinner. Typing `milk`
  rendered icons with no spinner, so the `EXACT_MATCH_MAP` fast path is unaffected by the
  deferral.
- Criterion "model fetched on sheet open only, no idle or speculative warm-up" — PASS. Zero model
  requests across the full cold load plus a 2.5 s settle after network idle; the first request
  appears only after the sheet opens. The code path is now unambiguous: `main.tsx` no longer
  imports the client, and `primeIconWorker()` has exactly one production call site, the
  `open`-gated effect in `AddItemSheet.tsx`.
- Criterion "no `warmIconWorkerWhenIdle` occurrence left in the repository" — PASS in substance.
  The helper, the `idleWarmUpScheduled` module flag, the parameterised idle-prefetch unit cases,
  the `ListDetailPage.test.tsx` mock/import/assertions and the README sentence are all gone.
  Remaining occurrences are confined to `.ai` workflow records; see finding 1.
- Round 1 finding 1 is resolved in the direction the planner chose. Round 1 finding 2 is resolved
  by PLAN.md revision 2 moving the `< 500 KiB` budget to T-006; no transfer criterion is asserted
  against T-001 any more, and the implementer correctly made no asset or precache changes.
- Test coverage of the surviving behaviour is intact and meaningful, not merely reduced:
  `iconWorkerClient.test.ts` keeps "importing the module creates no worker", explicit-init and
  crash-recovery; `AddItemSheet.test.tsx` covers closed, open, re-render while typing, close and
  re-open, asserting the call count at each step; `ListDetailPage.test.tsx` keeps both
  `expect(primeIconWorker).not.toHaveBeenCalled()` assertions, before and after entries render.
  The `AddItemSheet` effect fires once per `open` transition, exactly as the test asserts.
- Documentation rule satisfied. The `README.md` paragraph now describes only shipped behaviour:
  first-use fetching on add/edit sheet open, a slower first semantic suggestion with a loading
  indicator, immediate offline-capable exact matches, and manual icon choice as the fallback. The
  comment above `primeIconWorker()` states the invariant the E2E spec enforces.
- Observation, not a gate: the content-length sum of the cold load measured 755.7 KiB in this run,
  against the 1266.7 KiB transfer figure recorded in Round 1. The two numbers are not comparable —
  this one sums declared `content-length` headers rather than wire transfer, and was taken against
  a warm preview server. It is recorded only so the T-006 reviewer re-measures with the Round 1
  method rather than reading a false improvement into this figure.

##### Risks

- PostgreSQL and Docker remain unavailable here, so the DB-backed Playwright specs and a
  live-backend manual pass could not run. Coverage came from the API-fixture E2E spec and the
  production-build browser walkthrough, both of which exercise real startup and real worker
  creation.
- The model download was confirmed to start on first use; its completion, browser-cache retention
  and offline semantic reuse are still unverified end to end. Unchanged from Round 1.
- The first semantic suggestion after a cold start now waits on a ~23 MB fetch, so on a slow
  connection the spinner is visibly longer than before. This is the accepted cost of the task and
  is bounded to non-catalogue terms.
- `.claude/settings.local.json` was modified during this review session by permission grants, not
  by the implementer. It is called out in finding 2 only because `git add -A` would capture it.

#### Verdict

`PASS_WITH_NOTES`

## Task: T-002

### Review Round 1

Status: **complete**

Reviewed: 2026-09-20

Scope: working-tree changes to `useListDetailData.ts`, `listDetailUtils.ts`, `ListDetailPage.tsx`,
their two test files and `README.md`, against PLAN.md Phase 2.

#### Findings

1. `nit` — `frontend/src/pages/ListDetailPage/listDetailUtils.ts:57` — not a required fix.
   `getErrorMessage(error, accessErrorMessage = "detail.accessError")` defaults to the raw i18n
   key, so a future caller that forgets the second argument would render `detail.accessError` to
   the user instead of a sentence. Harmless today — the only call site that can receive a
   `ListAccessError` is `ListDetailPage.tsx:280`, and it passes `t("detail.accessError")`; every
   other `getErrorMessage` call in the page and the hook converts errors that can never be the
   sentinel. PLAN.md explicitly allowed "return the key so the caller can translate it", so this
   matches the plan. A required second parameter would make the footgun unrepresentable.

2. `nit` — `frontend/src/pages/ListDetailPage/useListDetailData.ts:437` — not a required fix.
   `setIsSharingLoading(false)` was removed from the effect's `finally`. That is correct for the
   normal paths, because `loadMembers` now owns the flag in all of its branches (non-owner,
   success and failure). It does leave one narrow window: if an owner list's member request is
   still in flight when the effect re-runs for a non-owner list or for a list the user can no
   longer access, neither of those branches calls `loadMembers`, so `isSharingLoading` stays true
   until the previous request's own `finally` clears it. No user-visible consequence today —
   `onNonOwnerList` closes the share sheet and the access-error state has no sheet — and the
   previous request always does settle the flag. Worth knowing if the share sheet ever becomes
   reachable earlier.

#### Required Fixes

None.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS (pre-existing chunk-size warning; precache 14 entries, 1845.07 KiB).
- `npx vitest run --environment jsdom` (frontend) — PASS 588/588, 41 files, exit 0.
- `npm test --workspace backend` — PASS 174/174.
- `node node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json` — 3 errors, and the
  implementer's "pre-existing" claim was checked rather than taken on trust: the five changed
  source files were stashed and the typecheck re-run against the committed baseline, which
  produced the identical three errors (`ListDetailPage.tsx` `DetailEntry.details` nullability,
  `OverviewPage.test.tsx` `owner_name`, `iconWorker.ts` `quantized`), differing only by the
  one-line shift in `ListDetailPage.tsx`. The diff introduces no new type errors. Working tree
  restored and re-verified afterwards.
- Real-browser verification against `vite preview` of the production build on port 4318, three
  scenarios with API fixtures, per-endpoint request counting, the service worker blocked so it
  cannot distort the counts, and the lazily loaded `assets/translation-*.js` chunk artificially
  delayed to reproduce the original defect.
- Source review of the full diff, plus a trace of every `getErrorMessage`, `entryError`,
  `ListAccessError` and `isSharingLoading` reference in the frontend.
- Dependency-stability check of the load effect: `loadMembers` (`useCallback` on `listId`,
  `token`), `setEntries` (empty deps), and `onLoadStart` / `onNonOwnerList` (`useCallback` with
  empty deps at `ListDetailPage.tsx:51` and `:55`).

##### Findings

- Criterion "each of `/api/lists`, `/entries`, `/history`, `/members`, `/mark-viewed` requested
  exactly once per visit even after lazy i18n resources arrive" — PASS. Scenario A held the
  translation chunk for 2.5 s and the members response for 4 s; after network idle plus a 3.5 s
  settle the counts were 1 / 1 / 1 / 1 / 1. Scenario B (members 503) gave the same counts.
  Scenario C (list absent) gave 1 / 1 / 1 and correctly issued neither `/members` nor
  `/mark-viewed`.
- Criterion "entries visible as soon as `/entries` resolves" — PASS. In both scenarios A and B,
  `Milk` was visible while the members response was still being held, and no `LoadingState`
  skeleton was present at that moment. This is the behaviour the removed `await loadMembers(...)`
  used to block.
- Criterion "access error still surfaces translated" — PASS. Scenario C, with `i18nextLng` set to
  `de`, rendered "Du hast keinen Zugriff mehr auf diese Liste." in the error banner. The sentinel
  survives the round trip from hook to render and is translated at render time, which is the
  point of the change.
- Criterion "member-load failures still surface translated" — PASS. Scenario B rendered the
  member error in `.eg-error-banner` while "Weekly groceries" and "Milk" both stayed on screen.
  Under the old `throwOnError: true` path the outer catch cleared the list, entries, members and
  history; that destructive behaviour is gone and the message itself is unchanged, since the old
  path already surfaced the same raw error string through the same banner.
- The root cause is genuinely removed, not worked around. `accessErrorMessage` is gone from the
  hook's options and from the effect's dependency array, and no remaining dependency is derived
  from `t()`, so an arriving language resource cannot restart the load. `ListAccessError` lives in
  `listDetailUtils.ts` rather than the hook, which the implementer notes avoids a circular import
  — checked and correct, since the hook already imports from that module.
- `entryError` was already typed `unknown`, so storing an `Error` subclass needed no widening, and
  `shouldSuppressEntryError`'s `instanceof AuthExpiredError` check is unaffected.
- Tests are real regression guards and were written test-first per the handoff. The i18n case
  builds an actual `i18next` instance with a stub backend, asserts `t("detail.accessError")`
  returns the bare key before resources land and the translated string after, and asserts the
  five call counts on both sides of that transition — it would have failed against the old code.
  The members-pending case distinguishes the page skeleton from the sharing spinner through the
  same `aria-label="Loading"` on `LoadingState`, asserting it absent on the page and then present
  inside the share sheet. The language-switch case proves re-translation with no refetch. The
  member-failure case pins entries, title and the banner together.
- `listDetailUtils.test.ts` covers the sentinel in both languages and confirms ordinary `Error`
  and non-`Error` values still pass through unchanged.
- Documentation rule satisfied. The new `README.md` paragraph describes exactly the shipped
  behaviour — one load per visit, unaffected by translation loading or switching; entries not
  gated on members; a separate member indicator; a member failure that keeps the list visible —
  and the two new comments in `useListDetailData.ts` state why the error is a sentinel and why
  members sit outside the loading gate.

##### Risks

- The browser scenarios used API fixtures with the service worker blocked, so a real
  service-worker-served visit was not measured. The request counting would otherwise be
  unreliable, and the counts under test are client-initiated, so this is a measurement trade-off
  rather than a coverage gap.
- PostgreSQL and Docker remain unavailable here, so the DB-backed Playwright specs and a
  live-backend pass could not run. Unchanged from T-001 and recorded in PLAN.md.
- A language switch performed through the app's own UI on an already-rendered access error was
  not exercised in the browser; it is covered at unit level by the `changeLanguage("de")` test,
  and scenario C confirms the sentinel translates correctly at render in German.
- The three `tsc --noEmit` errors are pre-existing and out of scope here, but they mean the
  project's typecheck cannot currently be used as a regression gate. Worth a cleanup task in a
  later cycle; it does not block T-002.

#### Verdict

`PASS_WITH_NOTES`

## Task: T-003

### Review Round 1

Status: **complete**

Reviewed: 2026-09-21

Scope: working-tree changes to `client.ts`, `entries.ts`, `lists.ts`, `useListDetailData.ts`,
their tests and `README.md`, against PLAN.md Phase 3 as amended by the user's timing
clarification of 2026-09-21T04:59:12Z.

#### Findings

1. `minor` — `frontend/src/api/client.ts:35` (`createCacheKey`) — not a required fix; a planner
   decision rather than a defect in this diff.
   Cached resources are keyed `lists` and `entries:<listId>`, with no user or account component,
   and `logout()` in `AuthContext.tsx:87` only clears the auth token — nothing clears cached
   resources, and `offlineStore` exposes no production clear function. Before this change that
   unscoped cache only surfaced on the network-error fallback path. Cache-first rendering now
   surfaces it on every online detail-page load, so the exposure widens from "offline only" to
   "every visit".
   Reachability is narrow, and this is deliberately not rated higher for that reason: the lists
   callback applies a cached list only when its id equals the current `listId`, so nothing from
   the overview leaks, and a second account on the same browser profile sees another account's
   cached title and entries only if it navigates directly to a list URL it has no access to. When
   both accounts legitimately share the list, showing cached content is the intended feature, not
   a leak. The window is also self-correcting — measured at 257 ms locally, and the access-denied
   path was confirmed to clear the cached view entirely (see Verification).
   Cheap remedies exist — fold the account id into `createCacheKey`, or clear cached resources on
   logout. Recommend routing this to the planner as its own task rather than expanding T-003.

2. `nit` — `frontend/src/pages/ListDetailPage/useListDetailData.ts:410` — not a required fix.
   The entries cache callback calls
   `setRecentlyUsed((current) => filterRecentlyUsedItems(current, nextEntries))`, but `current` is
   always `[]` at that point: the effect sets `setRecentlyUsed([])` synchronously before the
   awaits, and the only other writer is the history branch, which runs after `Promise.all`
   resolves and therefore after the callback is already suppressed. The call is a harmless
   defensive no-op; a short comment saying so, or dropping it, would save the next reader the
   trace.

#### Required Fixes

None.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS (pre-existing chunk-size warning).
- `npx vitest run --environment jsdom` (frontend) — PASS 605/605 across 41 files, exit 0.
- `npm test --workspace backend` — PASS 174/174. Total 779, matching the handoff.
- `node node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json` — the same three
  pre-existing errors established as baseline during the T-002 review, and no new ones.
- Real-browser verification against `vite preview` of the production build on port 4318, using a
  persistent browser context so the change is exercised against real IndexedDB rather than the
  mocked `offlineStore` the unit tests use, with the service worker blocked and the `/api/lists`
  and `/entries` responses held to open a measurable window.
- A second browser run covering revoked access against a populated cache.
- Source review of the diff, plus a trace of the ordering guarantee through `sendJsonRequest`, and
  of `createCacheKey`, `logout` and the `offlineStore` exports for finding 1.

##### Findings

- Criterion "entries render as soon as the cache read completes, without waiting for the network
  and with no spinner over cached content" — PASS. With the list and entries responses held for
  6 s, the cached entry and the cached list title were on screen **257 ms** after navigation, with
  zero `LoadingState` elements present and no fresh content yet.
- Criterion "then get replaced by the server payload" — PASS. The fresh entry appeared at 6227 ms,
  the cached entry count dropped to 0 and the list title switched from the cached to the fresh
  name.
- Criterion "cached value never applied after the network response" — PASS, by double guard and
  by test. `sendJsonRequest` sets `networkSettled = true` immediately after `requestJson` resolves
  — before the `await writeCachedResource(...)` — and in the catch, so a late cache read is
  suppressed during persistence and on error; the hook adds its own `networkFinished` guard for
  the aggregate `Promise.all`. Because each request's own flag settles strictly before
  `Promise.all` resolves, a cache callback cannot fire after its network payload has been applied.
  `client.test.ts` pins every branch of this: late cache after success, cache landing during
  persistence, 401 and 403, a null cache, and a rejecting cache read.
- Criterion "existing offline fallback unchanged" — PASS, verified in the browser rather than only
  by test: with requests aborted as `internetdisconnected`, the page still rendered the offline
  banner and the last cached list and entry. The client test also pins the `offline: true` marker
  with the callback enabled.
- Criterion "pending-entry merge unchanged" — PASS, and strengthened. The initial load now runs
  the network result through `mergePendingEntries` and the `locallyDoneIdsRef` mapping, which it
  previously did not. That is required, not incidental: cached content is interactive before the
  network lands, so an entry queued or completed during that window would otherwise be discarded
  by the server payload. The two tests covering it — a queued entry surviving the replacement with
  its details and "Queued" badge while being filtered out of Recently Used, and a Done badge
  surviving a completion made before the initial read settles — both fail to exist in the old
  design because the window did not exist.
- Cache miss behaves as before: a clean context showed the loading indicator until the held
  responses arrived, consistent with the amended criterion that a loading frame before the cache
  read completes is acceptable.
- Revoked access correctly overrides the cached render — the most important safety property here.
  With a populated cache and `/api/lists` no longer returning the list, the browser showed the
  cached entry while the response was held, then cleared both the entry and the cached title and
  displayed "You no longer have access to this list." The T-002 access-error behaviour is intact
  on top of cache-first rendering.
- The `active` flag replacing `isMountedRef` inside the load effect is a real improvement, not
  churn: `isMountedRef` only tracked mount, so a superseded run could still write state after the
  effect re-ran for a new `listId`, `token` or `syncVersion`. The cleanup now invalidates the
  previous run, and the cache callbacks check it too. The stale-load test covers this.
- The new `entriesScopeRef` clear is necessary rather than defensive. Without it,
  `mergePendingEntries(cached.entries, entriesRef.current)` would carry the previous route's
  queued entries into the next list, since `entriesRef` survives a `listId` change. It keys on
  both `listId` and `token`, so it also covers a re-login. It does change what the user sees while
  navigating between two lists — an immediate clear instead of the previous list's entries
  lingering — which is the correct trade and is covered by the `renderHook` route-change test.
- `readCachedResource` is only called when a caller opts in: the client test asserts no cache read
  for a plain GET or a write, so the overview page and every other GET are untouched and no extra
  IndexedDB work was added to them.
- Documentation rule satisfied. The rewritten `README.md` bullet covers cache-first reading, the
  replacement preserving queued additions and completion badges, the ordering guarantee, the
  cache-miss loading state, the unchanged offline fallback and the access-error clear. The comment
  in `client.ts` states the ordering guarantee including the persistence window, and the hook
  carries comments for the scope reset and the merge.

##### Risks

- Finding 1 is the one worth tracking. It is not a defect in this diff, but this diff is what
  makes an unscoped cache visible during normal online use.
- Route-to-route navigation between two lists was verified at hook level through `renderHook`
  rather than by clicking through the running app, because the UI path runs via the overview. The
  hook test exercises the same `listId` change the router produces.
- The browser runs blocked the service worker so request timing and counting stay meaningful, so a
  real service-worker-served visit was not measured. Unchanged trade-off from T-002.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs and a live-backend pass
  could not run.
- Cache-first rendering means a user can now briefly act on stale content — toggling or editing an
  entry that the server has already changed. The merge and `locallyDoneIdsRef` handling cover the
  local-write case, and the server response still wins, but the window is new. ROADMAP records an
  open decision on a "stale data" indicator; nothing here forecloses it.

#### Verdict

`PASS_WITH_NOTES`

## Task: T-004

### Review Round 1

Status: **complete**

Reviewed: 2026-09-21

Scope: working-tree changes to `OfflineQueueContext.tsx`, `request.ts`, `OfflineQueueContext.test.tsx`
and `README.md`, against PLAN.md Phase 4.

The primary criterion is met and the queue path is intact. Review fails on a regression to the
third criterion, "offline banner and recovery behaviour unchanged", demonstrated by a before/after
build comparison rather than inferred.

#### Findings

1. `blocker` — `frontend/src/api/request.ts:33` — required fix.
   The offline banner no longer appears when the backend is unreachable while the browser still
   reports itself online. Demonstrated by building and running both revisions against the same
   scenario — every `/api/*` request aborted with `connectionrefused`, `navigator.onLine` true,
   empty queue:

   | Build | `/api/health` probes | "Offline mode" banner |
   | --- | --- | --- |
   | HEAD (before T-004) | 1 | present |
   | working tree (T-004) | 0 | **absent** |

   The mechanism: `reportRequestOutcome("network-error")` only sets `stale`, never
   `isOnline = false` (`connectivity.ts:45`), and the banner renders on `getIsOnline() === false`
   (`OfflineQueueContext.tsx:137`). Publishing `false` requires a probe. Removing the mount probe
   therefore removes the only thing that published it, and the compensating probe added to
   `request.ts` is gated on `navigator.onLine === false`, which is exactly the case this scenario
   is not. A backend restart, a captive portal, a dropped VPN or a DNS failure all leave
   `navigator.onLine` true, so this is the common shape of the problem the banner exists for —
   the `navigator.onLine === false` case is the one the browser already signals clearly.
   The user is not left with nothing: the detail page still shows "Offline list data is
   unavailable." from the per-response fallback. But the app's global connectivity indicator is
   gone in the scenario where it is most useful, so this is a behaviour regression against a
   stated acceptance criterion, not a cosmetic one.

   Recovery is affected in the same way and for the same reason: once `isOnline === false` has
   been published, an `online` event with an empty queue now returns early before
   `ensureFreshState`, so the banner clears only when a real request happens to succeed or SSE
   reopens, rather than on the event itself.

   Two shapes of fix, both inside T-004's own files and neither needing the planner. They are
   offered as analysis, not a prescription — the implementer should pick:
   - Drop the `navigator.onLine === false` gate in `request.ts`, so any network-errored request
     refreshes reachability. `probeReachability` already dedupes in-flight calls and rate-limits
     to one per `REACHABILITY_PROBE_MIN_INTERVAL_MS`, so the cost stays bounded, and a healthy
     load has no failed request to trigger it — criterion 1 was measured at 0 probes on a healthy
     load and would stay there.
   - And for the recovery direction, let `checkAndDrain` skip the probe only while reachability is
     not already known to be false — for example gate the empty-queue early return on
     `getIsOnline() !== false` — so a known-offline app still re-probes on `online`, `focus`,
     `pageshow` and `visibilitychange`, while a healthy startup still probes zero times.

2. `major` — `frontend/src/api/request.ts:30` — required fix.
   The new `request.ts` behaviour ships with no test at all. There is no `request.test.ts`, and no
   existing suite asserts either that a network-errored request triggers `probeReachability()`
   when `navigator.onLine === false`, or that it does not when `navigator.onLine` is true. That
   gate is the entire compensation for removing the mount probe, and it is the code finding 1
   shows is wrong — an untested branch that is load-bearing for an acceptance criterion. AGENTS.md
   requires tests for each changed behaviour, written before the implementation. Whatever shape
   finding 1's fix takes, it needs coverage that pins the banner outcome, ideally at the
   `OfflineQueueContext` level where `isOffline` is observable, so the assertion is about
   behaviour rather than about which function was called.

3. `nit` — `frontend/src/api/request.ts:33` — not a required fix, and it disappears if finding 1
   is fixed by dropping the gate.
   `typeof navigator === "undefined" || navigator.onLine === false` probes when `navigator` is
   absent. Harmless in practice, but it means a non-browser environment takes the probe path for a
   reason unrelated to reachability.

#### Required Fixes

1. Restore the offline banner when the backend is unreachable while `navigator.onLine` is true,
   and restore probe-on-recovery for a known-offline app, without reintroducing the empty-queue
   startup probe (finding 1).
2. Add test coverage for the reachability-refresh behaviour in `request.ts` and for the banner
   outcome in both connectivity scenarios (finding 2).

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS.
- `npx vitest run --environment jsdom` (frontend) — PASS 606/606 across 41 files, exit 0.
- Backend tests were not re-run for this task: no backend file is touched, and the suite passed at
  174/174 in the T-003 review on the same backend tree.
- Real-browser scenarios against `vite preview` of the production build on port 4318, with the
  service worker and the SSE endpoint blocked so probe counting is unambiguous, counting
  `/api/health` through `page.on("request")` rather than through the route handler so that
  requests failing below the routing layer are still counted.
- Before/after comparison for finding 1: the three changed source files were stashed, the frontend
  rebuilt, the same scenario re-run against the baseline, then the stash popped and the frontend
  rebuilt again. Working tree confirmed restored.
- Source review of the diff, and a trace of `reportRequestOutcome`, `probeReachability`,
  `ensureFreshState`, `getIsOnline` and the `isOffline` consumers.

##### Findings

- Criterion "no `/api/health` request on mount with an empty queue" — PASS. A healthy load of
  `/lists/<id>` with an empty queue issued **0** `/api/health` requests, measured over a 4 s settle
  after network idle. This is the point of the task and it works.
- Criterion "a queued mutation still probes, drains, and retries" — PASS, verified end to end in
  the browser without reloading the page: going offline and marking an entry done queued the
  write, triggered exactly **1** probe, and showed "Offline mode: 1 change waiting to sync."
  Restoring connectivity and firing the `online` event triggered **1** further probe, drained the
  queue, cleared the banner and restored the entry from the server response.
- Criterion "offline banner and recovery behaviour unchanged" — **FAIL**. See finding 1 and the
  before/after table.
- The `OfflineQueueContext.tsx` change itself is exactly what PLAN.md Phase 4 asked for and is
  correctly written: the queue is read before `ensureFreshState`, and the early return re-checks
  `mountedRef`, the generation, `activeRun` and `blockedRef` after the await, so the generation
  guard semantics survive the new suspension point. Retry scheduling for the non-empty case is
  untouched. Had the change stopped there, the only gap would be the banner, which is what
  `request.ts` was reaching for.
- The test adaptations are legitimate and do not weaken anything. Moving
  `currentMutations = [createMutation()]` above the render in the parametrised wake-event test is
  required now that an empty queue no longer probes at mount; the test still asserts offline
  detection and then a drain on each of the six events. The extra `listOfflineMutations` mock in
  the stalled-read test matches the new read, and the added
  `waitFor(fetchMock).toHaveBeenCalledWith("/api/health", …)` in the unmount test makes that test
  stricter, not looser. The new "does not probe reachability on mount when the queue is empty"
  test directly covers criterion 1.
- `README.md` is accurate for the shipped `OfflineQueueContext` behaviour and correctly states
  that an empty queue does not trigger a startup probe. Its sentence "A failed real request also
  refreshes the shared reachability state so the offline banner remains accurate" overstates what
  ships, since the refresh only happens when `navigator.onLine` is false; it should be revised
  alongside finding 1 so the documentation and the behaviour agree.
- Probe volume from the new `request.ts` path is bounded: `probeReachability` returns the in-flight
  promise when one exists and otherwise short-circuits within
  `REACHABILITY_PROBE_MIN_INTERVAL_MS`, so a burst of failing requests cannot produce a probe
  storm. This remains true if the gate is dropped.

##### Risks

- The scenarios blocked the service worker and `/api/events`. Blocking SSE is deliberate and
  material here: an open stream calls `confirmOnline()` and would mask exactly the state
  transitions under test. In production a list page with a live stream will often recover the
  banner on its own, which narrows but does not remove finding 1 — the stream is lost in the same
  situations that make the backend unreachable, and pages without a stream have no such recovery.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs and a live-backend pass
  could not run.
- The before/after comparison required rebuilding the frontend twice. The working tree was
  confirmed byte-identical to its pre-comparison state afterwards, and no committed file was
  touched.

#### Verdict

`FAIL`

### Review Round 2

Status: **complete**

Reviewed: 2026-09-21

Scope: the rework of `OfflineQueueContext.tsx`, `request.ts` and `OfflineQueueContext.test.tsx`
against Round 1's two required fixes.

Both Round 1 required fixes are genuinely resolved and were re-measured, not assumed. Review fails
on one residual instance of the same acceptance criterion, found by continuing to test that
criterion rather than stopping at the two scenarios Round 1 happened to use.

#### Findings

1. `major` — `frontend/src/api/request.ts:33` — required fix.
   The reachability refresh is now gated on `error instanceof TypeError || error.message ===
   "Failed to fetch"`, which excludes the `AbortError` / `TimeoutError` half of
   `isNetworkError` (`request.ts:4`). So a backend that accepts connections but never answers —
   requests hitting the 10 s deadline instead of being refused — still produces no probe and no
   offline banner. Measured both ways against the same scenario, every `/api/*` request accepted
   and left unanswered, `navigator.onLine` true, empty queue:

   | Build | `/api/health` probes | "Offline mode" banner |
   | --- | --- | --- |
   | HEAD (before T-004) | 1 | present |
   | working tree (rework) | 0 | **absent** |

   This is the same criterion and the same mechanism as Round 1 finding 1, with a different
   trigger: a hung or overloaded backend rather than a refused connection. It is narrower than the
   Round 1 case and the user still sees "Offline list data is unavailable." on the page, which is
   why it is `major` rather than `blocker`.

   The exclusion is not arbitrary and should not simply be deleted. `isNetworkError` conflates two
   very different aborts: the request's own 10 s deadline, which is real evidence of
   unreachability, and a `parentSignal` cancellation from the drain or from unmount, which is
   deliberate and must not trigger a probe — the unmount test exists to guard exactly that, and
   `requestJson` wires `parentSignal` to `deadline.abort`, so a parent cancellation also shows up
   as a deadline abort. The discriminator is already in scope at the catch site: probe when the
   deadline fired and the parent did not cancel, for example
   `deadline.signal.aborted && !parentSignal?.aborted`. That keeps the unmount and drain-cancel
   behaviour the current gate was protecting while restoring the banner for a hung backend.

   If the timeout case is deliberately out of scope, that is a legitimate call — but it belongs to
   the planner as a narrowing of "offline banner and recovery behaviour unchanged", not to a gate
   whose stated reason is probe-timer hygiene.

2. `nit` — `README.md:287` — not a required fix.
   "A failed real request also refreshes the shared reachability state so the offline banner
   remains accurate" is now true for refused connections and false for timeouts. Whatever shape
   finding 1's fix takes, this sentence should end up matching it.

#### Required Fixes

1. Refresh reachability after a request that fails on its own deadline, while continuing to
   ignore deliberate `parentSignal` cancellations, and cover it with a test that asserts the
   banner outcome (finding 1).

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS.
- `npx vitest run --environment jsdom` (frontend) — PASS 608/608 across 41 files, exit 0.
- Backend tests not re-run: no backend file is touched.
- Four real-browser scenarios against `vite preview` of the production build, service worker and
  `/api/events` blocked, `/api/health` counted through `page.on("request")`.
- Queued-mutation path re-run in the browser, because `checkAndDrain` changed again in this round.
- Before/after comparison for finding 1: `request.ts` and `OfflineQueueContext.tsx` stashed, the
  frontend rebuilt, the hung-backend scenario run against the baseline, then the stash popped and
  the frontend rebuilt again. Working tree confirmed restored.

##### Findings

- Round 1 finding 1 — **resolved**. With every `/api/*` request refused, `navigator.onLine` true
  and an empty queue, the reworked build issues 1 probe and renders "Offline mode: cached data is
  available.", identical to the HEAD baseline that Round 1 recorded. The scenario that failed
  review now matches the behaviour it regressed from.
- Recovery — **resolved**, and this is the part the new `getIsOnline() !== false` condition adds.
  From a known-offline state with an **empty** queue, an `online` event now issues 1 probe and
  clears the banner. Round 1's concern that recovery would wait for an incidental successful
  request no longer applies.
- Criterion "no `/api/health` on mount with an empty queue" — still PASS, 0 probes on a healthy
  load over a 4 s settle after network idle. The new condition is correctly ordered: reachability
  that is unknown (`null`) or `true` still skips the probe, so the task's actual objective is
  intact and did not regress while fixing the banner.
- Criterion "a queued mutation still probes, drains, and retries" — re-verified end to end after
  the `checkAndDrain` change: an offline write queued, 1 probe, "Offline mode: 1 change waiting to
  sync."; restoring connectivity and firing `online` gave 1 further probe, a drained queue, a
  cleared banner and the entry restored from the server.
- Criterion "offline banner and recovery behaviour unchanged" — **FAIL** for the timeout trigger
  only. See finding 1.
- Round 1 finding 2 — **resolved**. The rework adds two behaviour-level tests that pin the
  outcomes rather than the call: "shows the offline state after a real request fails while the
  browser is online" drives a real `requestJson` failure and asserts `is-offline` becomes true
  with `/api/health` called, and "re-probes a known offline state on recovery events with an empty
  queue" asserts the banner clears after `online` with the queue emptied and counts two health
  calls. Both assert on `isOffline`, which is what the user sees. They would have failed against
  the Round 1 code.
- The `OfflineQueueContext.tsx` guard sequence remains correct after the second edit: the post-await
  re-check of `mountedRef`, generation, `activeRun` and `blockedRef` is unchanged, and the new
  `pending.length === 0 && getIsOnline() !== false` test is a pure addition after it.
- No test was weakened in this round. The Round 1 adaptations stand, and the additions are new
  cases.

##### Risks

- Blocking SSE in the scenarios is deliberate: an open stream calls `confirmOnline()` and would
  mask the transitions under test. In production, a list page with a live stream recovers the
  banner on its own, which narrows finding 1's practical impact further — though the stream is
  lost in the same situations that make the backend unreachable.
- The hung-backend scenario needed a 25 s settle to clear the 10 s request deadline plus the 5 s
  probe deadline. Both builds were given the same budget.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs and a live-backend pass
  could not run.
- The comparison rebuilt the frontend twice via `git stash`. The working tree was confirmed
  restored afterwards and no committed file was touched.

#### Verdict

`FAIL`

### Review Round 3

Status: **complete**

Reviewed: 2026-09-22

Scope: the rework of `request.ts` against Round 2's single required fix, plus a re-run of every
scenario from Rounds 1 and 2 and a cross-task regression check, since `request.ts` is on the path
of every API call in the app.

#### Findings

None.

#### Required Fixes

None.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS.
- `npx vitest run --environment jsdom` (frontend) — PASS 609/609 across 41 files, exit 0.
- Backend tests not re-run: no backend file is touched.
- All four connectivity scenarios re-run in the browser against `vite preview` of the production
  build — healthy, refused, recovery from known-offline with an empty queue, and hung backend —
  with the service worker and `/api/events` blocked and `/api/health` counted through
  `page.on("request")`.
- Queued-mutation path re-run end to end, because `request.ts` now probes on deadline aborts and
  the drain cancels through `parentSignal`.
- T-003's cache-first scenarios re-run as a cross-task regression check.
- Source review of the new condition and its interaction with `parentSignal`, `deadline`, the
  drain abort and the unmount path.

##### Findings

- Round 2 finding 1 — **resolved**. The fix is the discriminator the review identified:
  `deadline.signal.aborted && !parentSignal?.aborted`. With every `/api/*` request accepted and
  left unanswered, `navigator.onLine` true and an empty queue, the build now issues 1 probe and
  renders "Offline mode: cached data is available.", matching the HEAD baseline measured in
  Round 2. The timeout trigger and the refused trigger now behave identically.
- The exclusion that made Round 2 fail is preserved where it was correct. A `parentSignal`
  cancellation — unmount, or the drain's abort — still suppresses the probe, because
  `requestJson` wires `parentSignal` to `deadline.abort` and the new condition requires the parent
  *not* to have aborted. The unmount test that guards a probe timer surviving teardown still
  passes, and the queued-mutation run showed no spurious probe around drain cancellation.
- Criterion "no `/api/health` on mount with an empty queue" — PASS, still 0 probes on a healthy
  load over a 4 s settle after network idle. Three rounds of fixes to the banner have not eroded
  the task's actual objective.
- Criterion "a queued mutation still probes, drains, and retries" — PASS, re-verified after this
  round's change: offline write queued, 1 probe, "Offline mode: 1 change waiting to sync.";
  restoring connectivity and firing `online` gave 1 further probe, a drained queue, a cleared
  banner and the entry restored from the server.
- Criterion "offline banner and recovery behaviour unchanged" — PASS. All four scenarios now match
  the pre-T-004 baseline: refused 1 probe with banner, hung 1 probe with banner, recovery from
  known-offline clears the banner on the `online` event with an empty queue, healthy 0 probes and
  no banner.
- Probe volume stays bounded under the widened trigger. The hung-backend run issued exactly 1
  probe across 25 s despite several requests reaching their deadlines, confirming that
  `probeReachability`'s in-flight dedupe and minimum interval absorb the new call site rather than
  multiplying it.
- Cross-task check: T-003's behaviour is unaffected by the shared-path change. Cached entries and
  title rendered at 367 ms with no spinner while the network was held, the server payload replaced
  them at 6296 ms, the offline fallback still produced its banner and cached content, and a cache
  miss still showed the loading state until the network answered.
- The new test "shows the offline state after a real request reaches its deadline" pins exactly the
  Round 2 finding, at the observable level — it drives a real `requestJson` with a 1 ms deadline and
  asserts `is-offline` becomes true with `/api/health` called. Together with the two tests added in
  Round 2, all three connectivity outcomes are now covered by behaviour assertions rather than by
  call spying.
- The `client.test.ts` adjustment is a legitimate adaptation, not a weakening: the hanging-read
  test now answers `/api/health` with a 503 because a deadline abort legitimately triggers a probe.
  Its assertions about aborting at ten seconds and returning cached data are unchanged, and the
  fallback still wins independently of the probe, which runs detached.
- `README.md` is now accurate. The sentence "A failed real request also refreshes the shared
  reachability state so the offline banner remains accurate" holds for both refused connections and
  timeouts, and the parent-cancellation exclusion is an internal detail with no user-facing
  behaviour to document. The Round 2 nit is resolved.

##### Risks

- Blocking SSE in the scenarios is deliberate, since an open stream calls `confirmOnline()` and
  would mask the transitions under test. Production behaviour on a list page with a live stream is
  therefore at least as good as measured here.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs and a live-backend pass
  could not run. Unchanged across this cycle.
- Widening the probe trigger to deadline aborts means a genuinely slow-but-working connection can
  now cost one extra `/api/health` request per five-second window while requests are timing out.
  Measured at 1 probe per 25 s in the hung case, and the probe is small and cache-busting by
  design, so this is a fair trade for an accurate banner.

#### Verdict

`PASS`
