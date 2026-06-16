# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-06-16

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/context/AuthContext.tsx:158` | Pre-existing Fast Refresh ESLint warning — not introduced by T-001 | No |
| 2 | nit | `frontend/vite.config` (build output) | Pre-existing chunk-size warning (index-*.js ~549 kB) — not introduced by T-001 | No |
| 3 | minor | `frontend/src/pages/OverviewPage/OverviewPage.test.tsx` | "OverviewPage sorting > renders the sort control and persists immediate reordering" produced a transient failure on the first `npm test` run (timing-sensitive: `findByRole("combobox")` resolves on the first render before the async API call completes, so `getAllByRole("article")` can fail). The test is unchanged from main and passed on a second full run (481/481). A defensive `await screen.findByText("Apples")` before `getRenderedListNames()` would eliminate the flakiness, but this test was not part of T-001 scope. | No (pre-existing flakiness; not introduced by T-001 and passed on rerun) |
| 4 | nit | `e2e/lists.spec.js` | E2E test `keeps overview controls visible at a 320px viewport` could not be run independently in this review session (no dev-server available); implementer reported pass. | No |

#### Verification

##### Steps
1. Read `.ai/PLAN.md` — confirmed plan targets `OverviewPage.tsx` and `OverviewPage.module.css` with `overview-brand-left` class and flex-sizing rules.
2. Read `frontend/src/pages/OverviewPage/OverviewPage.tsx` — confirmed `className={styles["overview-brand-left"]}` added to the brand-left wrapper div (line 192).
3. Read `frontend/src/pages/OverviewPage/OverviewPage.module.css` — confirmed:
   - `.overview-brand-left { min-width: 0; flex-shrink: 1; }` added (lines 28–31).
   - `flex-shrink: 0` added to `.overview-actions` (line 52).
   - `@media (max-width: 480px)` block retains `flex-wrap: wrap-reverse` on `.overview-actions` and `flex-basis: 100%` on `.overview-sort-control`.
4. Read `frontend/src/pages/page-components.test.ts` — confirmed:
   - `"overview-brand-left"` added to `moduleClasses.OverviewPage` array.
   - New test `"keeps the overview mobile actions visible while the sort control wraps"` verifies all four CSS invariants (class assignment in TSX, `min-width`/`flex-shrink` on brand-left, `flex-shrink: 0` on actions, media query wrap rules).
5. Read `e2e/lists.spec.js` — confirmed new test `"keeps overview controls visible at a 320px viewport"` at 320 px: checks settings button and sort select are visible, their bounding boxes are within viewport, and sort dropdown is below the logo/settings row.
6. Ran `git stash && npm test && git stash pop` — confirmed 480/480 tests pass on main branch (without T-001 changes).
7. Ran `npm run lint` — 0 errors, 1 pre-existing warning (AuthContext.tsx Fast Refresh).
8. Ran `npm run build` — clean build with pre-existing chunk-size warning only.
9. Ran `npm test` (first run) — 1 transient failure: "OverviewPage sorting > renders the sort control and persists immediate reordering". Test is unchanged from main; failure is timing-sensitive (combobox found before async API resolves).
10. Ran `npm test` (second run) — 481/481 tests pass (37 test files).

##### Findings
- All plan-specified code changes are present, correct, and match the implementation plan exactly.
- No logic regressions. No new lint errors. Build is clean.
- The transient test failure is a pre-existing timing fragility in an unmodified test; it did not re-appear on the second full run.
- E2E not independently run; accepted on implementer's reported evidence.

##### Risks
- `OverviewPage sorting > renders the sort control and persists immediate reordering` is timing-sensitive and may occasionally flake in CI. Not a T-001 regression; acceptable for now.
- E2E test relies on a live server; could not be verified in isolation during this review.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

### Review Round 2

Status: **complete**

Reviewed: 2026-06-16

Context: Plan reworked after Round 1 PASS_WITH_NOTES revealed brand title clipping regression.
New approach: structural separation — sort-select moved to its own `.overview-sort-row` sibling
below `.overview-brand`, so `.overview-actions` contains only logo + settings button (~88 px)
and can safely use `flex-shrink: 0` without crowding the title.

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/context/AuthContext.tsx:158` | Pre-existing Fast Refresh ESLint warning — unchanged | No |
| 2 | nit | Build output | Pre-existing chunk-size warning — unchanged | No |
| 3 | minor | `OverviewPage.module.css:35,44` | `letter-spacing` reduced from `0.06em` → `0` on `.overview-brand-title` and from `0.2em` → `0` on `.overview-brand-sub`. Not mentioned in the plan. This compacts the text, helping prevent clipping, but is a visual design change to the brand typography. No test verifies or guards this value. | No (beneficial side-effect; no assertion regression) |
| 4 | nit | `e2e/lists.spec.js` | E2E test `"keeps overview controls visible without clipping the brand"` could not be independently run (no live server). Implementer reported pass. | No |

#### Verification

##### Steps
1. Read `.ai/PLAN.md` (reworked) — structural separation approach: sort row moved below brand row.
2. Read `OverviewPage.tsx` — sort control is now a `.overview-sort-row` sibling of `.overview-brand`; `.overview-actions` contains only logo + settings button. Matches plan exactly.
3. Read `OverviewPage.module.css` — confirmed:
   - `.overview-brand`: `gap: 8px`, no `margin-bottom` ✅
   - `.overview-brand-left { min-width: 0; flex-shrink: 1 }` ✅
   - `.overview-actions { flex-shrink: 0 }` ✅
   - `.overview-sort-row { display: flex; justify-content: flex-end; margin-bottom: 12px }` ✅
   - `.overview-sort-control` rule removed ✅
   - `@media (max-width: 480px)` block removed ✅
   - `letter-spacing: 0` on brand title and sub (not in plan; see Finding 3).
4. Read `page-components.test.ts` — `"overview-sort-row"` added to `moduleClasses.OverviewPage`; previous mobile-media-query test replaced by `"keeps the overview sort control in its own row below the brand actions"` which verifies structural DOM order, CSS rules for brand-left/actions/sort-row, absence of `.overview-sort-control`, and absence of the `@media (max-width: 480px)` block. ✅
5. Read `e2e/lists.spec.js` — reworked test loops over 320 px and 900 px viewports; checks title/subtitle not clipped (`scrollWidth <= clientWidth + 1`); checks all elements within viewport; checks `sortBox.y >= brandBottom` (sort row is below brand row). More robust than Round 1 E2E. ✅
6. Ran `npm run lint` — 0 errors, 1 pre-existing warning. ✅
7. Ran `npm run build` — clean, pre-existing chunk-size warning only. ✅
8. Ran `npm test` — **481/481 pass** (37 test files). No transient failures observed. ✅

##### Findings
- All plan-specified structural and CSS changes are present and correct.
- No logic regressions. No new lint errors or test failures.
- The `letter-spacing: 0` change is the only delta from the plan; it is visually harmless and arguably beneficial.
- E2E not independently run; accepted on implementer's reported evidence.

##### Risks
- `letter-spacing: 0` on the Orbitron brand title may affect design intent; consider a follow-up design review if the typography change is not desired.
- E2E relies on a live server and could not be independently verified.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
