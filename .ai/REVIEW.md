# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Styling Fixes

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. All three changes are minimal, isolated CSS edits exactly matching the plan.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-001.
2. Ran `git diff HEAD` on the three target CSS files to verify each change.
3. Read final file content of all three CSS files to confirm values.
4. Ran `npm run lint` — passed (0 errors; 1 pre-existing `react-refresh/only-export-components` warning in `AuthContext.tsx`, unrelated to T-001).
5. Ran `npm run build` — passed (1 pre-existing Vite chunk-size warning, unrelated to T-001).
6. Ran `npx vitest run src/app.test.tsx` to characterise the known test failure — all failures caused by `ReferenceError: window is not defined`, a pre-existing environment issue completely unrelated to T-001's CSS-only changes; confirmed this matches the evidence already documented in TASKS.md.

##### Findings
- `OverviewPage.module.css`: `.overview-topbar` padding changed from `52px 16px 16px` to `16px 16px 16px`. ✅
- `FAB.module.css`: `bottom` changed from `92px` to `16px`. ✅
- `AddItemSheet.module.css`: `min-height: calc(2 * 88px + 10px)` added to `.add-item-icon-browser-grid`. ✅
- The `min-height` value (186px = 2 rows of 88px + 1 gap of 10px) correctly ensures two full rows of icons are always visible.

##### Risks
- FAB `bottom: 16px` removes the previous clearance for a bottom navigation bar (was `92px`). This is intentional per the plan — confirm the app does not have a bottom nav bar that would overlap the FAB.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002 — Enter-Key UX in AddItemSheet

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. Implementation is clean and exactly matches the plan.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-002.
2. Ran `git diff HEAD` — confirmed changes to `AddItemSheet.tsx` and `AddItemSheet.test.tsx`.
3. Read `handleSubmit` in `AddItemSheet.tsx` — confirmed it guards `if (!trimmed) { return; }` (line 168), so Enter on empty text is a no-op.
4. Read `handleInputKeyDown` — guards `event.key !== "Enter"`, calls `event.preventDefault()` and `void handleSubmit()`. Correct pattern.
5. Confirmed `enterKeyHint="done"` and `onKeyDown={handleInputKeyDown}` added only to the title input; Details field is unchanged.
6. Ran `npm run test -w @endgame-grocery/frontend -- --reporter=verbose --run src/components/AddItemSheet/AddItemSheet.test.tsx` — **16/16 pass**, including the new "submits the title input with Enter and exposes a done keyboard action" test.
7. Ran full `npm test` — **431/431 pass across 31 test files**.
8. `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `AddItemSheet.tsx`: `KeyboardEvent` imported; `handleInputKeyDown` function added; `enterKeyHint="done"` and `onKeyDown` wired onto the title input only. ✅
- `AddItemSheet.test.tsx`: New test fires `keyDown` with `"Enter"`, asserts `enterkeyhint` attribute is `"done"`, and asserts `onAdd` was called with the correct args. ✅
- Empty-text guard confirmed present in `handleSubmit` — Enter with blank title is harmless. ✅

##### Risks
- None. Changes are isolated to the title input of a single component.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-005 — Push Notifications Debug & Fix

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. All eight plan checklist items are addressed and thoroughly tested.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria and investigation checklist for T-005.
2. Ran `git diff HEAD` — confirmed `backend/src/app.js`, `backend/src/workers/pushWorker.js`, `backend/src/routes/push.js`, `backend/src/pushWorker.test.js`, `backend/src/push.test.js`, `backend/src/app.test.js`, `frontend/src/sw/service-worker.js`, `frontend/src/vite-config.test.ts`, `README.md`. No unexpected files.
3. **Checklist 1 — VAPID startup warning**: `getMissingVapidConfigFields()` extracted and called in both `app.js` and `processPendingPushJobs`; `app.js` logs `warn` when incomplete; `processPendingPushJobs` also logs `warn` and returns. ✅
4. **Checklist 2 — Subscription persistence**: `push.js` now logs `info` on both subscribe and unsubscribe with `userId` and `endpoint`. ✅
5. **Checklist 3 — Push-worker tick**: `logger.debug({ dueJobCount }, "Push worker tick loaded due jobs")` added. ✅
6. **Checklist 4 — Recipient query**: Changed from `logger.debug` to `logger.info` for zero-recipients case. ✅
7. **Checklist 5 — Subscription query**: New `logger.info` branch for zero-subscriptions case. ✅
8. **Checklist 6 — `sendNotification` error paths**: Diff confirms no change to error handling — existing code was already correct; implementer verified without modifying. ✅
9. **Checklist 7 — Service worker push handler**: `if (import.meta.env.DEV) { console.log(...) }` added; guarded so it never fires in production. ✅
10. **Checklist 8 — `buildNotificationBody` language fix**: `"und"` → `"and"`, `"weitere Artikel"` → proper `"more item"` / `"more items"` with singular/plural handling. ✅
11. **Extra logging added** (beyond plan): "Push job enqueued" (enqueue), "Push job fired" (per job), "Push recipients found", "Push subscriptions targeted", "Push notifications sent" — all provide a complete end-to-end trace. ✅
12. **Tests** — `pushWorker.test.js`: `warn` method added to logger spy; new tests for VAPID early-return, zero-recipients, and zero-subscriptions; all existing log sequences updated to include new entries; English body text assertion updated. `push.test.js`: log assertions for subscribe/unsubscribe. `app.test.js`: startup VAPID warning test. `vite-config.test.ts`: service-worker `console.log` assertion.
13. **README.md**: New bullet documents the warning behaviour for missing VAPID config and the push delivery log trace. ✅ (meets AGENTS.md documentation rules)
14. Ran `cd C:/develop/endgame_grocery/backend && node --test src/pushWorker.test.js src/push.test.js src/app.test.js` — **15/15 pass**.
15. Ran `npm run test -w @endgame-grocery/frontend -- --run src/vite-config.test.ts` — **10/10 pass**.
16. Ran `npm run lint` — pass (0 errors; 1 pre-existing frontend warning).

##### Findings
- `getMissingVapidConfigFields` is a clean extraction that allows both `app.js` and `processPendingPushJobs` to produce structured log fields listing exactly which keys are absent. ✅
- `buildNotificationBody` plural form (`"item"` vs `"items"`) is handled correctly. ✅
- Dev-only `console.log` in service worker is properly gated on `import.meta.env.DEV`. ✅

##### Risks
- The `enqueuePushJob` function now accepts a `logger` parameter (defaulting to `defaultLogger`). Existing callers that don't pass `logger` are unaffected. ✅

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-008 — Icon Database Entries for New Icons

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. One proactive improvement: `"aufstrich"` was also removed from the `hummus` entry (not mentioned in the plan), which is correct — it prevents a non-deterministic `EXACT_MATCH_MAP` since `"aufstrich"` now lives exclusively in `nutNougatCream`.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-008.
2. Ran `git diff HEAD` — confirmed only `iconDatabase.ts` and `cosineSimilarity.test.ts` changed (plus AI tracking files). No unexpected files.
3. **`iconDatabase.ts` — jam entry**: `"nutella"` and `"aufstrich"` removed. ✅
4. **`iconDatabase.ts` — hummus entry**: `"aufstrich"` also removed (proactive fix; avoids EXACT_MATCH_MAP collision). ✅
5. **New entries placement and tags**:
   - `herbs` — Produce section, all plan tags present. ✅
   - `dishwasherTabs` — Household Cleaning section, all plan tags present. ✅
   - `maultaschen` — Meals/Prepared Foods section (after pasta), all plan tags present. ✅
   - `nutNougatCream` — end of ICON_DB (near hummus/spreads area), all plan tags including `"aufstrich"`. ✅
6. **Tests** added to `cosineSimilarity.test.ts` (existing icon DB test file — correct placement):
   - `EXACT_MATCH_MAP["spülmaschinentabs"] === "CustomDishwasherTabs"` ✅
   - `EXACT_MATCH_MAP.nutella === "CustomNutNougatCream"` ✅
   - `EXACT_MATCH_MAP.aufstrich === "CustomNutNougatCream"` ✅ (additional check)
   - `EXACT_MATCH_MAP.maultaschen === "CustomMaultaschen"` ✅
   - `EXACT_MATCH_MAP.petersilie === "CustomHerbs"` ✅
   - `EXACT_MATCH_MAP.nutella !== "CustomJam"` regression guard ✅
7. Ran `npm run test -w @endgame-grocery/frontend -- --run src/utils/cosineSimilarity.test.ts` — **13/13 pass**.
8. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- All four new icon DB entries correctly placed in contextually appropriate sections. ✅
- Tag sets are thorough (German + English + spelling variants) and match the plan. ✅
- `"aufstrich"` cleaned from both `jam` and `hummus`, now unique to `nutNougatCream`. ✅

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-004 — PWA Update Banner

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. Implementation is thorough and correctly handles all plan acceptance criteria.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-004.
2. Ran `git diff HEAD` — confirmed `register.ts`, `main.tsx`, `App.tsx`, `UpdateBanner.tsx`, `UpdateBanner.module.css`, `UpdateBanner.test.tsx`, `feature-components.test.ts`, `locales/de/translation.json`, `locales/en/translation.json`, `README.md`. No unexpected files.
3. **`register.ts`**: `registerSW` replaced by `useRegisterSW` from `virtual:pwa-register/react`; exports `useServiceWorkerUpdate()` hook returning `{ needRefresh, updateServiceWorker, dismissUpdate }`; DEV guard: `needRefresh: import.meta.env.DEV ? false : needRefresh`. ✅
4. **`main.tsx`**: `registerServiceWorker()` import and call removed, consistent with the hook-based approach. ✅
5. **`UpdateBanner.tsx`**: Renders as `null` when `!needRefresh || dismissed`; action button calls `updateServiceWorker(true)`; dismiss button writes sessionStorage key, calls `dismissUpdate()`, and sets local state. ✅
6. **`App.tsx`**: `UpdateBanner` rendered inside `ProtectedLayout` before `OfflineBanner`. ✅
7. **Translations**: `update.bannerText` and `update.bannerAction` added in both `de` and `en`. ✅
8. **`feature-components.test.ts`**: `UpdateBanner` added with expected CSS class names. ✅
9. **`README.md`**: Documentation added in the correct section describing the update banner behaviour. ✅ (meets AGENTS.md documentation rules)
10. Ran `npm run test -w @endgame-grocery/frontend -- --reporter=verbose --run src/components/UpdateBanner/UpdateBanner.test.tsx src/components/feature-components.test.ts` — **28/28 pass**.
11. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- Banner hidden when `needRefresh` is false (no spurious render). ✅
- `updateServiceWorker(true)` called correctly on reload action. ✅
- Dismiss persists to `sessionStorage` so banner stays hidden across component remounts within the session. ✅
- DEV guard properly suppresses the banner during local development. ✅

##### Risks
- `useServiceWorkerUpdate` is only called when `UpdateBanner` mounts inside `ProtectedLayout`. This means the SW is registered only for authenticated users, not for the login/register pages. This is intentional per the plan ("render it inside ProtectedLayout") and acceptable for this auth-required app; any user who has previously authenticated already has the SW running from a prior session.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003 — New Icons (4)

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. All four icons are correctly authored and wired.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-003.
2. Ran `git diff HEAD` — confirmed exactly the 4 SVG files, `customIcons.ts`, `iconRegistry.ts`, and `iconRegistry.test.ts` changed; no unexpected files.
3. Inspected all 4 SVG files — each has `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. All are stroke-based as required.
4. Verified `customIcons.ts`: 4 new `*Svg` imports and 4 new `Custom*` exports added in correct alphabetical position.
5. Verified `iconRegistry.ts`: 4 new imports from `customIcons.ts` and 4 entries added to `ICON_REGISTRY` object. `ICON_REGISTRY_KEYS` is derived from `Object.keys(ICON_REGISTRY)` — automatically includes the new icons.
6. Inspected `iconRegistry.test.ts` diff: new icons added to the ICON_REGISTRY_KEYS list test, `formatIconName` assertions for all 4 (correct display names), and render tests at sizes 22 and 32 for all 4.
7. Ran `npm run test -w @endgame-grocery/frontend -- --reporter=verbose --run src/data/iconRegistry.test.ts` — **142/142 pass**, including new tests for all 4 icons.
8. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `dishwasherTabs.svg`: 4 rounded rectangles with line/dot details — appropriate representation of dishwasher tabs. ✅
- `herbs.svg`: Branching stem paths with tie detail at the base — recognisable herb bunch. ✅
- `maultaschen.svg`: Three pasta-pocket shapes with fill line detail — clearly Maultaschen. ✅
- `nutNougatCream.svg`: Jar shape with lid, label stripes, and label lines — accurate jar/cream representation. ✅
- All 4 icons registered and exported consistently following existing naming conventions. ✅

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-007 — ListDetailPage TopBar Top-Padding Fix

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-28

#### Findings
- No issues found. Single-line CSS change exactly matches the plan acceptance criteria.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-007.
2. Ran `git diff HEAD` (full working tree) — confirmed `frontend/src/components/ui/TopBar/TopBar.module.css` changed from `padding: 52px 16px 12px` to `padding: 16px 16px 12px`.
3. Confirmed no other files changed for T-007 beyond the AI tracking files (`.ai/HANDOFF.md`, `.ai/PLAN.md`, `.ai/TASKS.md`).
4. Ran `npm run lint` — passed (0 errors; 1 pre-existing `react-refresh/only-export-components` warning in `AuthContext.tsx`).
5. Build previously validated in T-001 review with this working-tree change already present — confirmed passing.

##### Findings
- `TopBar.module.css`: `.topbar` padding changed from `52px 16px 12px` to `16px 16px 12px`. ✅ Matches plan exactly.

##### Risks
- None. `TopBar` is a shared component used across multiple pages; the fix consistently applies the same 16px top padding that was already applied to `OverviewPage`.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-006 — Changed Badges

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-29

#### Findings
- No issues found. The implementation is thorough and correctly handles all plan acceptance criteria. One intentional deviation from the plan (noted below) improves UX.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-006.
2. Ran `git diff HEAD` — confirmed all expected files changed and no unexpected files.
3. **Migrations**:
   - `1779979000000_add_last_updated_by_to_entries.cjs`: Adds `last_updated_by uuid REFERENCES users(id) ON DELETE SET NULL`. ✅
   - `1779979000001_add_list_views.cjs`: Creates `list_views (user_id, list_id, last_viewed_at)` with composite PK and `ON DELETE CASCADE` for both FKs. ✅
4. **`backend/src/routes/entries.js`**:
   - GET: `LEFT JOIN list_views lv` and `is_changed` computed as `lv.last_viewed_at IS NOT NULL AND e.updated_at > lv.last_viewed_at AND (e.last_updated_by IS NULL OR e.last_updated_by <> $2)`. Passes authenticated `userId` as `$2`. ✅
   - POST/PATCH: Both set `last_updated_by = req.user.sub`. ✅
5. **`backend/src/routes/lists.js`**:
   - GET: LATERAL subquery counts entries where `last_viewed_at IS NOT NULL AND updated_at > lv.last_viewed_at AND (last_updated_by IS NULL OR last_updated_by <> $1)`. ✅
   - New `POST /:id/mark-viewed` endpoint: Checks list access, then UPSERTs into `list_views` with `ON CONFLICT (user_id, list_id) DO UPDATE SET last_viewed_at = CURRENT_TIMESTAMP`. Returns 204. ✅
6. **`frontend/src/types.ts`**: `Entry` gets optional `created_at`, `updated_at`, `last_updated_by`, `is_changed`; `List` gets optional `changed_count`. ✅
7. **`frontend/src/api/lists.ts`**: `markListViewed()` calls `POST /api/lists/:id/mark-viewed` with `queueable: false`. ✅
8. **`frontend/src/components/EntryTile/EntryTile.tsx`**: `changeKind` prop accepted; `entry-tile-change-badge` span rendered with `getChangeLabel()` helper returning localised strings for `"new"`, `"edited"`, `"done"`. ✅
9. **`frontend/src/components/ListCardHome/ListCardHome.tsx`**: `changed_count` prop renders inline `.list-card-change-badge` span with `aria-label` using `list.changedCount` i18n key. ✅
10. **`frontend/src/pages/ListDetailPage/ListDetailPage.tsx`**: `getChangeKind()` maps `is_changed + status` to `"new" | "edited" | "done"`; done entries with `is_changed` are included in `visibleEntries`; `changeKind` passed to `EntryTile`. ✅
11. **`frontend/src/pages/ListDetailPage/useListDetailData.ts`**: Calls `markListViewed()` after entries load, then clears change flags. ✅
12. **CSS**: `.entry-tile-change-badge` positioned absolutely at top-right; `.list-card-change-badge` inline. ✅
13. **i18n**: `list.changedCount` (plural form), `entry.changeNew/changeEdited/changeDone` in both `de` and `en`. ✅
14. **Tests**: `migrations.test.js` — 2 new tests covering `up`/`down` for both migrations. `entries.test.js` — `is_changed` field and `last_updated_by` SQL assertions. `lists.test.js` — `changed_count` parsing, SQL shape assertion, `mark-viewed` endpoint test. `app.test.tsx` — `isMarkViewedRequest`/`createNoContentResponse` helpers; 4 existing E2E tests updated to mock the new `/mark-viewed` call. `EntryTile.test.tsx` — badge rendering tests. `ListCardHome.test.tsx` — new file covering badge display.
15. Ran `cd C:/develop/endgame_grocery/backend && node --test src/db/migrations.test.js src/entries.test.js src/lists.test.js` — **38/38 pass**.
16. Ran `npm run test -w @endgame-grocery/frontend -- --run src/components/EntryTile/EntryTile.test.tsx src/components/ListCardHome/ListCardHome.test.tsx` — **10/10 pass**.
17. Ran `npm run test -w @endgame-grocery/frontend -- --run src/app.test.tsx` — **37/37 pass**.
18. Ran `npm test` (full suite) — **449/449 pass across 33 test files**.
19. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `is_changed` uses `lv.last_viewed_at IS NOT NULL AND ...` rather than the plan's `COALESCE(lv.last_viewed_at, '-infinity')`. This means users who have never opened a list do not see all its entries flagged — a deliberate UX improvement over the plan baseline. ✅ (deviation accepted: better UX, same intent)
- `changed_count` in the GET /api/lists response comes back as a string from Postgres; the test correctly uses `Number()` to parse it. ✅
- `markListViewed()` uses `queueable: false`, which is correct — view-tracking side-effects should not be retried offline. ✅
- Done entries with `is_changed` appear in `visibleEntries` so the badge is visible before the item scrolls away. ✅

##### Risks
- The `is_changed` flag is cleared client-side via `clearChangedFlags()` immediately after `markListViewed` succeeds. A race condition is theoretically possible if the server receives the mark-viewed before the entry query returns, but in practice entries are fetched first and mark-viewed is called after, so the risk is negligible.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-010 — Fix Badge Overflow and Done-Item Section

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-29

#### Findings
- No issues found. Both bugs are correctly fixed, the abstraction in `getRecentlyUsedDisplayState` is cleaner than the inline approach the plan specified, and all tests pass.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-010.
2. Ran `git diff HEAD --name-only` — confirmed exactly: `EntryTile.module.css`, `EntryTile.test.tsx`, `RecentlyUsedSection.module.css`, `RecentlyUsedSection.test.tsx`, `RecentlyUsedSection.tsx`, `ListDetailPage.tsx`, `ListDetailPage.test.tsx` (in `pages/`), `useListDetailData.ts`, `recentlyUsedState.ts`, `recentlyUsedState.test.ts`, `README.md`. No unexpected files.
3. **`EntryTile.module.css`**: `.entry-tile` gains `overflow: hidden`; `.entry-tile-change-badge` changes to `top: 0; right: 0; border-radius: 0 0 0 999px`; no `transform: translate(50%, -50%)`. ✅
4. **`RecentlyUsedSection.module.css`**: `.recently-used-chip` gains `position: relative; overflow: hidden`; new `.recently-used-change-badge` rule with identical positioning pattern. ✅
5. **`RecentlyUsedSection.tsx`**: `changedDoneTexts?: ReadonlySet<string>` prop added; badge rendered conditionally via `isChangedDone`. ✅
6. **`recentlyUsedState.ts`**: New `getRecentlyUsedDisplayState()` function computes `changedDoneTexts` (Set of done+is_changed entry texts) and `visibleRecentlyUsed` (changed-done items prepended, then filtered history excluding already-shown texts). `filterRecentlyUsedItems` preserved for backward compatibility. ✅
7. **`ListDetailPage.tsx`**: `visibleEntries = openEntries` (only `status === "open"`); `getRecentlyUsedDisplayState` replaces direct `filterRecentlyUsedItems` call; `changedDoneTexts` passed to `RecentlyUsedSection`. ✅
8. **`useListDetailData.ts`**: `.then(() => setEntries(clearChangedFlags(...)))` removed from `markListViewed` call — now fire-and-forget. `clearChangedFlags` helper deleted. ✅
9. **`ListDetailPage.test.tsx`**: Changed badge test updated — asserts open section shows "New" but NOT "Bread" (done+changed); recently used section shows "Bread" and "Done" badge; after `markViewedRequest.resolve()` the badges remain (server-side, cleared on next load). ✅
10. **`recentlyUsedState.test.ts`**: New test for `getRecentlyUsedDisplayState` — verifies "Bread" (done+is_changed) surfaces with details, "Milk" (open) excluded from recently used, "Tomatoes" (pure history) still present, no duplicate. ✅
11. **CSS tests in `EntryTile.test.tsx` and `RecentlyUsedSection.test.tsx`**: Use `readFileSync` to assert CSS rule structure — `overflow: hidden` on parent, `top: 0; right: 0; border-radius: 0 0 0 999px` on badge, no translate rule. ✅
12. **`README.md`**: Updated to clarify that `mark-viewed` "records the open so badges disappear on the next list load" (not immediately), and documents done+changed entries surfacing in Recently Used. ✅
13. Ran `npm run test -w @endgame-grocery/frontend -- --run src/components/EntryTile/EntryTile.test.tsx src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx src/pages/recentlyUsedState.test.ts src/pages/ListDetailPage.test.tsx` — **33/33 pass**.
14. Ran `npm test` (full suite) — **453/453 pass across 33 test files**.
15. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `getRecentlyUsedDisplayState` is a better abstraction than the inline `changedDoneTexts` computation the plan described; it's co-located with `filterRecentlyUsedItems` and independently tested. ✅
- Changed done entries are prepended to `visibleRecentlyUsed`, ensuring they appear at the top of the recently used section for visibility. ✅
- Deduplication is correct: if a changed-done entry text also appears in the user's history, it is shown once (as the changed-done version) and not duplicated from history. ✅
- The `max-width: calc(100% - 12px)` on badges provides a soft truncation limit even with `overflow: hidden` on the parent; valid belt-and-suspenders defence. ✅

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-011 — Badge Corner Radius Precision and Self-Done Badge

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-29

#### Findings
- No issues found. All three fixes are minimal and precise; the self-done badge logic correctly preserves `is_changed: true` across both the optimistic path and the server-result path (including offline-queued).

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-011.
2. Ran `git diff HEAD --name-only` — confirmed: `EntryTile.module.css`, `EntryTile.test.tsx`, `RecentlyUsedSection.module.css`, `RecentlyUsedSection.test.tsx`, `ListDetailPage.test.tsx`, `useListDetailData.ts`, `README.md`. No unexpected files.
3. **`EntryTile.module.css`**: `.entry-tile-change-badge` border-radius changed from `0 0 0 999px` → `0 calc(var(--radius-md) - 1px) 0 0`. Top-right matches inner card corner (12px − 1px border = 11px); bottom-left is now 0. ✅
4. **`RecentlyUsedSection.module.css`**: Same change applied to `.recently-used-change-badge` — `0 calc(var(--radius-md) - 1px) 0 0`. ✅
5. **`useListDetailData.ts` — `toggleStatus`**:
   - `isCompletingEntry = nextStatus === "done"` extracted for reuse. ✅
   - Optimistic entry spreads `...(isCompletingEntry ? { is_changed: true } : {})`. ✅
   - Server-result (non-queued) path: `{ ...(result.entry as DetailEntry), ...(isCompletingEntry ? { is_changed: true } : {}) }` — overrides server's `is_changed: false`. ✅
   - Queued path: also adds `is_changed: true`. ✅
   - Error-rollback reverts to original entry (no badge on failure). ✅
   - All three existing `nextStatus === "done"` checks refactored to `isCompletingEntry`. ✅
6. **CSS tests** (`EntryTile.test.tsx`, `RecentlyUsedSection.test.tsx`): regex assertions updated to match `calc(var(--radius-md) - 1px)`. ✅
7. **`ListDetailPage.test.tsx`**: New test "shows a Done badge immediately when the current user completes an item" — `updateEntry` returns a never-resolving promise to freeze on the optimistic state; asserts Milk leaves open section and appears in recently used with "Done" badge. ✅
8. **`README.md`**: Updated to add "including items completed locally in the current session". ✅
9. Ran `npm run test -w @endgame-grocery/frontend -- --run src/components/EntryTile/EntryTile.test.tsx src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx src/pages/ListDetailPage.test.tsx` — **27/27 pass**.
10. Ran `npm test` (full suite) — **454/454 pass across 33 test files**.
11. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `border-radius: 0 calc(var(--radius-md) - 1px) 0 0` correctly describes top-left:0, top-right:11px, bottom-right:0, bottom-left:0 — the badge aligns flush with the card's inner corner. ✅
- The self-done `is_changed: true` override is applied after spreading `result.entry`, so the server's authoritative value for all other fields is respected while only this local UX state is preserved. ✅
- Error rollback does not include the `is_changed: true` override — if the toggle fails the optimistic state is discarded, which is correct behaviour. ✅

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-012 — Fix Re-Add to Open Duplicating Item in Recently Used

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-29

#### Findings
- No issues found. The fix is a single-line guard that exactly matches the plan's specification. Existing tests preserved, new test covers the scenario precisely.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-012.
2. Ran `git diff HEAD --name-only` — confirmed: `recentlyUsedState.ts`, `recentlyUsedState.test.ts`, `README.md`. No unexpected files.
3. **`recentlyUsedState.ts`**: `openTexts` set built from `openEntries.filter(e => e.status === "open").map(e => e.text)` before the loop; `|| openTexts.has(entry.text)` added to the skip condition. ✅
4. The `.filter(e => e.status === "open")` on `openEntries` is redundant (callers already pass only open entries) but harmless and defensive. ✅
5. **`recentlyUsedState.test.ts`**: New test "does not surface changed done entries when a matching entry is open" — entries has both `open` and `done` "Bread" with `is_changed: true`, `openEntries` has "Bread" as open; asserts `changedDoneTexts` does not contain "Bread" and `visibleRecentlyUsed` contains only "Tomatoes". ✅
6. **`README.md`**: Updated to add "if the same item text is open again, Recently Used suppresses the older done entry." ✅
7. Ran `npm run test -w @endgame-grocery/frontend -- --run src/pages/recentlyUsedState.test.ts` — **8/8 pass**.
8. Ran `npm test` (full suite) — **455/455 pass across 33 test files**.
9. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- The fix correctly uses `openEntries` (already filtered to open status at the call site in `ListDetailPage.tsx`) to build `openTexts`, then suppresses any `done+is_changed` entry whose text matches an open entry. ✅
- The existing "surfaces changed done entries" test still passes, confirming no regression on the normal case where no matching open entry exists. ✅

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-013 — Restore Dismiss Controls on Recently-Used Chips

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-31

#### Findings
- No issues found. Implementation matches the plan specification exactly and all acceptance criteria are met.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` acceptance criteria for T-013.
2. Read `.ai/HANDOFF.md` for the T-013 implement entry — confirmed files changed match expected scope.
3. Ran `git diff HEAD` on all T-013 files to verify each change.
4. **`backend/src/routes/history.js`**: `DELETE /` handler added; checks list access, validates `req.body.text` (returns 400 on empty), then `DELETE FROM entries WHERE list_id=$1 AND text=$2 AND status='done'`; returns 204. Open entries with the same text are unaffected. ✅
5. **`backend/src/history.test.js`**: Former `returns 404 because individual history deletion is not supported` test replaced with three new DELETE tests: deletes done entries (204), idempotent on missing item (204), SQL does not match open entries. ✅
6. **`frontend/src/api/history.ts`**: `deleteFromHistory(listId, text, token)` added — `DELETE /api/lists/:id/history` with `{ text }` payload. ✅
7. **`frontend/src/pages/ListDetailPage/useListDetailData.ts`**: `dismissRecentlyUsedEntry` added — optimistically removes item from `recentlyUsed` state, then fire-and-forget `deleteFromHistory` with `console.error` on failure. Returned from hook. ✅
8. **`frontend/src/pages/ListDetailPage/ListDetailPage.tsx`**: `dismissRecentlyUsedEntry` destructured and passed as `onDismiss` to `<RecentlyUsedSection>`. ✅
9. **`frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.tsx`**: `onDismiss?: (text: string) => void` prop added; dismiss `<button>` rendered as sibling to `.recently-used-chip` inside `.recently-used-cell` when `onDismiss && !isChangedDone`. Button uses `t("recent.dismiss", { name: item.text })` as aria-label. ✅
10. **`frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.module.css`**: `.recently-used-cell` has `position: relative`; `.recently-used-chip-dismiss` is `position: absolute; top: 4px; right: 4px; width: 20px; height: 20px` with hover/focus styling. ✅
11. **i18n**: `"recent.dismiss": "Dismiss {name}"` (en), `"recent.dismiss": "{name} ausblenden"` (de). ✅
12. **`README.md`**: Updated to document dismiss-chips behavior. ✅
13. **Tests**:
    - `RecentlyUsedSection.test.tsx`: dismiss button present and calls `onDismiss("Bread")`; hidden when `changedDone` badge active. ✅
    - `ListDetailPage.test.tsx`: "dismisses a recently used entry optimistically" test. ✅
    - `app.test.tsx`: E2E — dismiss button present, click fires DELETE request, recently-used section disappears when all items dismissed. ✅
14. Ran `cd C:/develop/endgame_grocery/backend && node --test src/history.test.js` — **7/7 pass**.
15. Ran `npm run test -w @endgame-grocery/frontend -- --run src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx src/pages/ListDetailPage.test.tsx` — **20/20 pass**.
16. Ran `npm run test -w @endgame-grocery/frontend -- --run src/app.test.tsx` — **37/37 pass**.
17. Ran `npm test` (full suite) — **457/457 pass across 33 test files**.
18. Ran `npm run lint` — pass (0 errors; 1 pre-existing warning).

##### Findings
- `dismissRecentlyUsedEntry` is fire-and-forget (no rollback on API failure); this matches the plan specification exactly and is acceptable for removing stale history. ✅
- DELETE endpoint is scoped to `status = 'done'` — open entries with the same text are never touched. ✅
- Dismiss button suppressed when `changedDone` badge is active — dismissal not appropriate until badge is acknowledged. ✅
- All three backend DELETE tests cover the idempotency contract and open-entry safety guard. ✅

##### Risks
- If `deleteFromHistory` fails silently, the item stays removed from the client's in-memory recently-used list but persists in the DB until reload. Consistent with the plan's fire-and-forget design; acceptable.

#### Open Questions
- None.

#### Verdict
`PASS`
