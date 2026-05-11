# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `.ai/TASKS.md` — T-001 moved to `in_review`.
2. Read `.ai/PLAN.md` — implementation requirements confirmed: substring-match third pass in `getExactOrPrefixIcon`, minimum length guard of 4, longest-match wins, 2 new tests asserting no worker call.
3. Read `frontend/src/hooks/useIconSuggestion.js` — implementation reviewed against plan.
4. Read `frontend/src/hooks/useIconSuggestion.test.js` — new tests reviewed against acceptance criteria.
5. Verified `EXACT_MATCH_MAP` key construction in `iconDatabase.js`: `toLookupKey` = `trim().toLowerCase()`, so "möhren" → key "möhren" (IconCarrot) and "paprika" → key "paprika" (CustomBellPepper). Compound-word assertions are grounded in real data.
6. `npm run lint` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-001).
7. `npm run build` — PASS (pre-existing bundle/eval warnings only).
8. `npx vitest run --environment jsdom useIconSuggestion` — 7/7 tests PASS including both new compound-word tests.
9. Full test suite `npx vitest run --environment jsdom` — 272/272 tests PASS, 23 test files, no regressions.

##### Findings

- Implementation matches the plan exactly: substring-match loop added after exact and prefix passes, `term.length >= 4` guard present, longest-match selection via `term.length > bestSubstringLength`.
- Both acceptance-criteria cases pass: `useIconSuggestion("Spritzpaprika")` → `CustomBellPepper` (sync, no worker), `useIconSuggestion("Minimöhren")` → `IconCarrot` (sync, no worker).
- Existing tests unaffected.
- Lint and build clean relative to this change.

##### Risks

- None. The substring scan iterates `EXACT_MATCH_MAP` (frozen object); cost is proportional to the number of entries and runs only when exact-match and prefix checks both miss — negligible for interactive input.

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

- **nit** — `cucumber.svg` sets `stroke-width="1.5"` explicitly on the root element, while `bellPepper.svg` and `tomato.svg` omit this attribute (inheriting the SVG default of 1 when rendered standalone). The plan explicitly requires `stroke-width="1.5"`, so the implementation is correct per spec. Pre-existing inconsistency in the reference icons; not a required fix.

#### Verification

##### Steps

1. Read `frontend/src/assets/icons/custom/cucumber.svg` — SVG reviewed in full.
2. Read `bellPepper.svg` and `tomato.svg` — compared root SVG attributes and path count for visual weight.
3. Verified `customIcons.js` already imports and exports `CustomCucumber` from `cucumber.svg?react` — no registry changes needed.
4. Verified `iconDatabase.js` already registers `CustomCucumber` with tags "gurke", "gurken", etc. — no database changes needed.
5. Confirmed no `fill` attributes on any `<path>` — only `fill="none"` on root element.
6. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-002).
7. `npx vite build` — PASS (pre-existing ONNX eval and chunk-size warnings only).
8. `npx vitest run --environment jsdom` — 272/272 tests PASS, no regressions.

##### Findings

- All required SVG attributes present: `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`. ✓
- No hardcoded colours on root or any path. ✓
- Five paths: 1 diagonal closed body shape, 1 short stem nub at the narrow (top-right) end, 3 short diagonal texture strokes evenly spaced across the body. Satisfies "diagonal body, stem nub, 2–3 texture lines". ✓
- Icon is already registered as `CustomCucumber` — no JS, registry, or test-file changes were needed or made. ✓
- Lint and build clean relative to this change.

##### Risks

- None. Pure SVG asset replacement; no logic paths affected.

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

- **nit** — `toggleStatus` settle-on-queued spreads `{ is_pending_sync: true, status: nextStatus }` where the plan specified only `{ is_pending_sync: true }`. The extra `status: nextStatus` is a safe improvement that keeps state consistent when the API queues the request. Not a required fix.

#### Verification

##### Steps

1. Read `frontend/src/pages/ListDetailPage.jsx` — `toggleStatus` and `addEntryByText` reviewed in full against plan.
2. Read `frontend/src/pages/ListDetailPage.test.jsx` — all 3 new optimistic-update tests reviewed.
3. Verified English translation keys: `entry.markDone` → "Mark {name} done", `common.queued` → "Queued", `recent.sectionLabel` → "Recently Used" — all match test assertions.
4. Confirmed `handleDeleteEntry` is still present — correct; T-005 removes it, not T-004.
5. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-004).
6. `npx vitest run --environment jsdom ListDetailPage.test.jsx --reporter=verbose` — 6/6 tests PASS, including all 3 new optimistic-update tests.
7. Full test suite `npx vitest run --environment jsdom` — 275/275 tests PASS (272 prior + 3 new), no regressions.
8. `npx vite build` — PASS.

##### Findings

- `toggleStatus`: optimistic state update fires before `await updateEntry`; revert in `catch` restores original entry and removes from recentlyUsed on error. ✓
- `addEntryByText`: temporary entry inserted before `await createEntry`; replaced with server entry on success, removed on error. ✓
- Both functions use `updateEntries` (which writes to the offline cache via `writeCachedResource`) ensuring offline-queue consistency. ✓
- Test 1 — toggle removes entry from open list before API resolves. ✓
- Test 2 — revert restores entry and shows error banner when API rejects. ✓
- Test 3 — history reactivation shows temp entry with "Queued" chip immediately. ✓

##### Risks

- None. Optimistic pattern is self-contained in `toggleStatus` and `addEntryByText`; SSE events and `loadEntries` will reconcile server state on reconnect as before.

---

## Task: T-005

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

- **nit** — `recently-used-chip` CSS omits `user-select: none; -webkit-user-select: none;` (present in the plan spec). The chip is a `<button>` element; browsers do not select button text on tap by default, so the omission is harmless. Not a required fix.
- **nit** — `useLongPress.js` adds a `useEffect` cleanup (`clearTimeout(timerRef.current)` on unmount) and clears any running timer at the top of `start()` that the plan pseudo-code didn't include. Both are defensive improvements over the spec. Not a required fix.

#### Verification

##### Steps

1. `git diff --name-status HEAD` — confirmed: `EntryRow.jsx` deleted (D), `entry-row.test.jsx` deleted (D), `EntryTile.jsx` added (A), `entry-tile.test.jsx` added (A), `useLongPress.js` added (A), `useLongPress.test.jsx` added (A), `RecentlyUsedSection.jsx` modified, `RecentlyUsedSection.test.jsx` modified, `ListDetailPage.jsx` modified, `app.test.jsx` modified, `index.css` modified.
2. Read `useLongPress.js` — hook matches plan with unmount cleanup and rapid-press guard added.
3. Read `EntryTile.jsx` — component matches plan exactly; `Icon` import dropped (not needed, correct).
4. Read `entry-tile.test.jsx` — 7 tests covering all plan-specified scenarios.
5. Read `useLongPress.test.jsx` — 4 tests covering all plan-specified scenarios.
6. Read `RecentlyUsedSection.jsx` — `recently-used-grid` / `recently-used-cell` structure matches plan; `aria-label` on dismiss button uses `recent.dismiss` key.
7. Read `RecentlyUsedSection.test.jsx` — updated to use `.recently-used-grid` and `.recently-used-cell` selectors; dismiss button asserted by `"Dismiss {name}"` aria-label. Added second test for fallback icon.
8. Verified `ListDetailPage.jsx` imports `EntryTile` (not `EntryRow`); `handleDeleteEntry` and `deleteEntry` import removed; entries wrapped in `<div className="entry-tile-grid">`.
9. Verified `app.test.jsx` uses `"Mark {name} done"` aria-label — works with `EntryTile` since it uses the same i18n key. No `.entry-row` or swipe-delete references remain.
10. Verified `index.css`: tile grid rules present; old `.entry-row*` and `.recently-used-list` / `.recently-used-chip-row` rules removed.
11. English translations: `entry.markDone` → "Mark {name} done", `common.queued` → "Queued", `recent.dismiss` → "Dismiss {name}" — all match test assertions.
12. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`).
13. `npx vitest run --environment jsdom useLongPress.test.jsx entry-tile.test.jsx RecentlyUsedSection.test.jsx` — 13/13 PASS.
14. Full suite `npx vitest run --environment jsdom` — 283/283 tests PASS (24 test files), no regressions.
15. `npx vite build` — PASS.

##### Findings

- `useLongPress`: timer cleanup on unmount prevents leaked timers; `longPressedRef` and `defaultPrevented` pattern correctly suppresses the synthetic toggle click after a long-press. ✓
- `EntryTile`: long-press → `onEdit` fires and `onToggle` is blocked; short tap → `onToggle` fires. ✓
- `handleDeleteEntry` fully removed from `ListDetailPage`; `deleteEntry` import also removed. ✓
- `RecentlyUsedSection` grid structure matches plan; dismiss badge is absolutely-positioned inside the cell. ✓
- Old `EntryRow.jsx` and `entry-row.test.jsx` deleted; no orphan CSS rules remain. ✓
- All 11 plan-specified tests present and passing. ✓

##### Risks

- None. `EntryRow` was the only consumer of `handleDeleteEntry`; its removal is self-contained. SSE-triggered `handleEntryChange` still calls `loadEntries` to reconcile server state.

---

## Task: T-006

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

- **nit** — Implementation goes beyond the two plan-specified `max-height` rules: `.bottom-sheet--browser-open` also gains `display: flex; flex-direction: column; overflow: hidden;` and a flex-chain down through `.add-item-form`, `.add-item-disclosure`, `.add-item-icon-browser`, `.add-item-icon-browser-inner`, and `.add-item-icon-browser-grid`. This is necessary to make the icon grid actually scrollable within the constrained viewport height, satisfying the acceptance criterion about scrollability. Test assertions cover the complete set of rules. Not a required fix.

#### Verification

##### Steps

1. `git diff --name-status HEAD` — confirmed only `frontend/src/index.css` and `frontend/src/components/AddItemSheet.test.jsx` modified. No JS changes. ✓
2. Read `index.css` lines 525–548: `.bottom-sheet` uses `max-height: min(80dvh, 44rem)` (was `80vh`); `.bottom-sheet--browser-open` uses `max-height: min(92dvh, 44rem)`. ✓
3. Confirmed no remaining `80vh` reference: searched `index.css` for `vh` — none found in `bottom-sheet` rules.
4. Reviewed additional flex-column chain rules at lines 852–868 and 1076–1101: they create a scrollable flex column inside the constrained sheet so the icon grid overflows-y correctly on small viewports.
5. Read `AddItemSheet.test.jsx`: new test `"uses dynamic viewport height for the icon browser sheet"` (line 332–334) asserts `min(80dvh, 44rem)` and `min(92dvh, 44rem)` and the absence of legacy `min(80vh, 44rem)`. All 14 AddItemSheet tests pass.
6. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`).
7. `npx vitest run --environment jsdom AddItemSheet.test.jsx` — 14/14 PASS.
8. Full suite `npx vitest run --environment jsdom` — 284/284 tests PASS, no regressions.

##### Findings

- `dvh` (dynamic viewport height) replaces `vh` in `.bottom-sheet` — shrinks automatically when iOS/Android software keyboard appears. ✓
- `.bottom-sheet--browser-open` uses `min(92dvh, 44rem)` giving more room for the icon browser when open. ✓
- Inner flex-chain rules ensure the icon grid is scrollable when the sheet is height-constrained. ✓
- No JS changes, no test-file changes beyond the new CSS assertion. ✓
- `dvh` supported in Chrome 108+, Safari 15.4+, Firefox 101+ — covers all current mobile targets. ✓

##### Risks

- None. `dvh` has broad browser support; fallback to `vh` is not needed. The flex-chain rules only apply under `.bottom-sheet--browser-open` and do not affect the default sheet layout.

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-11

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `frontend/src/index.css` around the changed block (lines 1225–1235).
2. Confirmed the combined selector was split correctly: `.list-card, .sharing-panel` retains all card styles (border, border-radius, background, padding); `.entry-section` now contains only `padding: var(--space-2) 0;`.
3. Verified `detail-content` still applies `padding: 0 16px` — items are not flush with screen edges.
4. Checked `RecentlyUsedSection.jsx`: applies `className="entry-section recently-used-section"` on the root element — flat treatment inherited automatically from `.entry-section`.
5. Confirmed no stray `border`, `border-radius`, or `background` declarations remain on `.entry-section`.
6. `npx eslint .` — PASS (1 pre-existing Fast Refresh warning in `AuthContext.jsx`, unrelated to T-003).
7. `npx vitest run --environment jsdom` — 272/272 tests PASS, no regressions.

##### Findings

- `.list-card` and `.sharing-panel` card appearance unchanged. ✓
- `.entry-section` has no border, no border-radius, no background; only vertical padding `var(--space-2) 0`. ✓
- Sections retain vertical separation via `padding` and the pre-existing `.entry-section + .entry-section` rule (line 1292). ✓
- `.recently-used-section` inherits flat treatment via dual class on the JSX element. ✓
- `.detail-content` side padding (16px) prevents items being flush with screen edge. ✓
- No JS, test, or documentation file changes were needed or made. ✓

##### Risks

- None. CSS-only selector split; no layout regressions detected in the test suite.
