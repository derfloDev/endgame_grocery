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
