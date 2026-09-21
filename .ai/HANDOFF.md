# HANDOFF

Append-only role handoff log. Each role adds one entry when its step is complete.

## Entry Template

Each entry uses this exact structure. Omit fields marked as role-specific when they do not apply.

---

### <TASK_ID> — <ROLE> — <YYYY-MM-DDTHH:MM:SSZ>

| Field | Value |
|-------|-------|
| Agent | claude \| codex |
| Summary | One-sentence description of work done |
| Files Changed | Comma-separated list of changed files |
| Validation | Commands run and outcomes (implement only) |
| Commit | `<hash> <conventional commit message>` (implement only) |
| Verdict | PASS \| PASS_WITH_NOTES \| FAIL (review only) |
| Blocking Findings | Numbered list or "none" (review only) |
| Next Role | plan \| implement \| review \| none |

---

### T-001..T-005 — plan — 2026-09-20T15:13:16Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned the page-load cycle from the 2026-09-20 Lighthouse baseline into five tasks: defer the icon model, de-duplicate the detail-page load, render cached data first, drop the idle startup probe, and self-host the fonts |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

---

### T-001 — implement — 2026-09-20T15:29:38Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | next_task: removed startup model priming, prime on add/edit sheet opening, and added an optional guarded idle helper; handed to review with the transfer-budget gap below |
| Files Changed | frontend/src/main.tsx, frontend/src/workers/iconWorkerClient.ts, frontend/src/workers/iconWorkerClient.test.ts, frontend/src/components/AddItemSheet/AddItemSheet.tsx, frontend/src/components/AddItemSheet/AddItemSheet.test.tsx, frontend/src/pages/ListDetailPage.test.tsx, e2e/lists.spec.js, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | npm run lint PASS (existing AuthContext fast-refresh warning); npm run build PASS (chunk-size warning); targeted frontend tests 60 PASS; npm test PASS (589 frontend + 174 backend); isolated Chromium cold-list test PASS; full Playwright reports 5 passed / 9 backend-dependent failures, database probe returns ECONNREFUSED (runner interrupted after all cases reported because teardown stalled); git diff --check PASS |
| Commit | `perf(icons): load the icon model on first use instead of at startup` |
| Next Role | review |

Review notes:

- Plan conflict: calling the idle helper automatically after list loading would still request model hosts on a cold visit. A clarification was sent; absent an answer, the stricter no-model-request acceptance criterion was used. `ListDetailPage.tsx` deliberately remains unchanged and never calls the helper. The page regression test checks both pending and completed loading. Confirm this interpretation during review.
- Transfer acceptance remains unmet. A fresh Chromium context against the gzip-served production build, with API fixtures and service-worker installation completed, recorded approximately 1263 KiB including precaching. Routing disables the HTTP cache, so this is a diagnostic, not a Lighthouse score. The existing precached `icon-512.png` alone transfers approximately 502 KiB; the worker JS is also precached (approximately 162 KiB) even though it never executes. No dedicated worker or Hugging Face/jsDelivr request occurred. The plan needs additional asset/precache scope to meet the 500 KiB target; this implementation does not claim that target passes.
- Exact-match, semantic-result and loading-feedback unit tests pass. The cold browser regression uses API fixtures to avoid requiring PostgreSQL; it checks real frontend startup, worker creation and forbidden hosts. A real model download and offline semantic reuse were not exercised.
- Existing planning edits in ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md and .ai/HANDOFF.md were present at entry and preserved. No new tracked files were created and no commit was made.

---

### T-001 — review — 2026-09-20T18:32:11Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | next_task: reviewed and verified the deferred icon-model load; the deferral itself works and was confirmed manually in a real browser, but the transfer-budget criterion is unmet and `warmIconWorkerWhenIdle()` ships with no call site |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | FAIL |
| Blocking Findings | 1. `warmIconWorkerWhenIdle()` is exported, tested and documented in README.md but has zero production call sites; PLAN.md Phase 1 requires a `ListDetailPage.tsx` call site that would itself break the no-model-request criterion — remove the helper or replan. 2. The "cold-load transfer < 500 KiB" criterion is unmet at a measured 1266.7 KiB and is unreachable from T-001's four in-scope files; the weight is `icon-512.png` (503.6 KiB), the precached logo, the icons and the Google Fonts pair — replan the criterion onto a task that owns the precache manifest and assets. |
| Next Role | implement |

Review notes:

- Validation re-run by the reviewer: `npm run lint` PASS (1 pre-existing AuthContext warning), `npm run build` PASS, `npm test` PASS 763 tests (589 frontend + 174 backend), `npx playwright test -g "cold list visits do not request the icon model"` PASS.
- Verified the core behaviour manually against a `vite preview` production build with API fixtures: after the list renders there are 0 dedicated workers and 0 model requests; opening the add sheet creates 1 worker and issues 10 `huggingface.co` requests; a non-catalogue term shows the loading spinner; `milk` resolves through `EXACT_MATCH_MAP` with no spinner. The deferral works as intended.
- Independently reproduced the transfer figure the implementer reported (1266.7 KiB vs their ~1263 KiB). Confirmed the cause lies outside T-001's file scope, so finding 2 is recorded as a planning defect and the required fix is a replan, not more code in these four files.
- Confirmed the implementer's interpretation of the plan conflict is the correct one: the stricter no-model-request criterion should win, and `ListDetailPage.tsx` should stay unwired. The consequence is that the idle helper and its README paragraph are dead weight and need removing.
- Non-blocking follow-ups recorded in REVIEW.md: the `iconWorker-*.js` chunk (162.2 KiB) is still precached on a cold visit though it never executes, and the new E2E spec settles on a fixed 1500 ms timeout.
- PostgreSQL and Docker are unavailable in this environment, so the DB-backed Playwright specs and a live-backend manual test could not run; the implementer's 9 reported failures are environmental ECONNREFUSED and unrelated to this diff.
- No code was modified during review and no commit was made.

---

### T-001, T-006 — plan — 2026-09-20T17:24:10Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | rework_plan: resolved both T-001 review escalations — dropped the idle icon warm-up entirely and moved the unreachable `< 500 KiB` cold-load budget onto a new asset/precache task T-006 |
| Files Changed | ROADMAP.md, .ai/PLAN.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Next Role | implement |

Plan notes:

- Decision 1 (user, 2026-09-20): no idle warm-up ships. `warmIconWorkerWhenIdle()`, its four unit tests, the two `ListDetailPage.test.tsx` assertions and the README sentence are removed. An automatic warm-up cannot coexist with "a cold load issues no model-host request", and an unwired helper is dead code, so ROADMAP Priority 1 drops the optional idle-prefetch bullet and the `saveData`/2g/3g criterion along with it. The implementer's original interpretation was correct and `ListDetailPage.tsx` stays unchanged.
- Decision 2 (user, 2026-09-20): the transfer budget moves to new task T-006. REVIEW.md finding 2 is accepted as a planning defect — the measured 1266.7 KiB lives in `icon-512.png` (503.6 KiB), the precached `iconWorker-*.js` chunk (162.2 KiB), a double-fetched `index-*.js` (158.3 KiB), the logo (127.4 KiB), `icon-192.png` (73.3 KiB) and the Google Fonts pair (52.1 KiB, T-005 scope). None of it is reachable from T-001's files.
- T-006 scope (user decision): re-encode the two PWA icons and the logo, exclude `assets/iconWorker-*.js` from `injectManifest.globPatterns`, and investigate the duplicate page + service-worker bundle fetch. Route-level code splitting stays in ROADMAP "Deferred".
- REVIEW.md finding 3 (precached icon worker chunk) is absorbed into T-006 as required scope rather than a follow-up. Finding 4 (the fixed 1500 ms wait in `e2e/lists.spec.js`) stays optional and is noted in PLAN.md Phase 1.
- T-001 remains `changes_requested` and is resumed with `rework_task T-001`, using REVIEW.md "Required Fixes" as the checklist; PLAN.md Phase 1 is now a subtractive rework and explicitly forbids re-opening the verified deferral behaviour.
- T-006 has a cross-task conflict with T-005 on `injectManifest.globPatterns` in `frontend/vite.config.ts` and on `frontend/src/vite-config.test.ts`; both phases call it out so whichever lands second preserves the other's change.
- T-006's transfer criterion is only meaningful after T-005 removes the font weight; implementation order is free, verification order is not.
- Documentation scope is explicit in both phases: README for the first-use model fetch (T-001, deletion) and for the transfer budget plus precache exclusion (T-006), with a matching comment in `vite.config.ts`.
- No code was modified.

---

### T-001 — implement — 2026-09-20T17:34:32Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | rework_task: removed the unused idle-prefetch helper, its flag, obsolete tests and README claim; retained sheet-open priming and startup regression guards |
| Files Changed | frontend/src/workers/iconWorkerClient.ts, frontend/src/workers/iconWorkerClient.test.ts, frontend/src/pages/ListDetailPage.test.tsx, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | npm run lint PASS (existing AuthContext warning); npm run build PASS (existing chunk-size warning); npm test PASS (582 frontend + 174 backend); cold-load Chromium spec PASS on retry using the installed Playwright CLI; git diff --check PASS |
| Commit | `perf(icons): load the icon model on first use instead of at startup` |
| Next Role | review |

- Required fix 1: deleted the helper and its state, seven parameterized idle-prefetch test cases, page-test mock/import/assertions, and the README sentence. Kept both no-priming page assertions and the import, explicit-init, crash-recovery, sheet-open and loading-feedback tests. Updated the client comment to prohibit speculative/idle prefetch.
- Required fix 2: already resolved by PLAN.md revision 2 and T-006. No asset, precache or transfer-budget changes belong to this rework.
- Repository-wide search finds the removed identifiers only in .ai planning, task and review/handoff records. No implementation, test, README or ROADMAP occurrences remain. The literal zero-occurrences-in-any-file criterion conflicts with preserving the append-only history and with its own wording; workflow records were retained for reviewer traceability.
- Browser validation: the initial npx run stalled in server setup and was interrupted. The next run timed out waiting five seconds for Milk (already present in the failure snapshot) and stalled in server teardown. With frontend/backend started explicitly, the unchanged spec passed in 7.5 seconds via `node node_modules/@playwright/test/cli.js test -g "cold list visits do not request the icon model"`. Temporary servers were stopped. The optional fixed-wait nit was left unchanged.
- Full DB-backed E2E and a completed model download/offline semantic reuse were not rerun for this subtractive rework. Existing planning/review changes and the unrelated untracked get-docker.sh were preserved. No new files were created and no commit was made.

---

### T-001 — review — 2026-09-20T18:04:53Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | next_task: review round 2 of the subtractive rework — the idle warm-up is gone from all code, tests and docs, and the first-use deferral was re-verified in a real browser against the production build |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

Review notes:

- Validation re-run by the reviewer: `npm run lint` PASS (0 errors, the pre-existing `AuthContext` react-refresh warning); `npm run build` PASS (pre-existing chunk-size warning, precache 14 entries / 1845.01 KiB); backend `npm test` PASS 174/174; frontend `vitest run --environment jsdom` PASS 582/582 on the second run; `node node_modules/@playwright/test/cli.js test -g "cold list visits do not request the icon model"` PASS in 6.3 s on the first attempt; `git diff --check` clean.
- Manual/production verification against `vite preview` of the built frontend with API fixtures: cold `/lists/list-1` load requested only `localhost`, `fonts.googleapis.com` and `fonts.gstatic.com`, created 0 dedicated workers and issued 0 model requests even after network idle plus a 2.5 s settle. Opening the add sheet created exactly 1 worker (`assets/iconWorker-*.js`) and started 10 `huggingface.co` requests beginning with `Xenova/all-MiniLM-L6-v2/resolve/main/config.json`. A non-catalogue term rendered the `aria-label="Loading icon suggestion"` spinner; `milk` rendered icons with no spinner, so the exact-match fast path is untouched.
- Both Round 1 required fixes are resolved. Required fix 1: `warmIconWorkerWhenIdle()`, the `idleWarmUpScheduled` flag, the idle-prefetch unit cases, the `ListDetailPage.test.tsx` mock/import/assertions and the README sentence are all removed; `primeIconWorker()` now has exactly one production call site, the `open`-gated effect in `AddItemSheet.tsx`. Required fix 2: resolved by PLAN.md revision 2, which moved the `< 500 KiB` budget to T-006 — the implementer correctly made no asset or precache changes here.
- The surviving tests still guard the behaviour rather than merely shrinking: module import creates no worker, explicit init, crash recovery, the full closed/open/re-render/close/re-open call-count sequence in `AddItemSheet.test.tsx`, and both `primeIconWorker` non-call assertions in `ListDetailPage.test.tsx`.
- Non-blocking notes in REVIEW.md round 2: the "no occurrence in the repository" criterion is self-referential and is satisfied in substance (remaining hits are only `.ai` workflow records); the `e2e/lists.spec.js:91` fixed 1500 ms wait is unchanged and was explicitly optional in PLAN.md; `frontend/src/app.test.tsx:172` is a pre-existing load-sensitive flake, untouched by this diff.
- Commit-hygiene action for `commit_task`: untracked `get-docker.sh` (the upstream Docker install script) and the modified `.claude/settings.local.json` are unrelated to T-001 and must be kept out of the `git add -A` for the `perf(icons)` commit.
- Environmental limits unchanged: PostgreSQL and Docker are unavailable, so DB-backed Playwright specs and a live-backend pass could not run; model-download completion and offline semantic reuse remain unverified end to end.
- No code was modified during review and no commit was made.

---

### T-001 — implement — 2026-09-20T18:08:56Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | commit_task: accepted review round 2 PASS_WITH_NOTES and marked T-001 done |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md; reviewed T-001 implementation, tests, documentation and cycle artifacts included in the commit |
| Validation | Reviewed lint/build PASS, 582 frontend + 174 backend tests PASS, cold-load Chromium and production-browser checks PASS; staged diff checked before commit |
| Commit | `perf(icons): load the icon model on first use instead of at startup` |
| Next Role | none |

- Excluded unrelated get-docker.sh and .claude/settings.local.json from staging, as required by review round 2. Their working-tree contents are preserved.

---

### T-002 — implement — 2026-09-20T18:25:25Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | next_task: removed translation-driven duplicate detail loads and let entries render without waiting for members, retaining member-loading feedback and errors |
| Files Changed | frontend/src/pages/ListDetailPage/useListDetailData.ts, frontend/src/pages/ListDetailPage/listDetailUtils.ts, frontend/src/pages/ListDetailPage/ListDetailPage.tsx, frontend/src/pages/ListDetailPage.test.tsx, frontend/src/pages/ListDetailPage/listDetailUtils.test.ts, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | Test-first targeted run: 5 expected failures, 31 passes; implementation run: 36/36 PASS; npm run lint PASS (existing AuthContext warning); npm run build PASS (existing chunk-size warning); npm test PASS (588 frontend + 174 backend); final fixture adjustment: 4/4 loading tests PASS; production Chromium scenarios 3/3 PASS; git diff --check PASS; extra tsc check reports 3 pre-existing errors below |
| Commit | `perf(lists): show list entries without waiting for member data` |
| Next Role | review |

- Removed the translated access-error option from the hook and its effect dependencies. ListAccessError is defined with the pure error formatter in listDetailUtils.ts rather than in the hook to avoid a runtime circular import; the page supplies the current translation at render time. Ordinary server error text is preserved.
- Initial member loading now uses the existing non-throwing path without awaiting it. Its own finally block controls the sharing spinner; member failure surfaces an error without clearing the list, entries or history. The existing list/entries/history Promise.all gate remains as specified in PLAN.md Phase 2. README and hook comments document the behavior.
- Tests were written before implementation and reproduced duplicate endpoint calls after delayed i18n resources/language change, entries hidden behind pending members, and entries cleared by member failure. Tests also verify the sharing spinner remains until members resolve, the access error updates language without refetching, and ordinary error messages remain intact. Existing resync, optimistic update and pending-entry tests continue passing.
- Production-browser verification used the built frontend via vite preview on 127.0.0.1:4318 and fresh Chromium contexts with API fixtures and service workers blocked. Held translation JS and member responses independently: Milk rendered while both were pending, translation arrival updated labels without refetching, the sharing sheet showed its spinner until member release. After network idle, lists/entries/history/members/mark-viewed each had exactly 1 request. A separate member-503 scenario preserved Milk and the title with an error banner and the same counts. A missing-list scenario displayed the German access error, with lists/entries/history once and no members/mark-viewed. Preview server stopped after verification.
- Additional `node node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json` remains nonzero on 3 existing issues: nullable DetailEntry.details passed to getRecentlyUsedDisplayState (ListDetailPage.tsx:222), owner_name in the OverviewPage test fixture (:51), and quantized in iconWorker.ts (:42). Corresponding code/types are unchanged from HEAD. A new excess-property diagnostic in the member fixture was fixed before handoff, with the targeted tests and lint rerun.
- DB-backed E2E was not rerun; browser checks used fixtures. No new repository files were created and no commit was made. Unrelated .claude/settings.local.json and get-docker.sh remain untouched and must be excluded when committing.

---

### T-002 — review — 2026-09-20T18:41:51Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | next_task: verified the detail page now loads each endpoint exactly once across late-arriving translations and renders entries without waiting for members, with member failures and the access error still surfacing correctly |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

Review notes:

- Validation re-run by the reviewer: `npm run lint` PASS (0 errors, the pre-existing `AuthContext` react-refresh warning); `npm run build` PASS (pre-existing chunk-size warning, precache 14 entries / 1845.07 KiB); frontend `vitest run --environment jsdom` PASS 588/588 across 41 files; backend `npm test` PASS 174/174.
- The implementer's "3 pre-existing tsc errors" claim was checked rather than trusted: the five changed source files were stashed and `tsc --noEmit` re-run against the committed baseline, producing the identical three errors (`DetailEntry.details` nullability, `owner_name` in the OverviewPage fixture, `quantized` in `iconWorker.ts`), differing only by a one-line shift. The diff adds no new type errors. Working tree restored and confirmed intact.
- Independent browser verification against `vite preview` of the production build, three scenarios with API fixtures, the service worker blocked so it cannot distort request counting, and the lazy `assets/translation-*.js` chunk artificially delayed to reproduce the original defect. Scenario A (translations held 2.5 s, members held 4 s): lists/entries/history/members/mark-viewed each requested exactly once, `Milk` visible while members were still pending, no page skeleton at that moment. Scenario B (members 503): same counts, error banner shown, title and entries still visible. Scenario C (list absent, `de`): lists/entries/history once each, no members and no mark-viewed, German access error rendered.
- Root cause is removed rather than worked around: `accessErrorMessage` is gone from the hook options and the effect dependency array, no remaining dependency derives from `t()`, and the other deps were each confirmed stable (`loadMembers` on `listId`/`token`, `setEntries` with empty deps, `onLoadStart`/`onNonOwnerList` memoised with empty deps in `ListDetailPage`).
- Removing `setIsSharingLoading(false)` from the effect's `finally` is safe because `loadMembers` owns the flag on every branch; the one narrow window this opens is recorded as a nit, not a fix.
- Tests are genuine regression guards written test-first: a real `i18next` instance with a stub backend asserts the five call counts before and after resources arrive; the members-pending case separates the page skeleton from the sharing spinner through the shared `aria-label="Loading"`; the language-switch case proves re-translation without refetch; the member-failure case pins entries, title and banner together. `listDetailUtils.test.ts` covers the sentinel in two languages and the pass-through of ordinary errors.
- Documentation rule satisfied: the new README paragraph matches the shipped behaviour exactly, and the two new hook comments explain the sentinel and why members sit outside the loading gate.
- Two non-blocking nits in REVIEW.md: `getErrorMessage`'s default second argument returns the raw i18n key, which is unreachable today but a footgun for a future caller; and the `isSharingLoading` window described above.
- Commit-hygiene reminder for `commit_task`, unchanged from T-001: keep untracked `get-docker.sh` and the modified `.claude/settings.local.json` out of the `git add -A`.
- Environmental limits unchanged: PostgreSQL and Docker unavailable, so DB-backed Playwright specs and a live-backend pass could not run.
- No code was modified during review and no commit was made.

---

### T-002 — implement — 2026-09-20T18:43:52Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | commit_task: accepted review round 1 PASS_WITH_NOTES and marked T-002 done |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md; reviewed T-002 implementation, tests, README and review artifacts included in the commit |
| Validation | Reviewed lint/build PASS, 588 frontend + 174 backend tests PASS, three production-browser scenarios PASS; reviewer confirmed the three typecheck errors against baseline; staged diff checked before commit |
| Commit | `perf(lists): show list entries without waiting for member data` |
| Next Role | none |

- Excluded unrelated get-docker.sh and .claude/settings.local.json from staging as requested in the review. Their working-tree contents are preserved.

---

### T-003 — implement — 2026-09-21T04:44:25Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | next_task: implemented and verified the planned cache-first callbacks; retained in_implementation pending a decision on the literal first-frame acceptance conflict |
| Files Changed | frontend/src/api/client.ts, frontend/src/api/entries.ts, frontend/src/api/lists.ts, frontend/src/pages/ListDetailPage/useListDetailData.ts, frontend/src/api/client.test.ts, frontend/src/pages/ListDetailPage.test.tsx, README.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | Test-first run: 8 expected failures / 56 passes; added cross-list isolation regression failed before its fix; targeted final run 65/65 PASS; npm run lint PASS (existing AuthContext warning); npm run build PASS (existing chunk-size warning); npm test PASS (605 frontend + 174 backend); 4 production Chromium scenarios PASS for data behavior; frame sampling shows literal first-frame criterion NOT met; git diff --check PASS |
| Commit | `perf(lists): show the last known list contents instantly on open` |
| Next Role | implement |

- Added typed, opt-in onCachedValue callbacks for list and entry GETs. The cache read and network run concurrently; response settlement, including access failures, suppresses late cache delivery before cache persistence finishes. Ordinary reads/writes retain their existing path, and network failures retain the offline fallback and offline marker. Cache-preview read failures do not block an online result.
- The detail hook shows cached entries as soon as they are read, then replaces them with the server payload. Initial refresh now uses mergePendingEntries and restores local completion badges, preserving recently-used filtering. Per-effect guards ignore superseded or unmounted loads; list/session changes clear the old entry scope to avoid merging queued entries into another list. Member requests and mark-viewed still run once after the authoritative initial load.
- Tests cover early cache delivery, network winning, slow persistence, HTTP 401/403, cache miss/read failure, offline fallback, opt-in behavior and API forwarding; page tests cover cached replacement, empty cache, pending additions/history filtering, Done badges, access denial, superseded sync loads and cross-list isolation. README and ordering comments updated.
- Independent Chromium verification used the production build on 127.0.0.1:4318, fresh contexts, real IndexedDB resource_cache records, API fixtures and blocked service workers. Cached scenario: cached title/entries visible with the network held, no spinner once the cache is applied; fresh response replaces old content and keeps a queued entry out of recently-used history. Empty cache: existing loading state until network completes. Offline: aborted network reads fall back to cached data. Denied: missing server list clears the cached view and shows the translated access error. Each of lists/entries/history/members/mark-viewed was requested once, except denied correctly skips members/mark-viewed. Temporary preview server stopped.
- Acceptance conflict discovered by requestAnimationFrame sampling: even with populated IndexedDB, an initial detail loading frame is painted before the asynchronous read returns. The PLAN.md Phase 3 callback mechanism delivers immediately after cache-read completion, but cannot synchronously populate the first render after mount. The literal TASKS.md/ROADMAP.md first-frame/no-spinner wording therefore does not pass; no acceptance claim or ready_for_review transition has been made. Asked the user whether to accept cache-read completion timing within planned scope or expand scope to cache preloading before detail-page mount. Answer pending; no scope expansion implemented.
- Extra tsc --noEmit check reports only the three existing errors confirmed by the T-002 reviewer: DetailEntry.details nullability at ListDetailPage.tsx:222, owner_name in OverviewPage.test.tsx:51, quantized in iconWorker.ts:42. No new diagnostics.
- No DB-backed E2E run; browser checks use fixtures and real local caching. No new repository files or commit created. The already-staged unrelated .claude/settings.local.json was preserved; exclude it from any later task commit.

---

### T-003 — implement — 2026-09-21T04:59:12Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | next_task completion: user accepted showing cached entries as soon as the cache read completes; aligned acceptance wording and moved T-003 to ready_for_review |
| Files Changed | .ai/PLAN.md, ROADMAP.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Validation | Existing implementation evidence remains applicable: lint/build PASS, 779 unit tests PASS, 65 targeted tests PASS, four production Chromium cache scenarios PASS; no code changes since validation; git diff --check PASS |
| Commit | `perf(lists): show the last known list contents instantly on open` |
| Next Role | review |

- Explicit user decision: "accept showing cached entities as soon as the cache read completes". This resolves the timing conflict recorded in the previous entry. A loading frame while IndexedDB is still reading is acceptable; the cached view itself has no spinner and does not wait for the network.
- Updated only the timing wording in PLAN.md, ROADMAP.md and TASKS.md to reflect the user's decision. No pre-mount preload or other scope expansion is required. README already describes the accepted behavior accurately.
- All other acceptance requirements and the earlier validation evidence remain unchanged. The three pre-existing TypeScript diagnostics and fixture-based browser coverage remain documented in the prior entry.
- No commit made. Preserve the unrelated staged .claude/settings.local.json and exclude it from the eventual task commit.

---

### T-003 — review — 2026-09-21T05:24:58Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | next_task: verified cache-first rendering against real IndexedDB in a production build — cached entries appear 257 ms after navigation with no spinner, the server payload replaces them, and the offline fallback, pending merge and access-error clearing all still hold |
| Files Changed | .ai/REVIEW.md, .ai/TASKS.md, .ai/HANDOFF.md |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

Review notes:

- Validation re-run by the reviewer: `npm run lint` PASS (0 errors, the pre-existing `AuthContext` react-refresh warning); `npm run build` PASS; frontend `vitest run --environment jsdom` PASS 605/605 across 41 files; backend `npm test` PASS 174/174 (779 total, matching the handoff); `tsc --noEmit` shows only the three errors established as pre-existing during the T-002 review.
- Browser verification used a persistent context against `vite preview` of the production build, so the feature was exercised against real IndexedDB rather than the mocked `offlineStore` the unit tests use. With `/api/lists` and `/entries` held for 6 s: cached entry and cached list title on screen at 257 ms with zero loading indicators and no fresh content; fresh payload replaced both at 6227 ms. Aborting requests as `internetdisconnected` still produced the offline banner with cached content. A clean context with no cache kept the loading indicator until the held responses arrived.
- Separate browser run for revoked access against a populated cache: cached content rendered while the response was held, then both the entry and the cached title were cleared and "You no longer have access to this list." was shown. The T-002 access-error behaviour survives cache-first rendering.
- The ordering guarantee was traced in source, not just trusted: `sendJsonRequest` sets `networkSettled` immediately after `requestJson` resolves — before `await writeCachedResource` — and in the catch, and the hook adds a second `networkFinished` guard for the aggregate. Each request's flag settles strictly before `Promise.all` resolves, so a cache callback cannot fire after its payload has been applied. `client.test.ts` pins late-cache-after-success, cache-during-persistence, 401/403, null cache and a rejecting cache read.
- Two changes that look like scope creep are in fact required by the new interactive window and are correct: running the initial network result through `mergePendingEntries` plus the `locallyDoneIdsRef` mapping, so entries queued or completed over cached content are not discarded; and the new `entriesScopeRef` clear, without which a route change would merge the previous list's queued entries into the next one. Replacing `isMountedRef` with a per-run `active` flag likewise fixes a real gap, since `isMountedRef` never invalidated a superseded run.
- `readCachedResource` runs only for callers that opt in — asserted by test — so the overview and every other GET gained no IndexedDB work.
- Finding 1 (`minor`, not required, for the planner): cache keys are `lists` and `entries:<listId>` with no account component, and `logout()` clears only the token while nothing clears cached resources. Before this change the unscoped cache surfaced only on the network-error fallback; it now surfaces on every online detail-page load. Reachability is narrow — the lists callback applies a cached list only when the id matches, so a second account sees another account's cached title and entries only by navigating directly to a list URL it cannot access, and the window self-corrects. Cheap remedies: fold the account id into `createCacheKey`, or clear cached resources on logout. Recommend a separate planner task rather than expanding T-003.
- Finding 2 (`nit`): the `filterRecentlyUsedItems` call inside the entries cache callback always receives an empty list, because the effect resets Recently Used synchronously and the history branch runs only after the callback is suppressed. Harmless defensive no-op, worth a comment or removal.
- Environmental limits unchanged: PostgreSQL and Docker unavailable; the browser runs blocked the service worker to keep request timing meaningful; route-to-route navigation between two lists was covered at hook level via `renderHook` rather than by clicking through the app.
- No code was modified during review and no commit was made.

---

### T-003 — implement — 2026-09-21T05:55:12Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | commit_task: accepted review round 1 PASS_WITH_NOTES and marked T-003 done |
| Files Changed | .ai/TASKS.md, .ai/HANDOFF.md; reviewed T-003 implementation, tests, documentation, accepted timing clarification and review artifacts included in the commit |
| Validation | Reviewed lint/build PASS, 605 frontend + 174 backend tests PASS, production-browser cache checks PASS; no new TypeScript errors; staged task diff checked before commit |
| Commit | `perf(lists): show the last known list contents instantly on open` |
| Next Role | none |

- Commit limited to the reviewed task paths so the unrelated, already-staged .claude/settings.local.json remains staged and uncommitted.
- The review's account-scoped cache follow-up remains recorded for the planner in REVIEW.md; no required fixes or scope changes were requested for this commit.
