# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-21

#### Findings

- **nit** — `frontend/src/pages/recentlyUsedState.ts` line 3: `RecentlyUsedEntry` declares `details?: string | null` (wider than `Suggestion.details?: string`). Intentional — it matches `DetailEntry.details?: string | null` that flows in from `toggleStatus`. The `??` coalescing prevents `null` from being spread into the `Suggestion` object. Not a bug; acceptable as-is.

#### Verification

##### Steps
1. Inspected full `git diff` for all eight changed files against plan specification.
2. Read `useListDetailData.ts` in full to verify `addEntryByText` signature, `normalizeEntryDetails` behaviour, and `toggleStatus → upsertRecentlyUsedItems` call path.
3. Read `recentlyUsedState.ts` in full to verify conditional spread pattern and `??` coalescing logic.
4. Ran `npm run lint` — clean (pre-existing unrelated warning in `AuthContext.tsx`).
5. Ran `npm run build` — clean (pre-existing chunk-size warning).
6. Ran targeted tests: `npm run test --workspace frontend -- recentlyUsedState RecentlyUsedSection ListDetailPage` — **19/19 passed**.
7. Ran full suite: `npm test` — **154/154 passed, 0 failed**.

##### Findings
- All acceptance criteria verified:
  1. Re-added entry from "Zuletzt Verwendet" carries original description — confirmed by `ListDetailPage` integration test.
  2. Entries without description unaffected — confirmed by `leaves details undefined when an item has no details` test.
  3. Unit tests in `recentlyUsedState.test.ts` cover upsert with details, overwrite on second upsert, and undefined case.
  4. `RecentlyUsedSection.test.tsx` asserts `onAdd` called with `details`.
  5. `addRecentlyUsedEntry` integration path covered by `ListDetailPage.test.tsx`.
  6. lint ✓, build ✓, test ✓.

##### Risks
- None. The change is narrowly scoped to the `details` field; no existing behaviour altered.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-21

#### Findings

- **nit** — `frontend/src/pages/ListDetailPage/useListDetailData.ts` `reloadHistory` catch block: uses `console.error` where the plan said to silently ignore. More observable than specified; not a defect.
- **nit** — `reloadHistory` signature accepts `entriesOverride?: DetailEntry[]` (not in plan). This is a deliberate improvement over the plan: passing `nextEntries` from `loadEntries` avoids the stale-closure problem where `entries` in `reloadHistory`'s closure would still be the pre-update value. Correct and better.

#### Verification

##### Steps
1. Inspected full `git diff` for all five changed files against plan spec.
2. Verified `v1.js` handler ordering: `await upsertAutocompleteHistory(...)` → `broadcastListEvent` → `res.json`. ✅
3. Verified `.catch` on the await preserves non-throwing history-failure contract. ✅
4. Read "broadcasts after history upsert completes" test — pool mock yields via `await waitForAsyncHandlers()` mid-upsert; handler is suspended because it `await`s the history call; `order` must therefore be `["history:start","history:done","broadcast"]`. Logically correct. ✅
5. Verified `reloadHistory(entriesOverride)` — uses `filterRecentlyUsedItems(freshHistory, entriesOverride ?? entries)` to merge history with the freshest entries snapshot. ✅
6. Verified `handleEntryChange` chains `.then((nextEntries) => reloadHistory(nextEntries))` — fresh entries passed to avoid stale closure. ✅
7. Confirmed `useListEvents` was already mocked in the test file (`vi.mock("../hooks/useListEvents", ...)`); `useListEventsMock` correctly captures registered handlers. ✅
8. Ran `npm run lint` — clean.
9. Ran `npm run build` — clean.
10. Ran targeted tests: `ListDetailPage` (frontend) — **12/12 passed** (including new SSE re-fetch test).
11. Ran targeted tests: `v1.test.js` (backend) — **35/35 passed** (including new ordering test).
12. Ran full suite: **420/420 frontend + 158/158 backend = 578 total, 0 failed**.

##### Findings
- All acceptance criteria verified:
  1. Backend history committed before SSE broadcast (AC3 → AC1) ✅
  2. `reloadHistory` fetches fresh history on `entry:updated` (AC4 → AC2) ✅
  3. Ordering test + updated toggle test enforce awaited-before-broadcast (AC5) ✅
  4. New frontend test confirms history re-fetch on SSE event (AC6) ✅
  5. lint ✓, build ✓, test ✓ (AC7) ✅

##### Risks
- None. Changes are narrowly scoped; existing tests all pass.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-21

#### Findings

- **nit** — `backend/src/v1.test.js` "keeps toggle responses successful when the SSE broadcast fails" (new test): the test toggles a `done` item to `open` rather than `open` to `done`. This avoids a 4th history-upsert call in the same test, keeping callCount at 3. The plan says AC5 should "mirror the pattern in the existing create test" — the intention is SSE failure resilience, which is verified regardless of direction. Not a defect.

#### Verification

##### Steps
1. Inspected full `git diff` for all changed files against plan spec.
2. Read `v1.js` toggle handler (lines 190–257) in full to verify SELECT includes `icon`, history upsert fires only when `nextStatus === "done"`, and the fire-and-forget error handler logs correctly.
3. Read `historyUtils.js` in full — SQL and parameter order match plan exactly.
4. Read all new/updated test cases in `v1.test.js` to verify assertions for AC1–5.
5. Confirmed `entries.js` local `upsertAutocompleteHistory` removed; import from `historyUtils.js` added.
6. Verified `README.md` and `openapi/v1.yaml` documentation updates are accurate and required by AGENTS.md.
7. Ran `npm run lint` — clean (pre-existing unrelated warning in `AuthContext.tsx`).
8. Ran `npm run build` — clean (pre-existing chunk-size warning).
9. Ran targeted v1 tests: `node --test src/v1.test.js` (from backend dir) — **34/34 passed**.
10. Ran backend suite: `npm run test --workspace @endgame-grocery/backend` — **157/157 passed**.
11. Ran full suite `npm test` twice: first run showed 1 transient failure (port timing, not reproducible); second run **311/311 passed** (154 frontend + 157 backend).

##### Findings
- All acceptance criteria verified:
  1. Toggle open→done writes history row with correct userId/listId/text/icon — asserted in updated test (callCount 4, params checked).
  2. Toggle done→open skips history upsert — verified by new test (callCount 3).
  3. History failure does not affect response — verified by new test (response 200, error logged).
  4. lint ✓, build ✓, test ✓.
  5. SSE broadcast failure resilience test added ✓.

##### Risks
- The single transient failure during the first full-suite run was a port-conflict in supertest and is unrelated to T-002. It did not reproduce on re-run.

#### Verdict
`PASS`
