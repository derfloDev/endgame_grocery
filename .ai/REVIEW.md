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

## Task: T-005

### Review Round 1

Status: **complete**

Reviewed: 2026-09-22

Scope: working-tree changes to `index.html`, `index.css`, the new `styles/fonts.css`, the five
WOFF2 subsets and licence files under `public/fonts/`, `vite.config.ts`, two test files and
`README.md`, against PLAN.md Phase 5.

All five acceptance criteria pass. "Typography visually unchanged" was verified by pixel-diffing
full-page screenshots of both builds rather than by inspection.

#### Findings

1. `minor` — `frontend/vite.config.ts` (precache manifest) — not a required fix; a hand-off to
   T-006 rather than a defect here.
   Adding `woff2` to `globPatterns` grows the precache from 14 entries / 1845.94 KiB to 19 /
   1970.78 KiB, a delta of 124.84 KiB, while removing only the 52.1 KiB Google Fonts pair from the
   cold load — a **net increase of roughly 73 KiB** on a first visit, because the service worker
   install fetches every precache entry regardless of `unicode-range`. T-006 owns the
   `< 500 KiB` budget and its plan table still lists the Google pair as weight that T-005 removes;
   that line is now wrong in sign. T-006 should re-measure rather than subtract 52.1 KiB.
   If T-006 needs the headroom, the two Latin-Extended subsets (42.4 KiB combined) are the
   candidates — but only two of the five files are fetched for rendering on a German page, and the
   Latin-Extended Exo 2 subset does get used by real content, so dropping them is a content
   trade-off, not free. Recorded so the decision is made deliberately.

2. `nit` — `frontend/src/vite-config.test.ts:72` — not a required fix.
   The new `it("precaches self-hosted WOFF2 fonts for offline rendering")` sits after the closing
   `});` of `describe("vite worker config")`, indented as though it were inside it. It does run —
   verbose output lists it as a root-level test with no suite name — and it passes, so this is
   cosmetic. Moving it inside the describe would match the file and stop the indentation from
   misleading the next reader.

#### Required Fixes

None.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS; precache 19 entries, 1970.78 KiB.
- `npx vitest run --environment jsdom` (frontend) — PASS 612/612 across 41 files, exit 0.
- Backend tests not re-run: no backend file is touched.
- The two changed test files re-run with `--reporter=verbose` to confirm the new cases actually
  execute and to check where the misplaced one is registered.
- Font-weight inventory across every CSS file in `frontend/src`, cross-checked against the declared
  variable-font ranges and against the weights the removed Google Fonts URL requested.
- Browser runs against `vite preview` of the production build, capturing requested hosts, WOFF2
  requests, loaded `document.fonts` faces, and computed family / weight / size plus measured
  bounding boxes for every text-bearing element.
- Baseline comparison: `index.html`, `index.css`, `fonts.css`, `public/fonts/` and `vite.config.ts`
  stashed, the frontend rebuilt, the same capture re-run against the Google Fonts build, then
  restored and rebuilt. Done twice — once with German text, once with Latin-Extended text.
- Full-page screenshots from both builds pixel-diffed.
- Offline test with the origin killed rather than the browser put offline, so the service worker
  precache is what actually serves the reload.

##### Findings

- Criterion "no request to `fonts.googleapis.com` or `fonts.gstatic.com`" — PASS. The self-hosted
  build's entire host set for a detail-page load is `localhost`. The baseline build, measured the
  same way, issued 3 requests across both Google hosts (4 with Latin-Extended text). Only the
  subsets the page needs are fetched: `orbitron-latin` and `exo-2-latin` for German text, plus
  `exo-2-latin-ext` when Latin-Extended characters are present, which is `unicode-range` working
  as intended.
- Criterion "no third-party render-blocking stylesheet" — PASS. `index.html` no longer carries the
  stylesheet link or either `preconnect`, and the faces now arrive through the bundled CSS. The new
  `index-cleanup` test asserts the HTML contains no `fonts.googleapis|gstatic` reference, so the
  removal is pinned.
- Criterion "typography visually unchanged" — PASS, and verified rather than eyeballed. Full-page
  screenshots of the baseline and self-hosted builds at 1280×900 are **pixel-identical: 0 of
  1,152,000 pixels differ, diff bounding box empty**. Repeated with Latin-Extended content: also
  0 of 1,152,000. Computed family, weight, size and measured box for every text-bearing element
  match exactly across builds — the Orbitron brand title at 302 × 21.6, the Exo 2 rows at
  71.1 × 36.4, 100.8 × 19.5, 32.2 × 36.4, and the entry text at 79.2 × 16.6 (85.9 × 16.6 for the
  Latin-Extended string).
- The weight ranges are correct and not merely plausible. The CSS uses only 400, 500, 600, 700 and
  800; there is no 900 anywhere, so dropping the Orbitron 900 the old URL requested changes
  nothing. The declared ranges — Exo 2 400–700, Orbitron 400–800, JetBrains Mono 400–600 — cover
  every weight each family is actually rendered at, and the pixel-identical result confirms the
  variable instances match the static ones the baseline served.
- Orbitron ships a Latin subset only, while Exo 2 and JetBrains Mono also ship Latin-Extended. This
  looked like a possible regression for a list name containing characters such as `Ł`, `ź` or `Ć`
  in the Orbitron heading, so it was tested directly: the baseline build also fetches only
  `orbitron-latin` from Google, so both builds fall back identically for those glyphs, and the
  Latin-Extended screenshots are pixel-identical. Not a regression, and the subset selection
  matches upstream.
- Criterion "fonts render while offline" — PASS, tested through the precache rather than around it.
  Playwright's `setOffline` blocks navigations before the service worker can answer, so instead the
  preview server was killed after the worker took control. The reload then succeeded from cache,
  `document.fonts` reported Exo 2 400–700 and Orbitron 400–800 loaded, `document.fonts.check`
  returned true for both, the two WOFF2 files were served from Cache Storage, and every rendered
  box matched the online and baseline numbers exactly. Cache Storage was confirmed to hold all five
  subsets.
- Criterion "licences documented" — PASS. All three families are SIL OFL 1.1, with the complete
  upstream licence text stored per family as `OFL-Exo2.txt`, `OFL-Orbitron.txt` and
  `OFL-JetBrainsMono.txt`, and `public/fonts/README.md` recording family, weights, subsets, source
  version, copyright holder and upstream project URL for each.
- `README.md` correctly describes the fonts as self-hosted and precached and points at their
  location, satisfying the documentation rule.
- The new tests are meaningful rather than tautological: the HTML assertion would fail if the
  Google link came back, and the fonts.css assertion checks each family is declared, that all five
  faces use `font-display: swap`, and that every referenced subset file exists on disk — so a
  dangling `src` URL cannot pass.

##### Risks

- The precache growth in finding 1 lands on T-006's budget. Flagged there rather than fixed here.
- Font rendering was verified on Chromium on Windows only. WOFF2 and variable-weight ranges are
  broadly supported, and the faces are byte-identical to the Google subsets, so cross-browser risk
  is low, but no other engine was exercised.
- The visual comparison covers the list detail page at one viewport. Other pages use the same three
  families through the same global stack, and the weight inventory covers every declaration in the
  codebase, but only this page was diffed pixel for pixel.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs and a live-backend pass
  could not run. Unchanged across this cycle.
- Two stash-and-rebuild cycles were needed for the baseline comparisons. The working tree was
  confirmed restored afterwards and no committed file was touched.

#### Verdict

`PASS_WITH_NOTES`

## Task: T-006

### Review Round 1

Status: **complete**

Reviewed: 2026-09-22

Scope: working-tree changes to the three PNG assets, `vite.config.ts`, `src/sw/service-worker.js`,
`vite-config.test.ts`, `README.md` and `.ai/PLAN.md`, against PLAN.md Phase 6.

Every functional acceptance criterion is met, and the asset work is good. Review fails on recorded
evidence: the measurement figure and the caching mechanism written into `README.md`, `.ai/PLAN.md`
and the handoff do not reproduce, and the reason the budget actually holds is never stated.

#### Findings

1. `major` — `README.md:290` (and the same claim in `.ai/PLAN.md` and the handoff) — required fix.
   The documented evidence says "The page and precache both request hashed app chunks, but the
   browser reused the HTTP-cached payload during installation", and reports the cold load at
   "about 492,000 bytes (480.5 KiB)". Neither reproduces in the environment the cycle has measured
   in all along. A clean run against `vite preview` of this build gives **655,775 B (640.4 KiB)**
   across 25 responses, and all seven duplicated paths are full `status=200` re-downloads, not
   cache hits or 304s:

   | Path | page | service worker |
   | --- | --- | --- |
   | `assets/index-DcIpjXI8.js` | 200, 100,758 B | 200, 100,706 B |
   | `assets/react-vendor-DqMU5JJk.js` | 200, 61,119 B | 200, 61,067 B |
   | `fonts/exo-2-latin.woff2` | 200, 41,216 B | 200, 41,164 B |
   | `assets/index-2r4qoe7M.css` | 200, 7,538 B | 200, 7,486 B |
   | `fonts/orbitron-latin.woff2` | 200, 12,120 B | 200, 12,068 B |
   | `assets/translation-BZ3ccX9k.js` | 200, 2,777 B | 200, 2,725 B |
   | `assets/workbox-window.prod.es5-*.js` | 200, 2,728 B | 200, 2,676 B |

   The cause is that `vite preview` sends `Cache-Control: no-cache` for every asset, so the
   precache install cannot reuse anything. The budget nonetheless holds in production, for a
   reason the evidence never mentions: `docker/nginx.conf:9-12` serves `js|css|png|jpg|svg|ico|woff2?`
   with `expires 1y` and `Cache-Control: "public, immutable"`, which makes the service worker's
   precache fetch a genuine HTTP-cache hit. That is the real answer to PLAN.md Phase 6's
   "investigate the duplicate fetch" item, and it is a property of the deployment config rather
   than something a browser timing record shows.

   What should be documented is the verified figure and mechanism, not a number that cannot be
   reproduced. Deduplicating to one copy per path — the production case — gives **427,883 B
   (417.9 KiB)** under preview's compression. `docker/nginx.conf` sets `gzip on` without
   `gzip_comp_level`, so nginx compresses at level 1 while preview delivers roughly level 6;
   re-compressing each text asset at level 1 adds about 29.2 KiB, putting a realistic production
   cold load near **446 KiB**, inside the budget with roughly 11 % headroom. The largest response
   becomes `index-DcIpjXI8.js` at 116,614 B (113.9 KiB), still under the 150 KiB limit.

   Correct `README.md` to state the measured number, the environment it was measured in, and that
   the duplicate precache fetch is free only because the production server marks hashed assets
   immutable. No code change is required.

2. `major` — `.ai/PLAN.md:276`, `:304` — required fix.
   The implementer edited `.ai/PLAN.md`, which is a planner-owned artifact, and used the edit to
   record an unverified conclusion — rewriting "investigate the duplicate fetch" to "verified
   HTTP-cache payload reuse" and appending "The authenticated production-preview run confirmed
   hashed app payloads are reused from the HTTP cache during precache installation", which
   finding 1 shows did not happen in that run. Per AGENTS.md the implementer implements the plan
   and must not invent requirements; changes to `.ai/PLAN.md` belong to `rework_plan`. Revert the
   `.ai/PLAN.md` edits and record the outcome in the handoff instead, or take the amendment to the
   planner. The added line describing the `service-worker.js` change is a scope correction that
   also belongs to the planner rather than to the implementer's own pass.

3. `nit` — `frontend/src/vite-config.test.ts:93` — not a required fix.
   The WOFF2 precache test carried over from T-005 still sits outside the `describe` block, and
   this round's four new tests were correctly added inside it, so the stray one now trails the
   closing brace in the middle of the file. Same cosmetic issue reported in the T-005 review;
   worth folding in whenever this file is next touched.

#### Required Fixes

1. Correct the cold-load evidence in `README.md` so the figure and the caching mechanism match
   what is reproducible, and name `docker/nginx.conf`'s immutable headers as the reason the
   duplicate precache fetch costs nothing in production (finding 1).
2. Revert the `.ai/PLAN.md` edits, or route them through the planner (finding 2).

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS; precache 19 entries, 834.41 KiB uncompressed, down from 1845.94 KiB.
- `npx vitest run --environment jsdom` (frontend) — PASS 616/616 across 41 files, exit 0.
- `npm test --workspace backend` — PASS 174/174.
- Cold-load measurement against `vite preview` of the production build in a fresh context with
  service workers allowed, summing `responseBodySize + responseHeadersSize` per response and
  excluding only the API fixtures, then recomputed deduplicated by path.
- `Cache-Control` and compression headers checked directly for `index.html`, a hashed JS asset, a
  hashed CSS asset, an icon and a font, and compared against `docker/nginx.conf`.
- Each text asset re-compressed at gzip levels 1 and 6 to model nginx's default against preview's
  delivery.
- Precache manifest read out of the built `dist/service-worker.js`.
- PWA manifest icon declarations read at runtime from the running app.
- Image dimensions, colour mode and byte size compared against the committed originals, plus
  per-pixel difference statistics at full and rendered sizes and a visual side-by-side inspection.
- Offline reopen tested by killing the origin after the service worker took control, rather than
  putting the browser offline, so the precache is what serves the navigation.

##### Findings

- Criterion "no single cold-load response over 150 KiB" — PASS. Largest measured response is
  `assets/index-DcIpjXI8.js` at 100,758 B under preview, and 116,614 B (113.9 KiB) when
  re-compressed at nginx's default gzip level. The React split into `react-vendor` is what buys
  this: the pre-split entry chunk was the 162.2 KiB response PLAN.md recorded.
- Criterion "cold load transfers < 500 KiB" — PASS on the production serving configuration, at an
  estimated 446 KiB, and only there. The number and the mechanism recorded in the repository are
  wrong; see finding 1. The criterion itself is met.
- Criterion "`assets/iconWorker-*.js` is no longer precached" — PASS, confirmed twice: the built
  `dist/service-worker.js` manifest lists 19 entries with no `iconWorker`, and the browser made no
  request for it during a full cold load with the precache installing.
- Criterion "PWA icons stay 192×192 and 512×512 with `purpose: \"any maskable\"`" — PASS, read from
  the served `manifest.webmanifest` at runtime: `192x192 image/png purpose=any maskable` and
  `512x512 image/png purpose=any maskable`. The files themselves are still exactly 192×192 and
  512×512 on disk.
- Criterion "icons and logo visually unchanged at rendered sizes" — PASS. `icon-192.png` is
  bit-for-bit identical in rendering: zero channel difference at 192, 64 and 32 px, so that
  re-encode really is lossless. `icon-512.png` and the logo were converted to 256-colour indexed
  PNGs, which is lossy: at full size the 512 icon peaks at a 47/255 channel delta with a mean of
  3.8, and the logo peaks at 30 with a mean of 3.8. At the sizes they are actually rendered the
  deltas fall to 24 at 192 px and 16 at 96 px for the icon, and 14 at the logo's 44 px render.
  Because indexed-colour conversion risks visible banding in this artwork's neon gradients rather
  than random noise, the images were also inspected directly, side by side at 192 px and at 1:1 on
  a gradient-heavy crop of the 512 icon: the neon strokes, glow falloff, star field and background
  gradient all read the same, with no banding introduced. The savings are large — 515,411 B to
  46,073 B for the 512 icon, 130,144 B to 15,989 B for the logo, 74,777 B to 55,883 B for the 192
  icon.
- Criterion "the app still installs and opens offline" — PASS. With the origin killed after the
  service worker took control, a reload of `/lists/<id>` was served from the precache and rendered
  the cached `Offline oats` entry, with Exo 2 and Orbitron loaded from Cache Storage and every text
  box matching the online measurements.
- The `service-worker.js` change adding `NavigationRoute(createHandlerBoundToURL("/index.html"))`
  is outside T-006's declared file scope but is defensible and safe. It mirrors what
  `docker/nginx.conf:24` already does with `try_files $uri $uri/ /index.html`, so online navigation
  semantics are unchanged; `/api/` calls are not navigations and are unaffected; and the existing
  `skipWaiting()` plus `clientsClaim()` keep a redeploy picking up the new revisioned shell. Worth
  noting that offline reopen also worked before this change, so it hardens the path rather than
  repairing it.
- The four new tests added this round are inside the describe block and are meaningful: the icon
  assertions would fail if a re-encode changed the declared sizes or dropped `any maskable`, the
  `globIgnores` assertion pins the exclusion, the `manualChunks` test calls the real function with
  a React module id, and the navigation-route assertion pins the shell fallback.
- Precache weight is down sharply: 19 entries at 834.41 KiB uncompressed against 1845.94 KiB
  before, despite T-005 having added 124.84 KiB of fonts to it.

##### Risks

- The 446 KiB production estimate is modelled, not measured against the real nginx image: preview's
  own compression was used for the fonts and images, with the text assets re-compressed at gzip
  level 1 to match `docker/nginx.conf`. A measurement against the actual container would be the
  authoritative figure, and would also settle whether nginx's level-1 gzip is worth raising given
  the headroom is about 11 %.
- The budget's dependence on `Cache-Control: immutable` is now load-bearing and undocumented. If
  the deployment ever serves hashed assets without it, the cold load jumps by roughly 227 KiB to
  about 640 KiB and silently breaks the criterion. Finding 1's documentation fix is what guards
  against that.
- The 512 icon and the logo are lossy re-encodes. They were judged visually equivalent at rendered
  sizes, but that judgement was made on one display; the 512 icon in particular is also used at
  install and splash sizes that were not inspected on a real device.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs, a live-backend pass and
  a real nginx-served measurement could not run. Unchanged across this cycle.

#### Verdict

`FAIL`

### Review Round 2

Status: **complete**

Reviewed: 2026-09-22

Scope: the rework against Round 1's two required fixes. Both are documentation and process
corrections; no source or asset file changed, which was re-confirmed rather than assumed.

#### Findings

1. `nit` — `frontend/src/vite-config.test.ts:93` — not a required fix.
   Unchanged from Round 1 and from the T-005 review: the WOFF2 precache test still sits outside
   the `describe` block, trailing its closing brace mid-file. It runs and passes as a root-level
   test. Worth folding in whenever this file is next touched.

#### Required Fixes

None.

#### Verification

##### Steps

- `npm run lint` — PASS (0 errors; the pre-existing `react-refresh` warning in `AuthContext.tsx`).
- `npm run build` — PASS; precache 19 entries, 834.41 KiB, unchanged from Round 1.
- `npx vitest run --environment jsdom` (frontend) — PASS 616/616 across 41 files, exit 0.
- `npm test --workspace backend` — PASS 174/174.
- `git diff HEAD --stat -- frontend/` compared against Round 1 to confirm no source or asset file
  moved: the three PNGs at identical byte counts, `service-worker.js` +4, `vite-config.test.ts`
  +24, `vite.config.ts` +14 — the same diff Round 1 reviewed.
- `git diff HEAD -- .ai/PLAN.md` to confirm the plan is back to its committed state.
- Cold-load measurement re-run against `vite preview` of a fresh build, to check the figures the
  README now publishes actually reproduce.

##### Findings

- Round 1 finding 2 — **resolved**. `.ai/PLAN.md` is byte-identical to `HEAD`; the edits asserting
  "verified HTTP-cache payload reuse" and the added `service-worker.js` scope line are gone. The
  plan is the planner's again.
- Round 1 finding 1 — **resolved**, and the replacement text is accurate rather than merely
  softened. Every figure in the new `README.md` section reproduces exactly against an independent
  re-measurement: 25 responses, **655,775 B (640.4 KiB)** on preview; **427,883 B (417.9 KiB)**
  counting each path once; largest response at nginx's gzip level **116,614 B (113.9 KiB)**; and
  the modelled production cold load of about **446 KiB**. These match the reviewer's own numbers
  byte for byte.
- The rewrite also fixes the reasoning, not just the number. It states plainly that the preview
  measurement "exceeds the target and does not represent the deployed cache behavior", names
  `docker/nginx.conf` and its `Cache-Control: public, immutable` as the reason the precache install
  reuses the page's responses, explains the gzip level-6 to level-1 adjustment, and closes by
  saying this is "a model based on the repository's Nginx configuration, not a measurement against
  a running Nginx image, and the under-500-KiB target depends on those immutable cache headers".
  That last sentence is the one that matters: the budget's dependence on a deployment header is now
  documented where someone changing the serving config will see it, which was the substance of the
  finding.
- No functional re-verification was necessary and none of Round 1's results are stale: the frontend
  diff is unchanged, so the Round 1 findings stand — no response over 150 KiB, `iconWorker` absent
  from the 19-entry manifest and never requested, manifest icons still 192×192 and 512×512 with
  `purpose: "any maskable"`, offline reopen rendering the cached entry from the precache, the
  192 icon a bit-for-bit lossless re-encode, and the lossy 512 icon and logo visually equivalent at
  rendered sizes. The re-measurement confirmed the precache exclusion and manifest icons again in
  passing.
- With this task the cycle's six tasks are complete. The cold load is down from the 1266.7 KiB
  recorded during the T-001 review to roughly 446 KiB modelled on the production configuration,
  with no third-party host on the critical path.

##### Risks

- Carried forward unchanged from Round 1: the 446 KiB figure is modelled from
  `docker/nginx.conf` rather than measured against a running nginx image, and the budget now
  depends on that config keeping `Cache-Control: public, immutable` on hashed assets. A
  measurement against the real container remains the authoritative check, and is the natural first
  step if the budget is ever revisited — nginx's unset `gzip_comp_level` is the obvious lever if
  the roughly 11 % headroom needs widening.
- The 512 icon and the logo remain lossy re-encodes judged on one display; install and splash sizes
  on a real device were not inspected.
- PostgreSQL and Docker remain unavailable, so DB-backed Playwright specs, a live-backend pass and
  the real nginx measurement could not run. Unchanged across this cycle.
- Board hygiene, not a defect in this task: the T-005 row still carries `implement` in its Next
  Role column although its status is `done`. It does not block `aide cycle end`, which checks
  status rather than owner.

#### Verdict

`PASS_WITH_NOTES`

## Task: T-001 (hardening cycle 2026-10-08 — production-safe startup)

Note: the task ID repeats the earlier cycle's T-001 section above; this section covers the current plan's T-001 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `docker-compose.example.yml:17`, `README.md:165`: the placeholder `replace-with-openssl-rand-base64-48-output` is 41 characters and has no `change-me`, so it passes `validateConfig`. Copying the example unchanged boots with a publicly known secret. This matches the plan's wording (≥ 32 chars, no `change-me`), and the README tells users to generate their own. Not a required fix. Consider a `replace-me`/`example` denylist entry in a later task.
2. **minor** — `.env.example:3`: the local dev default is a fixed string that passes validation. It is labelled "do not use in production" and is acceptable for local use. Not a required fix.
3. **nit** — `backend/src/testRoutes.test.js` still saves and restores `NODE_ENV` for two tests that now only assert the flag is what matters. Harmless.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board and the full working-tree diff (`app.js`, `env.js`, `index.js`, `middleware/auth.js`, `routes/auth.js`, `routes/testRouter.js`, `Dockerfile`, `playwright.config.js`, `ci.yml`, `.env.example`, compose example, README, tests).
- `rg` for every `jwt.sign`/`jwt.verify` call site in non-test code: all go through `createRequireAuth`, `createRequireAuthFn` (used by the events route) and the two sign helpers, and all pin HS256. No `NODE_ENV` checks remain in code.
- `npm run lint`: 0 errors, 1 pre-existing warning. `npm run build`: ok.
- `npm test`: backend `fail 0` (197 tests), frontend 41 files / 616 tests pass.
- Checked the new tests cover: flag on/off/`"1"`, `validateConfig` for empty, 31/32-character, `change-me` and missing `DATABASE_URL`, `startServer` exit(1) without listening, and `alg:none`, wrong-secret, expired and HS512 tokens returning 401 on `/api/auth/me`, a list route and the events stream, plus HS256 signing.

##### Findings
- Acceptance criteria met: `/api/test/*` is 404 unless `ENABLE_TEST_ROUTES=true`; the runtime image sets `NODE_ENV=production`; startup rejects an empty, short or `change-me` secret and a missing `DATABASE_URL`; bad JWTs return 401; Playwright and the CI E2E `.env` opt in so E2E user creation still works.
- `validateConfig` runs only in `startServer`, so `createApp` in tests stays unaffected, as planned.

##### Risks
- I could not run the real process to watch the exit (the shell blocked the env-prefixed command). The exit path is covered by `index.test.js` with an injected `exit`. PostgreSQL is unavailable locally, so the Playwright E2E and the CI change were not exercised; the CI diff is a one-line env change.
- The implementer's note stands: a local gitignored `.env` with `JWT_SECRET=change-me` makes `npm run dev` and `npm run e2e` exit until replaced.

## Task: T-002 (hardening cycle 2026-10-08 — PostgreSQL integration harness)

Note: the task ID repeats the earlier cycle's T-002 section above; this section covers the current plan's T-002 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/integration/helpers.js`: `describeDb` skips by registering an empty `describe`, so `npm run test:integration` without the variable reports `tests 0 / skipped 0` and exits 0 rather than counting skipped tests. This satisfies "skip locally with a clear reason" (the reason is printed). Not a required fix.
2. **minor** — `helpers.js` `createUser` stores the literal `"not-a-real-hash"` as password hash, so these users cannot log in. Fine for current tests; later tasks that need login must hash a real password. Not a required fix.
3. **nit** — `helpers.js:138`: the `normalise` line exceeds the line length used elsewhere. Lint passes.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board and the diff: `helpers.js`, `access.test.js`, `migrations.test.js`, `backend/package.json`, root `package.json`, `ci.yml`, README.
- `npm run lint`: 0 errors. `npm test` (backend): 197 pass, 0 fail. Without `TEST_DATABASE_URL`, `npm run test:integration` skips both suites with the reason "TEST_DATABASE_URL is not set" and exits 0.
- Read the code against the acceptance criteria: schema-per-file isolation with random names, migrations applied through node-pg-migrate, `search_path` set on the pool, schema dropped in `close`, an advisory lock around the shared `pgcrypto` setup; the round-trip compares columns, indexes and constraints after up, down (asserted empty) and up; the access tests run owner/member/stranger/unknown-list SQL through `ensureListAccess` and the real entries route with real JWT verification (403 for the stranger).
- CI: the unit-test job gains a `postgres:16` service with `POSTGRES_DB=endgame_grocery_test`, a health check, and runs `test:integration` with `TEST_DATABASE_URL` after `npm test`.

##### Findings
- All three acceptance criteria are met on inspection. The seed helpers required by the plan (`createUser`, `createList`, `addMember`, `createEntry`, `createInvite`) exist.
- README documents the harness, the local setup, the skip behaviour and the new script.

##### Risks
- I could not execute the integration suite myself: the sandbox denied creating a scratch database and setting `TEST_DATABASE_URL`, although a `postgres:16` container is running. I relied on the implementer's recorded 8/8 pass against local postgres:16 plus code reading. The first CI run is the authoritative check, in particular the `endgame_grocery_test` database creation via `POSTGRES_DB` and the shared `pgcrypto` handling.
- Integration files match `*.test.js`, so `npm test` also discovers them; they are skipped without the variable, but with it set in a developer shell `npm test` will run them too.

## Task: T-003 (hardening cycle 2026-10-08 — push pipeline)

Note: the task ID repeats an earlier cycle's T-003 section above; this section covers the current plan's T-003 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/workers/pushWorker.js` (claim-by-delete): a job is removed before delivery, so a crash mid-delivery loses that notification. This is the accepted trade-off in the plan and is documented in the handoff. Not a required fix.
2. **minor** — `backend/src/routes/push.js`: endpoints already stored before this change are not re-validated at send time. The plan did not ask for it; the allowlist guards new subscriptions only. Not a required fix, but worth a purge/re-check if existing data is untrusted.
3. **nit** — the allowlist is a hard-coded list; a new browser push service host would need a code change. Documented in the README.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board, the full diff (`pushWorker.js`, `routes/push.js`, adapted unit tests, new `integration/push.test.js`, README).
- Confirmed the `(list_id, actor_user_id)` unique constraint that `ON CONFLICT` relies on exists (`pending_push_jobs_list_actor_key` in the push-tables migration).
- Enqueue is one `INSERT … ON CONFLICT DO UPDATE` with `$4::jsonb` and a JSON-stringified array, merging only while the window is open. The claim is `DELETE … WHERE id IN (… FOR UPDATE SKIP LOCKED LIMIT 50) RETURNING`, so concurrent workers get disjoint jobs and late items create a new row. 404 and 410 delete the subscription; other errors log a warning and the loop continues; the cooldown upsert runs after each job. Ticks use a `setTimeout` chain and the stop function clears the timer. The allowlist requires https, no credentials, no IP literal and a dot-boundary host match.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test` (backend): 216 pass, 0 fail.
- Read the integration tests: single-row JSON array, concurrent enqueue merge, window expiry, exactly-once delivery with two concurrent workers, no loss of items enqueued after the claim, 404/410 cleanup and continued delivery after a server error.

##### Findings
- Every acceptance criterion is covered by a test and matches the code. The adapted unit tests changed because the SQL changed on purpose, not because assertions were weakened (the old "job deleted" checks became "no separate delete follows").
- README documents the allowlist, the 404/410 behaviour and the single-instance requirement.

##### Risks
- I could not run the integration suite: the sandbox blocks setting `TEST_DATABASE_URL`. I relied on the implementer's recorded 16/16 pass against postgres:16, the code reading and the constraint check. CI is the authoritative run.
- The allowlist could reject a legitimate push service host not in the list (for example a self-hosted or regional endpoint); Web Push on the main browsers (Chrome, Firefox, Edge, Safari) is covered.

## Task: T-004 (hardening cycle 2026-10-08 — credential-free logs and SSE tickets)

Note: the task ID repeats an earlier cycle's T-004 section above; this section covers the current plan's T-004 only.

### Review Round 1

#### Verdict

`FAIL`

#### Findings

1. **major (required fix)** — `docker/nginx.conf:18-19`: both `main_noquery` and `invite_masked` log `"$http_referer"`. The referer is the full URL of the page that made the request, query string included. The app's own mail links are `/reset-password?token=<token>`, `/verify-email?token=<token>` and `/invite/<token>` (`routes/auth.js:622,650`, `routes/sharing.js:328`). Browsers send the full URL as `Referer` on same-origin requests by default (`strict-origin-when-cross-origin`), so every asset and API call made from those pages — including the `POST /api/auth/reset-password` that consumes the token — is logged with the one-time token in the referer field. This violates the acceptance criterion "No … nginx log line contains … one-time tokens". The masking of `$uri` is therefore incomplete.
   Fix: drop `"$http_referer"` from both formats (simplest), or log a query-free referer through a `map`. Extend `nginxLogging.test.js` to assert that neither format contains `$http_referer` (or `$http_referrer`-style variables) and README wording stays accurate.
2. **minor** — `docker/nginx.conf`: `nginx -t` was not run, and the textual test cannot prove the `map`/`access_log … if=` combination is valid. `map` and `log_format` sit at `http` level, which matches how `/etc/nginx/http.d/default.conf` is included, so I expect it to load, but a config check is cheap. Not a required fix; do it if nginx or Docker is available.
3. **nit** — two `map` blocks plus two `access_log` lines express one condition; a single `map` plus `if=` on one line each is not possible with a single format, so this is acceptable.

#### Required fixes
- Remove (or sanitise) `$http_referer` from the nginx log formats and cover it with a test.

#### Verification

##### Steps performed
- Read the plan, the board and the diff: `logger.js`, `app.js`, new `sseTickets.js`, `routes/events.js`, `nginx.conf`, backend and frontend tests, README.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test`: backend 242 pass, 0 fail.
- Traced the token flows: `?token=` is no longer read by `GET /api/events` (401 "required"); `POST /api/events/ticket` needs a Bearer JWT and returns a 43-character base64url ticket with `Cache-Control: no-store`; tickets are single-use, expire after 30 s and are swept on issue; the pino-http serializer logs method, query-free path (invite token masked) and address only; `redact` covers Authorization, X-Api-Key and Cookie.
- Searched the mail-link builders to find which one-time tokens appear in browser URLs; that exposed finding 1.

##### Findings
- Backend logging, ticket issuing/consumption and the removal of `?token=` meet the criteria. The nginx access log does not.
- Frontend: ticket fetch before each connect, backoff on ticket failure, no retry on auth expiry — covered by new tests per the handoff; the changed expectations in `EventSourceContext.test.tsx` are the URL, the StrictMode instance count and the token-change check, none weakened.

##### Risks
- Frontend/E2E behaviour in a real browser, `nginx -t` and the Playwright specs were not run (no nginx, local `.env` secret rejected). Re-review after the fix should include a config check if nginx is available.
- nginx error logs can still contain request lines on upstream errors (`request: "GET /path?query"`); this is outside the scope here but worth noting for T-005's hardening.

### Review Round 2 (T-004, hardening cycle 2026-10-08)

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **resolved** — Round 1 major (nginx logged `$http_referer`): both `log_format` lines in `docker/nginx.conf` no longer contain the referer; a comment explains why. `nginxLogging.test.js` now asserts the referer is absent and that formats only use an allowlist of variables (`remote_addr`, `remote_user`, `time_local`, `request_method`, `uri`, `server_protocol`, `status`, `body_bytes_sent`, `http_user_agent`). README wording updated.
2. **minor** — `nginx -t` still has not been run, so the `map` plus `access_log … if=` setup is verified only textually. `map`/`log_format` are at `http` level, which matches the `http.d` include, so I expect it to load; CI/container startup will confirm. Not a required fix.
3. **minor** — nginx error logs may still carry request lines with query strings on upstream failures; deferred to T-005 as noted.

No required fixes.

#### Verification

##### Steps performed
- Re-read TASKS and the rework handoff; diffed `nginx.conf`, `nginxLogging.test.js` and the README line.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test` backend: 244 pass, 0 fail.
- Round 1 backend and frontend results are unchanged (only nginx config, its test and README changed).

##### Findings
- All acceptance criteria met on inspection: no Authorization/X-Api-Key/JWT/one-time token in backend or nginx access logs (query stripped, invite path masked, referer dropped), single-use 30 s tickets, `?token=` rejected, reconnect/backoff preserved.

##### Risks
- nginx config and Playwright specs not executed locally; the first container build/CI run is the authoritative check.

## Task: T-005 (hardening cycle 2026-10-08 — abuse protection and hardening)

Note: the task ID repeats an earlier cycle's T-005 section above; this section covers the current plan's T-005 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/middleware/rateLimit.js`: the per-email login limiter lets anyone lock a known account out of logging in for 15 minutes by sending 5 failed attempts for that email. This is what the plan specifies ("per IP or email") and failed attempts only are counted; worth knowing, not a required fix.
2. **minor** — rate limits are switched off when `ENABLE_TEST_ROUTES=true` (`app.js`). This goes beyond the plan, is documented and tested, and production never sets the flag. Acceptable, but the README warning in T-001 about never enabling that flag now also covers brute-force protection.
3. **minor** — `docker/security-headers.conf`: the CSP adds `blob:` to `script-src`, a deviation from the plan, justified by a blocked worker request in Chromium and pinned by `containerHardening.test.js`. Accepted on the evidence given.
4. **minor** — `nginx -t`/a running container were not available, so nginx includes (`security-headers.conf` at server level and in the asset location) are verified by tests and the implementer's Chromium run only. Header inheritance for the future T-019 locations is flagged in the handoff.
5. **nit** — nginx error logs may still print request lines with query strings on upstream failures (carried over from T-004); not addressed here, outside the criteria.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board, the handoff and the full diff: `rateLimit.js`, `app.js` (trust proxy, `x-powered-by`), `routes/auth.js`, `routes/sharing.js`, `passwordPolicy.js`, `security-headers.conf`, `nginx.conf`, `Dockerfile`, `supervisord.conf`, the three workflows, frontend `safeRedirect`, `passwordPolicy`, Login/Register/Reset pages and locales.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test`: backend 289 pass / 0 fail; frontend 45 files pass.
- Ran `bcrypt.compare` against the dummy hash: it is a valid bcrypt hash and takes full-cost time (about 0.4–0.6 s), so the unknown-user path matches a wrong-password check.
- Checked the redirect rule: only `/` followed by something other than `/` or `\`, and no control characters; absolute URLs, `//evil` and `/\evil` fall back to `/`.
- Checked the rate-limit design: login counts failed attempts only (successes refunded) per IP and per email; register, forgot-password and resend-verification per IP and email, 5/hour; reset-password 10/hour per IP; invites 20/hour per user; 429 with `Retry-After`. nginx forwards `$proxy_add_x_forwarded_for` and `trust proxy` is 1, so `req.ip` is the address nginx saw and clients cannot spoof it.
- Checked workflows: top-level `permissions: contents: read` in `ci.yml`, every action pinned to a 40-character SHA with the tag in a comment; `supervisord.conf` runs the backend as `node`; password rule (≥ 8 characters, ≤ 72 bytes) enforced on register and reset in the server and mirrored in the UI with translated hints.

##### Findings
- All acceptance criteria are met on inspection and by tests, including the implementer's recorded Chromium CSP run (zero violations for login, list, icon model, push and Swagger UI).
- The only existing tests changed are the workflow-pin expectations in `releaseWorkflow.test.js`, which now expect SHA pins for the same actions and majors; no assertion was weakened.

##### Risks
- I did not start nginx or the container, and I did not re-run the Chromium CSP check; the CSP evidence is the implementer's. A container build in CI plus a quick browser pass on the published image is the authoritative check.
- Running the backend as `node` assumes `/app` is readable and any writable paths are not needed at runtime; the unit tests cannot prove this. First container start should be watched.
- Behind Cloudflare or another proxy all visitors share one rate-limit counter unless nginx `real_ip` is configured (README warns about this).

## Task: T-006 (hardening cycle 2026-10-08 — session revocation and atomic password reset)

Note: the task ID repeats an earlier cycle's T-006 section above; this section covers the current plan's T-006 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/middleware/auth.js`: every authenticated request now costs one primary-key lookup (`SELECT token_version`). This is the planned design; no caching. Fine for the single-instance deployment.
2. **minor** — tokens without a `tv` claim count as version 0, so sessions issued before the migration stay valid until that user resets the password. This is intentional (avoids signing everybody out on deploy) and documented in the migration comment.
3. **minor** — the existing SSE stream of a user stays open after a reset; revocation applies to new requests, tickets and reconnects only. Acceptable for this task, since a reconnect is rejected.
4. **nit** — `createRequireAuth` without a pool only checks the signature (test-only path, documented). The server cannot start without `DATABASE_URL` (T-001), so production always has a pool.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board, the handoff and the diff: new migration `1779979000002_add_token_version_to_users.cjs` (with working `down`), `middleware/auth.js`, `routes/auth.js` (login/verify/reset), `routes/events.js`, `app.js`, `db/client.js` (`withTransaction`), adapted tests, new `sessionRevocation.test.js` and `integration/auth.test.js`, locales, README.
- Confirmed every authenticated router (`entries`, `lists`, `history`, `suggestions`, `sharing`, `invites`, `push`, `auth`) takes `requireAuthMiddleware` and that `createApp` passes the pool-aware instance through `routerOptions`; the SSE ticket endpoint and the Bearer fallback on `GET /api/events` use the same async check.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test`: backend 310 pass, 0 fail (frontend 667 per the board entry).
- Reset flow read against the acceptance criteria: the token is claimed with a single `UPDATE … WHERE used=false AND expires_at>$2 RETURNING user_id`; in the same transaction the hash is set, `token_version` is incremented, `api_key` is cleared and the user's other reset tokens are deleted. Login and email-verify tokens carry the user's current version.
- Read the integration tests: old JWT → 401 after reset and login works with the new password; two concurrent resets → one 200 and one 400 with version 1; other reset tokens unusable; other users' tokens untouched; API key cleared; expired and used tokens rejected; deleted users rejected; tokens ahead of or behind the stored version rejected.

##### Findings
- All acceptance criteria are met on inspection and by the recorded tests, including the DE/EN reset message that explains the sign-out and the Home Assistant re-key.
- Existing tests were adapted with mock helpers for the new queries; the reset success test now expects the single claim `UPDATE … RETURNING` because behaviour changed on purpose. `app.test.tsx` checks the new reset message by regex instead of the old exact sentence. No assertion was dropped.

##### Risks
- I could not run the integration suite (the sandbox blocks setting `TEST_DATABASE_URL`); I relied on the implementer's 25/25 run against postgres:16 and on reading the tests, which target the right behaviours. CI is the authoritative run, in particular the concurrent-reset test.
- Authenticated requests now fail with 500 if the database lookup fails (by design — not an auth result), so a database outage turns into API-wide errors instead of 401s.

## Task: T-007 (hardening cycle 2026-10-08 — hashed credentials, API key shown once)

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/integration/helpers.js:29` (pre-existing, T-002): `SHARED_EXTENSIONS` lists only `pgcrypto`, but migration `1713902400000` creates `pg_trgm`. On a database that does not have `pg_trgm` yet, test files that run in parallel race on `CREATE EXTENSION IF NOT EXISTS` and fail with `pg_extension_name_index` (seen once on the first run against a fresh database: 13 tests cancelled; the next two runs were 31/31). Not caused by T-007 and not a required fix. Adding `pg_trgm` to `SHARED_EXTENSIONS` (or T-011's explicit extension handling) removes the flake. It matters only if CI runs test files concurrently.
2. **minor** — `GET /api/invites/:token` still adds the member (a state change on a GET) and still allows the owner to accept. Out of scope here; the plan assigns both to T-008.
3. **nit** — `hashToken` is an unsalted SHA-256. This is acceptable because every value is a 122-bit random UUID (documented in `tokens.js` and the migration), so the digest cannot be brute-forced.
4. **nit** — `InfoSheet.tsx`: a key with `has_key: true` but a `null` hint renders `•••• `. Only possible for hand-edited rows, since the migration and `POST` always write a hint.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Re-read the plan, the board, the handoff and the full diff: migration `1779979000003_hash_credentials.cjs` (with `down`), `tokens.js`, `middleware/auth.js`, `routes/auth.js`, `routes/sharing.js`, `inviteService.js`, OpenAPI, README, `api/auth.ts`, `InfoSheet.tsx` and CSS, DE/EN locales, adapted and new tests.
- `rg` for leftover plaintext column use (`api_key`, `token` in SQL) outside migrations and tests: none; `invites.js`, `v1.js` and `testRouter.js` need no change.
- `npm run lint`: 0 errors (1 pre-existing warning). `npm run build`: ok. `npm test`: backend 315/315, frontend 669/669.
- Integration suite run against a real PostgreSQL (embedded PostgreSQL 18 in the scratchpad, since Docker is not running): `npm run test:integration` gives 31/31 including `credentials.test.js` and the migration round-trip. This was the second run; the first failed on finding 1.
- Manual HTTP end-to-end against that database (`createApp` with a capturing mailer; script kept in the scratchpad, repository untouched):
  - register → only `token_hash` stored, differing from the mailed token; verify with an upper-case token → 200; garbage token → 400.
  - `POST /api/auth/api-key` returns `api_key`, `hint`, `created_at`; `GET` returns `{has_key, hint, created_at}` only; `/api/v1/lists` with the key → 200, garbage key → 401.
  - forgot → reset → 200, second use → 400; the old API key and the old JWT → 401 afterwards.
  - invite → `list_invites.token_hash == hashToken(mailed token)`; register with that invite token → 201 with `listId`.
  - legacy data: rolled the migration back one step, inserted a plaintext verification token, an upper-case reset token, an invite and a key, migrated up: the verification link, the reset link, the invite and the key all still work; no `token` or `api_key` column remains in the schema.
- InfoSheet flows read against the tests: no key → Generate; generated → full key, copy button and "shown only once" warning (`role="status"`); reopened → `•••• hint` with a confirmed Regenerate. `--color-warning` exists in `tokens.css`. I did not drive the sheet in a browser.

##### Findings
- Every acceptance criterion is met: no plaintext API key or token column in the schema; a pre-migration key authenticates; `GET /api/auth/api-key` exposes only `has_key`/`hint`/`created_at`; the key is shown once.
- Existing tests changed only where SQL parameters became hashes. InfoSheet API-key tests were rewritten for the new flow, not weakened. Verifying with a malformed token now returns 400 instead of a 500 from the old `uuid` cast.

##### Risks
- `down` cannot restore plaintext: pending links stop working and API keys are empty (documented in the migration and README).
- Anyone holding a key must read it at generation time. A lost key means regenerating it and re-keying Home Assistant.
- The plaintext key stays in the InfoSheet component state until the sheet closes.
- Not executed: Playwright E2E and a browser pass over the InfoSheet.

## Task: T-008 (hardening cycle 2026-10-08 — invites bound to the invited email)

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/integration/helpers.js:29` (pre-existing, also noted for T-007): the migration round-trip test runs `down`, which drops `pg_trgm` for the whole database, while `pg_trgm` is not in `SHARED_EXTENSIONS`. With test files running in parallel this races on `CREATE EXTENSION` (`pg_extension_name_index`) and cancels unrelated tests. It hit different files in each of two parallel runs against one database (`migrations`, then `credentials`); the suite passes 36/36 with `--test-concurrency=1`. Not caused by T-008. It stays a CI flake risk if the runner has more than two cores, so it is worth fixing in the harness (create `pg_trgm` up front and keep the migration from dropping a shared extension, or run integration files serially).
2. **minor** — the plan asks for `accepted_at = now()`, but `list_invites` has no such column. The implementer did not invent a migration and recorded this in the handoff. Accepted; no requirement depends on it.
3. **nit** — `GET /api/invites/:token` still changes state on a GET. It is the existing design, and the email binding now stops a forwarded link from being consumed by the wrong account.
4. **nit** — `integration/invites.test.js`, registration test: the user lookup falls back to "latest created user" via `response.body.user?.id`. It works because each file has its own schema, but looking the user up by the registered email would be clearer.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Re-read the plan, the board, the handoff and the full diff: `inviteService.js` (transactional claim, `isInviteForEmail`), `routes/invites.js` (lookup → email check 403 → owner check 409 → claim, 400 when lost), `routes/auth.js` (register-with-invite), `client.ts` (`HttpError`), `InviteAcceptPage.tsx`, DE/EN locales, README, adapted unit tests, new `InviteAcceptPage.test.tsx` and `integration/invites.test.js`.
- `npm run lint`: 0 errors (1 pre-existing warning). `npm run build`: ok. `npm test`: backend 319/319, frontend 674/674.
- Integration suite against an embedded PostgreSQL 18 (Docker is not running): `integration/invites.test.js` alone 5/5; the whole suite 36/36 when run serially. Parallel runs are flaky for the reason in finding 1.
- Manual HTTP check against that database with real SQL:
  - a different account's registration with another address's invite → 201, `email_verified = false`, not a member, invite still pending;
  - registration with the invite for the invited address (different letter case) → 201, verified, joined to the list;
  - a second registration reusing the same invite token → unverified, falls back to the normal verification flow;
  - the integration tests cover 403 for a stranger (no membership), 409 for the owner (invite stays pending), case-insensitive match, and two racing acceptances giving one 200 and one 400.
- Checked the page flow: 403 shows a translated message with the signed-in email and a "sign out and switch account" action; logout clears the token so the page redirects to `/login?redirect=/invite/<token>`, so the invitee returns to the invite after signing in. 409 shows a translated "you already own this list".

##### Findings
- All acceptance criteria are met: a different account gets 403 with a translated message and no membership; the owner gets 409; a second acceptance fails; a registration with another address's invite is not auto-verified.
- Existing invite tests were adapted to the transactional flow without weakening assertions.

##### Risks
- Every non-OK API response now throws `HttpError` (a subclass of `Error`), so existing callers behave the same; T-020 will replace it with error codes.
- The invite lookup, email check, owner check and claim are separate queries; only the claim and membership insert are transactional. A race can only make the claim fail, which answers 400 without changing state.
- Not executed: Playwright E2E and a browser pass over the invite page.

## Task: T-009 (hardening cycle 2026-10-08 — transactions, entry limits, UUID validation, mail after commit)

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/routes/entries.js` (PATCH, `status: "open"`): reopening a done entry is a single unlocked statement and does not check the 1,000 open-entry cap, so concurrent or repeated reopen requests can push a list past the cap. The acceptance criterion covers creates only and the plan did not ask for more, so this is not a required fix. A follow-up (T-010's shared service is the natural place) should apply the same list lock and cap check to reopen.
2. **minor** — `backend/src/app.js` error handler: a NUL byte in `text`, `icon` or `details` makes PostgreSQL raise `22021`, which is not mapped and answers 500 (checked by hand with `icon: "bad\u0000"`). Pre-existing and outside the acceptance criteria. Mapping `22021` to 400 or validating strings would close it.
3. **nit** — malformed ids now answer 404 before authentication, so an unauthenticated request to `/api/lists/foo/entries` gets 404 instead of 401. It leaks nothing; the implementer documented it.
4. **nit** — `routes/auth.js` register keeps `const result = { rows: [user] }` as a shim for the old shape, with later code still reading `result.rows[0]`. Harmless; a small cleanup for later.
5. **nit** — the race test seeds 995 open entries and fires 12 creates, expecting exactly five 201s. It would pass trivially only if the lock works, since an unlocked version would very likely create more than 1,000. I did not mutate the code to prove that it fails without the lock.

No blocker or major findings; no required fixes. Scope additions beyond the plan are sound: forgot-password mail also runs in the background (otherwise an SMTP error would reveal that an account exists), and `acceptInviteForUser` can join an existing transaction.

#### Verification

##### Steps performed
- Re-read the plan, the board, the handoff and the full diff: `withTransaction` use in `entries.js` (create and done PATCH), `validateUuid.js` (`app.param("id")` plus `router.param` in lists, entries and sharing), `inviteService.js`, `middleware/auth.js`, `app.js` error mapping, `mail/mailer.js` (`sendMailInBackground`), `routes/auth.js` (atomic register and resend), `routes/sharing.js`, `routes/lists.js`, README, and the test changes (fixtures moved to UUIDs, `testHelpers.js`, new `inputValidation.test.js`, `integration/entries.test.js`).
- Checked lock ordering: create and done PATCH both lock the list row first, then (PATCH only) the entry row, so they cannot deadlock each other. Eviction excludes the target id and only runs when the target exists and is currently open.
- `npm run lint`: 0 errors (1 pre-existing warning). `npm run build`: ok. `npm test`: backend 347/347, frontend 674/674.
- Integration suite against an embedded PostgreSQL 18 (Docker not running), run serially to avoid the known `pg_trgm` extension race from the T-007/T-008 reviews: 42/42, including the 12-way create race (exactly 1,000 open), unknown entry at the done limit (404, nothing deleted), eviction of exactly one old done entry, an already done entry (no eviction), and malformed ids (404, invite 400, API key 401).
- Manual HTTP run with an SMTP transport that always throws, against the real database: register 201 with its verification token committed, forgot-password 200, invite 201, revoke 204, and three background mail failures were logged. Deleting an unknown valid entry id answered 404. Leave with a failing mailer is covered by `inputValidation.test.js` (my manual call used the wrong verb and got 404).

##### Findings
- Every acceptance criterion is met: unknown or already done entries delete nothing; concurrent creates never exceed 1,000 open entries; malformed UUIDs, API keys and invite tokens give 404/401/400, never 500; an SMTP failure after revoke, leave or invite still returns success; register inserts are atomic.
- Existing tests were changed mechanically (ids and tokens became UUIDs, fakes gained `connect()`); no assertion was weakened.

##### Risks
- Mail is fire-and-forget: a process exit right after the response can drop a notification, and a failed invite mail now returns 201 without telling the owner (logged only). This is the requested behaviour.
- Taking the list-row lock on every create and completion serialises writes per list; fine for list sizes here.
- Not executed: Playwright E2E.

## Task: T-010 (hardening cycle 2026-10-08 — shared entry service, OpenAPI drift)

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `backend/src/services/entryService.js` (`updateEntry`): moving an entry back to `open` (app PATCH `status: "open"` and v1 toggle from done) still does not check the 1,000 open-entry cap, so the cap can be exceeded by reopening. This is the same gap noted for T-009 (finding 1). Now that both APIs share one service it is a single place to fix: lock the list row and count open entries when the next status is `open` and the current one is `done`. Not required by the T-010 criteria, which name create only.
2. **nit** — `backend/src/routes/v1.js:7-11` keeps its own `UUID_RE`/`isValidUuid` although `middleware/validateUuid.js` (`isUuid`) now exists. Using the shared helper would remove the duplicate.
3. **nit** — `backend/src/routes/entries.js` POST: a non-string `text` (for example a number) makes `text?.trim()` throw and answers 500. Pre-existing; v1 now rejects a non-string `name` with 400, so the app API is the odd one out.
4. **nit** — the push-failure log text changed from "Failed to enqueue push notification job" to "Failed to queue push notification job". No test or doc depends on it; mentioned only because log text is sometimes alerted on.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Re-read the plan, the board, the handoff and the diff: new `services/entryService.js` (`listEntries`, `createEntry`, `updateEntry`, `deleteEntry`), the slimmed `routes/entries.js` and `routes/v1.js`, `openapi/v1.yaml`, README, `v1.test.js`, `docs.test.js` and the new `integration/entryService.test.js`.
- Compared the moved SQL and statement order with the T-009 versions: the list/entry row locks, eviction rule (`id <> $2`, only open → done) and the 422 cap are unchanged; the v1 toggle now flips inside the locked transaction instead of a read-then-write.
- `npm run lint`: 0 errors (1 pre-existing warning). `npm run build`: ok. `npm test`: backend 350/350, frontend 674/674. `entries.test.js` passes without edits, which confirms the app API behaviour is unchanged.
- Integration suite against an embedded PostgreSQL 18 (Docker not running), run serially because of the known `pg_trgm` race: 46/46, including the four `entryService` tests (v1 create sets `last_updated_by` and queues a push; v1 toggle and rename set `last_updated_by`; 422 at the cap; v1 and the app API agree on the same entry).
- Manual v1 run against that database with API keys: blank description stored as null; numeric description and numeric name → 400; rename with a description, then rename without one keeps the description; toggle → done, toggle back → open; a stranger's list and toggle → 403; unknown valid item → 404; delete 204, second delete 404; a push job was enqueued on create; the SSE sequence was `entry:created`, four `entry:updated`, `entry:deleted`.
- OpenAPI: confirmed the removed autocomplete-history sentence, `nullable` replaced by `type: [string, "null"]` in the request bodies and the `Item` schema, the new 422 `LimitReached` response, and the pins in `docs.test.js`.

##### Findings
- Every acceptance criterion is met: v1 create/toggle/rename set `last_updated_by`, enforce the limits (422) and enqueue pushes on create; v1 description handling matches the app API; the OpenAPI has no dropped-table text and no 3.0 `nullable`.
- v1 test fixtures were rewritten around a statement-shape fake because the query sequence changed; assertions were kept or strengthened (actor, cap, eviction, blank description).

##### Risks
- v1 clients now see new behaviour: 422 at the cap, 400 for a non-string name or description, and pushes to other members when a Home Assistant automation adds items. These are the intended parity changes; worth mentioning in release notes.
- Not executed: Playwright E2E.

## Task: T-011 (hardening cycle 2026-10-08 — query indexes, pool settings, single-list endpoint)

Note: the task ID repeats an earlier cycle's T-011 section, if any; this section covers the current plan's T-011 only.

### Review Round 1

#### Verdict

`PASS_WITH_NOTES` — with the database-backed part **not verified by anyone yet** (see Risks). Run the integration suite before `commit_task`.

#### Findings

1. **minor (verification gap)** — `backend/src/integration/indexes.test.js` and the migration round-trip with the new migration were not executed by the implementer (no PostgreSQL) or by me (Docker daemon is not running, no embedded PostgreSQL could be located, and the sandbox blocks setting `TEST_DATABASE_URL`). The central acceptance criterion — `EXPLAIN` shows no Seq Scan on `entries` for entries, history, suggestions and overview — therefore rests on code reading only. Not a code defect found, but it must be confirmed before or by CI.
2. **minor** — `backend/src/integration/helpers.js`: the harness rewrites `DROP EXTENSION` statements to `SELECT 1` by wrapping `client.query`. This is a test-only workaround for the older migration `1713902400000`, whose `down` drops `pg_trgm` and would break parallel test files. It also means the round-trip test no longer exercises that extension drop. Acceptable and documented; keep an eye on it if migrations start issuing `DROP EXTENSION` in other forms.
3. **minor** — the suggestions query's `similarity(...) > 0.25` branch is not index-assisted (documented by the implementer). The test only demands no sequential scan on `entries`; the `list_id` index must carry it, and a planner choice on a small table can differ from a large one. Watch this test for flakiness in CI.
4. **nit** — `backend/src/db/migrations.test.js` moved the `createExtension` spy method and left a stray blank line and a missing blank line before the new `it`; no assertion changed.
5. **nit** — nothing calls `fetchList` yet (T-016 will); the helper is covered by `lists.test.ts`.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board, the handoff and the staged diff: migration `1779979000004_add_query_indexes.cjs`, `db/client.js` (`getPoolOptions`), `env.js` (`pgPoolMax` parsing), `routes/lists.js` (`GET /:id`), `integration/helpers.js`, `indexes.test.js`, unit tests, frontend `api/lists.ts` and `types.ts`, `.env.example`, compose example, README.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test`: backend 357 pass, 0 fail (frontend 677 per the board entry).
- Migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm`, the six btree indexes and the GIN `gin_trgm_ops` index on `entries(text)` as planned; `down` drops every index (7) and keeps the extension. A unit test pins both directions.
- Pool: `max` from `PG_POOL_MAX` (default 10; empty, non-numeric, zero, negative and fractional values fall back to 10), `connectionTimeoutMillis` 5000, `idleTimeoutMillis` 30000; documented in the README table, `.env.example` and the compose example.
- `GET /api/lists/:id`: access check first (403 for strangers), then a single owner/meta query; 404 for a missing list and for malformed ids via the existing UUID param check; response shape matches the plan. `fetchList` caches under `list:<id>`.

##### Findings
- Unit-level behaviour matches every acceptance criterion except the ones that need PostgreSQL.
- The integration test design is sound: it records the SQL the real endpoints run and `EXPLAIN`s exactly those statements on a seeded database (41 lists, about 12k entries, `ANALYZE`).

##### Risks
- Unverified against PostgreSQL: the migration (up, down, round-trip), all `EXPLAIN` assertions (the overview aggregate and the suggestions query are the likeliest to surprise) and the single-list 403. A planner that still chooses a Seq Scan on about 12k rows would fail the test.
- Please run `npm run test:integration` against PostgreSQL 16 (for example once Docker is up, with `TEST_DATABASE_URL` set) before `commit_task`; if it fails, send it back through `rework_task`.

## Task: T-012 (hardening cycle 2026-10-08 — membership and list lifecycle events)

### Review Round 1

#### Verdict

`PASS_WITH_NOTES`

#### Findings

1. **minor** — `useListLifecycleEvents.ts`: the owner who deletes a list from a page that is still open on another tab/device sees "This list was deleted." on the overview; on the tab that performed the delete the page has already navigated, so nothing is shown twice. Acceptable and consistent with the acceptance criteria.
2. **minor** — `OverviewPage.tsx`: `handleListDeleted` removes the list and still refetches (the existing app test expects the refetch). One redundant request per delete; harmless.
3. **minor** — the broadcast to the remaining members and the direct `member:removed` to the removed user are two separate sends, so the removed user's own `member:removed` is not duplicated, but a user who leaves voluntarily also gets the event on their other tabs (documented in the handoff).
4. **nit** — `OverviewPage.tsx` keeps a `// eslint-disable-next-line react-hooks/exhaustive-deps` for the mount-only notice cleanup; justified by the comment.

No blocker or major findings; no required fixes.

#### Verification

##### Steps performed
- Read the plan, the board, the handoff and the diff: `routes/sharing.js`, `routes/lists.js` (leave and delete), `sseManager.js` (`getListRecipients`), `ListDetailPage.tsx`, new `useListLifecycleEvents.ts`, `OverviewPage.tsx`, DE/EN locales, README, backend and frontend tests including the new `listLifecycleEvents.test.js`.
- Root cause confirmed: `broadcastToList` read recipients after the membership delete, so the removed or leaving user was never in the result; the routes now also call `sendToUsers([userId], "member:removed", …)` directly.
- List delete now reads recipients first, deletes, then sends `list:deleted`; the lookup and the send are try/caught and logged, so a failing broadcast never blocks (or precedes) the delete. Previously a rejecting broadcast returned 500 and announced a deletion that never happened.
- `npm run lint`: 0 errors. `npm run build`: ok. `npm test`: backend 365 pass, 0 fail; frontend 47 files pass.
- Both new translation keys exist in DE and EN.

##### Findings
- All acceptance criteria are met: removed or leaving member receives `member:removed`; delete is never blocked by a broadcast failure; the detail page leaves with a translated notice on `list:deleted` or own removal and renames in place on `list:updated` (metadata only, entries untouched); the overview drops the list on `list:deleted` and on own removal.
- Existing tests were changed only where behaviour changed (spies gained `sendToUsers`/`getListRecipients`; the delete test no longer expects the broadcast before the DELETE). No assertion was weakened.

##### Risks
- Frontend behaviour was verified through unit/component tests only; no browser or E2E run (no two-user E2E exists until T-023). No SQL changed, so no integration test was needed.
