# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001 — DB Migration: `autocomplete_history` + `pg_trgm`

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `backend/src/db/migrations/1713902400000_add_autocomplete_history.cjs:40` | Plan specifies `DEFAULT NOW()` for `last_used_at`; migration uses `CURRENT_TIMESTAMP`. Functionally equivalent in PostgreSQL — no impact. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read migration file against plan schema spec.
2. Read updated `migrations.test.js` for coverage completeness.
3. Ran `npm run lint` (workspace root).
4. Ran `npm run build` (workspace root).
5. Ran `cd backend && npm test` to check migration test suite.
6. Confirmed pre-existing `license.test.js` failure is due to CRLF line endings in `LICENSE` file (not introduced by T-001; documented in task Evidence).

##### Findings
- Migration schema exactly matches the plan: all columns, types, constraints, index, and cascade rules are correct.
- `up()` creates extension, table, unique constraint, and index in the correct order.
- `down()` drops index, table (cascade), and extension in correct reverse order.
- Migration test verifies exact `pgm` call signatures for both `up` and `down` — all 3 migration tests pass.
- `npm run lint`: PASS (1 pre-existing warning in `AuthContext.jsx`, unrelated to T-001).
- `npm run build`: PASS.
- `npm test`: migration suite 3/3 pass; 1 pre-existing failure in `license.test.js` (CRLF vs LF in `LICENSE`) — not introduced by this task and already documented in task Evidence.

##### Risks
- None introduced by this change. The pre-existing `license.test.js` failure should be tracked separately.

#### Verdict
`PASS`

---

## Task: T-005 — Frontend: Autocomplete Dropdown Positioning + Styling

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

No blockers, majors, minors, or nits found.

#### Verification

##### Steps
1. Read `AddItemSheet.jsx` — verified `<div className="eg-input-wrap">` wraps input + preview, `autoComplete="off"` on text input, `<AutocompleteSuggestions>` moved inside wrapper, standalone line between `.eg-field` and icon picker removed.
2. Read `index.css` lines 900–943 — verified `.eg-input-wrap { position: relative; }`, new `.autocomplete-suggestions` absolute-positioned dropdown spec, new `.autocomplete-chip` full-width row spec, `transform: translateY(-1px)` removed from hover.
3. Read updated `AutocompleteSuggestions.test.jsx` — CSS assertion extended to `min-height: 44px` **and** `width: 100%`.
4. Read updated `AddItemSheet.test.jsx` last test — verifies `.eg-input-wrap` exists, `autocomplete="off"`, listbox/option queried `within(inputWrap)`, CSS assertions for `position: relative` on wrapper and `position: absolute; top: calc(100% + 2px); left: 0; right: 0` on suggestions panel.
5. Ran `npm run lint` — PASS.
6. Ran `npm run build` — PASS.
7. Ran `cd frontend && npm test` — 59/59 PASS.
8. Ran `cd backend && npm test` — 37/37 PASS.

##### Findings
- `.eg-input-wrap { position: relative; }` correctly establishes the containing block for the absolute dropdown.
- `.autocomplete-suggestions`: `position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 200` — positions flush below input (2 px gap), same width as wrapper, overlays form content. All plan values match exactly.
- `.autocomplete-chip`: `display: flex; align-items: center; gap: 8px; min-height: 44px; width: 100%; border: none; border-radius: var(--radius-md); background: transparent; ...` — full-width rows, 44 px touch target, no pill border. All plan values match.
- Hover/focus: `background: rgba(0, 229, 255, 0.10); outline: none;` — `transform: translateY(-1px)` correctly removed.
- `autoComplete="off"` suppresses native browser autocomplete as required.
- Test: `within(inputWrap).getByRole("listbox")` confirms DOM placement inside wrapper; CSS regex assertions confirm the two key new rules are present.

##### Risks
- None introduced. `z-index: 200` is a reasonable layer for a transient overlay within the BottomSheet; the sheet itself sits above page content and this value is local to the sheet's stacking context.

#### Verdict
`PASS`

---

## Task: T-003 — Frontend: `useAutocomplete` Hook + `fetchSuggestions` API Client

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/hooks/useAutocomplete.js:85–88` | `loading` is set to `true` before the 300 ms debounce fires. The plan does not define loading behaviour during the debounce window, and this is a reasonable UX choice, but it means consumers will see `loading: true` before any network activity starts. | No |
| 2 | nit | `frontend/src/hooks/useAutocomplete.js:59–63` | `filterOfflineSuggestions` slices to 5 after filtering. Sensible and consistent with the backend `LIMIT 5`, but not explicitly required by the plan. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `frontend/src/api/suggestions.js` — verified function signature, URL template, `createCacheKey` usage, `offlineFallbackMessage`.
2. Read `frontend/src/api/client.js` — confirmed `createCacheKey`, `sendJsonRequest`, and offline `{ ...cachedValue, offline: true }` return shape.
3. Read `frontend/src/hooks/useAutocomplete.js` in full — verified debounce (300 ms), short-input guard (< 2 chars), online/offline/error branches, Levenshtein implementation, request-sequence stale-guard, cleanup return.
4. Read `frontend/src/hooks/useAutocomplete.test.js` — verified all 4 required test cases are present and exercised.
5. Ran `npm run lint` (workspace root) — PASS.
6. Ran `npm run build` (workspace root) — PASS.
7. Ran `npm test` (backend, workspace root) — 37/37 PASS.
8. Ran `cd frontend && npm test` — 54/54 PASS (4 new `useAutocomplete` tests all green).

##### Findings
- `fetchSuggestions`: URL, `cacheKey: createCacheKey("suggestions", listId)`, `offlineFallbackMessage` — all match plan exactly.
- `useAutocomplete`: `inputText.trim().length < 2` guard resets state immediately; debounce via `window.setTimeout(…, 300)` with cleanup `window.clearTimeout`; online path sets `suggestions` from `result.suggestions`; offline path (`result?.offline`) applies `filterOfflineSuggestions` (substring + Levenshtein, sorted by `useCount DESC`); error path silently resets to `[]`.
- Levenshtein: two-row iterative, O(m·n) time / O(m) space — no external library; `maxDistance = Math.floor(query.length / 4) + 1` matches plan formula.
- Request-sequence ref guards against stale responses from rapid input (good defensive addition, not over-engineered).
- All 4 plan-required tests pass; debounce test verifies exactly 299 ms = no call, 300 ms = 1 call; offline test confirms "Milch" is excluded and "Schokolade" entries survive fuzzy match.

##### Risks
- None introduced. The `loading: true` during the debounce window (nit #1) is a cosmetic UX detail only.

#### Verdict
`PASS`

---

## Task: T-007 — Frontend: Item-Icon Preview to the Right of the Input

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

No blockers, majors, minors, or nits found.

#### Verification

##### Steps
1. Confirmed changed files via `git diff` and `git status`: only `frontend/src/index.css` and `frontend/src/components/AddItemSheet.test.jsx` — exactly the two files specified in the plan. No JSX changes (as plan states "No JSX changes required").
2. Read `index.css` lines 900–910 — verified `.eg-input-wrap` changed from `flex-direction: column` to `flex-direction: row; align-items: center; gap: 10px`; `.eg-input-anchor` gained `flex: 1` alongside `position: relative`.
3. Read `git diff` of `AddItemSheet.test.jsx`:
   - Chip test CSS assertion updated: checks `flex-direction: row; align-items: center; gap: 10px` on `.eg-input-wrap` and `flex: 1; position: relative` on `.eg-input-anchor`.
   - Structural test renamed "…inline to the right of the input" (was "…spacing below the input").
   - Structural test gains two CSS assertions: `flex-direction: row; align-items: center` on wrapper, `flex: 1; position: relative` on anchor.
4. Ran `npm run lint` — PASS (1 pre-existing warning in AuthContext, unrelated).
5. Ran `npm run build` — PASS.
6. Ran `cd frontend && npm test` — 61/61 PASS.
7. Ran `cd backend && npm test` — 37/37 PASS.

##### Findings
- CSS change is a minimal two-property swap: `flex-direction: column → row` + `align-items: center` on `.eg-input-wrap`; `flex: 1` added to `.eg-input-anchor` so input takes all available width. Both match the plan spec exactly.
- The dropdown (`left: 0; right: 0`) is relative to `.eg-input-anchor` (which is now `flex: 1` width), so it correctly spans the input width only and does not extend under the preview icon ✅.
- When no icon is present, `.eg-input-anchor` fills the full row width because it is the only flex child ✅.
- Test assertions precisely guard the new CSS values; DOM structural assertions (sibling order, containment) from T-006 are preserved unchanged ✅.

##### Risks
- None. Change is CSS-only, JSX is untouched, all existing tests continue to pass.

#### Verdict
`PASS`

---

## Task: T-006 — Frontend: Autocomplete Anchor Fix + Click-Outside Close + Icon-Preview Spacing

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/components/AddItemSheet.jsx:86` | `handleInputFocus` adds an `!isEditMode` guard not in the plan spec. This is a correct defensive addition (edit mode already passes `""` to `useAutocomplete`), not a deviation. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `AddItemSheet.jsx` in full — verified all three fixes: anchor isolation (inner `.eg-input-anchor` + ref, preview moved outside), click-outside effect (`mousedown` + `touchstart` on document, early return when hidden, cleanup), new handlers (`handleInputChange`, `handleInputFocus`), `showSuggestions` state gating, all close call-sites updated.
2. Read `index.css` lines 900–949 — verified `.eg-input-wrap` changed to `display: flex; flex-direction: column; gap: 10px` (no longer `position: relative`); `.eg-input-anchor { position: relative; }` added; `.autocomplete-suggestions` position rules unchanged.
3. Read updated `AddItemSheet.test.jsx` (lines 174–228):
   - Existing chip test: now uses `within(inputAnchor)` instead of `within(inputWrap)`; verifies listbox gone after chip tap; CSS assertions updated for new `eg-input-wrap` flex rules and `eg-input-anchor` relative positioning.
   - New "closes on outside click" test: types "Tom" → listbox visible; clicks "Mehr anzeigen" (outside anchor) → listbox gone.
   - New "preview icon outside anchor" test: DOM structure assertions — `inputWrap.children[0] === inputAnchor`, `inputWrap.children[1] === preview`, `!inputAnchor.contains(preview)`.
4. Ran `npm run lint` — PASS.
5. Ran `npm run build` — PASS.
6. Ran `cd frontend && npm test` — 61/61 PASS (2 new tests in `AddItemSheet.test.jsx`).
7. Ran `cd backend && npm test` — 37/37 PASS.

##### Findings
- **Fix 1 (anchor):** `<div className="eg-input-anchor" ref={inputAnchorRef}>` wraps only `<input>`; `<AutocompleteSuggestions>` inside; preview icon is a sibling in `.eg-input-wrap` — DOM structure verified by the new structural test ✅.
- **Fix 2 (click-outside):** Effect fires only when `showSuggestions` is true (early return guard); registers `mousedown` + `touchstart` on `document`; uses `inputAnchorRef.current.contains()` for containment check; cleaned up in effect return ✅. `handleInputChange`, `handleInputFocus`, `handleQuickAdd`, `handleSubmit`, and reset effect all call `setShowSuggestions(false)` at the right moments ✅.
- **Fix 3 (spacing):** `.eg-input-wrap { display: flex; flex-direction: column; gap: 10px; }` provides controlled 10 px gap between input and preview icon ✅.
- CSS: `position: relative` correctly moved from `.eg-input-wrap` to `.eg-input-anchor`; dropdown `top: calc(100% + 2px)` is now relative to the input element height only ✅.
- All three plan acceptance criteria met: flush dropdown, outside-click close, chip-tap close, 10 px preview spacing.

##### Risks
- None introduced. The `document` event listeners are scoped behind the `showSuggestions` guard and reliably removed on cleanup.

#### Verdict
`PASS`

---

## Task: T-004 — Frontend: `AutocompleteSuggestions` Component + `AddItemSheet` Integration

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/components/AutocompleteSuggestions.jsx:12` | Chip key includes array index (`${text}-${icon}-${index}`). Index-in-key is a code smell, but acceptable here since the suggestions list is never reordered client-side after render. | No |
| 2 | nit | `frontend/src/components/AddItemSheet.jsx:55–73` | The plan says "do not clear or close after" for `handleQuickAdd`. The implementation does clear text and icon state after a successful chip tap — matching the `handleSubmit` add-mode reset path exactly. Behaviour is correct and intentional (sheet stays open, text cleared for next item); the wording in the plan was ambiguous about what "do not clear" meant in context. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `AutocompleteSuggestions.jsx` against plan spec (props, render-null, role attrs, icon registry lookup, tap target).
2. Read `index.css` autocomplete section (lines 900–928) — verified `.autocomplete-suggestions` flex/overflow, `.autocomplete-chip` min-height, hover/focus styles.
3. Read `AddItemSheet.jsx` — verified `listId` prop, `useAutocomplete` call (edit mode passes `""`), `<AutocompleteSuggestions>` placement between text input and icon picker, `handleQuickAdd` keeps sheet open.
4. Read `ListDetailPage.jsx` — verified both `<AddItemSheet>` instances receive `listId={id}`.
5. Read `AutocompleteSuggestions.test.jsx` — 4 required tests: empty renders null, chip count, chip click, null-icon chip with 44px CSS assertion.
6. Read `AddItemSheet.test.jsx` — verified new 6th test: "Tom" input shows listbox, chip tap calls `onAdd("Tomaten","IconSalad")`, sheet stays open, input cleared.
7. Ran `npm run lint` — PASS (1 pre-existing warning in AuthContext, unrelated).
8. Ran `npm run build` — PASS.
9. Ran `cd frontend && npm test` — 59/59 PASS (11 test files; 4 new AutocompleteSuggestions tests, 1 new AddItemSheet test).
10. Ran `cd backend && npm test` — 37/37 PASS.

##### Findings
- `AutocompleteSuggestions`: renders `null` for empty array ✅; `role="listbox"` on container, `role="option"` + `aria-label={text}` per chip ✅; icon skipped when `null` or not in `ICON_REGISTRY` ✅.
- CSS: `.autocomplete-chip { min-height: 44px; }` confirmed at line 912; flex row, gap, overflow-x auto, hover/focus-visible highlight all present ✅.
- `AddItemSheet`: `listId` prop wired; hook called with `""` in edit mode to suppress suggestions; `<AutocompleteSuggestions>` rendered only for `!isEditMode` between text field and icon picker ✅; `handleQuickAdd` calls `onAdd?.(trimmed, icon)`, guards on `false` return, resets local form state, never calls `onClose` — sheet stays open ✅.
- `ListDetailPage`: both `<AddItemSheet>` usages receive `listId={id}` ✅.
- All plan acceptance criteria verified: typing ≥ 2 chars shows chips; chip tap triggers `onAdd`; sheet stays open; chips ≥ 44 px; empty suggestions → null render.

##### Risks
- None introduced.

#### Verdict
`PASS`

---

## Task: T-002 — Backend: Suggestions Endpoint + Entry Upsert

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `backend/src/routes/suggestions.js:5–21`, `backend/src/routes/entries.js:5–21` | `ensureListAccess` is duplicated verbatim in both routers. No shared utility module specified in the plan, so this is acceptable for now, but it is drift-prone if the access logic ever changes. | No |

No blockers, majors, or minors found.

#### Verification

##### Steps
1. Read `backend/src/routes/suggestions.js` against plan spec (auth, list access, q validation, SQL, response shape, export name).
2. Read `backend/src/routes/entries.js` upsert block against plan spec (placement, conflict target, increments, best-effort catch).
3. Read `backend/src/app.js` for correct mount order (suggestions before entries).
4. Read `backend/src/suggestions.test.js` — verified all 5 required test cases present.
5. Read `backend/src/entries.test.js` — verified 2 new upsert/best-effort tests added (callCount guard on history write, error-resilience test).
6. Read `backend/src/license.test.js` — confirmed CRLF normalisation fix (`.replace(/\r\n/g, "\n")`).
7. Ran `npm run lint` — PASS.
8. Ran `npm run build` — PASS.
9. Ran `cd backend && npm test` — 37/37 pass, 0 failures.

##### Findings
- `suggestions.js`: auth middleware, list access guard (403), q min-length guard (400), SQL uses `ILIKE` + `similarity() > 0.25`, `ORDER BY use_count DESC, last_used_at DESC`, `LIMIT 5`, response maps `use_count → useCount`. All match plan exactly.
- `entries.js`: upsert placed in nested try/catch after successful INSERT; `ON CONFLICT (user_id, list_id, text)` increments `use_count`, updates `icon` and `last_used_at`; history errors logged and swallowed — entry 201 response is unaffected. All match plan exactly.
- `app.js`: suggestions router registered at line 19, entries at line 20 — correct order per plan.
- All 5 suggestion route tests and 2 new entry tests exercise the plan acceptance criteria.
- `license.test.js` CRLF fix incidentally resolves the pre-existing test failure.
- `npm test` now passes with 0 failures (was 1 failure in prior cycle).

##### Risks
- `ensureListAccess` duplication (nit only): if access logic changes, both files must be updated consistently.
- No other risks identified.

#### Verdict
`PASS`
