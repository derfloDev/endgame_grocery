# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `backend/src/routes/entries.js` line 138 — `icon ?? null` in the PATCH handler means sending `{ icon: null }` cannot clear a previously set icon (COALESCE preserves the existing DB value). The plan does not require clearing icons, so this is an acceptable design choice, but future tasks that want a clear/reset capability would need a different update strategy (e.g. a dedicated null sentinel or explicit `icon = $3` without COALESCE). No fix required.

#### Verification

##### Steps
- Read migration file `backend/src/db/migrations/1713898800000_add_icon_to_entries.cjs` — correct `up`/`down` structure using `pgm.addColumns` / `pgm.dropColumns`.
- Read `backend/src/routes/entries.js` — GET, POST, PATCH, DELETE all reviewed.
- Read `backend/src/entries.test.js` — all new and updated test cases reviewed.
- Read `backend/src/db/migrations.test.js` — new test case for icon migration reviewed.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning in `AuthContext.jsx` (unchanged).
- Ran `npm run test --workspace backend -- src/entries.test.js` — **5/5 pass**.
- Ran `npm run test --workspace backend -- src/db/migrations.test.js` — **2/2 pass**.
- Ran `npm run build` — frontend bundle and backend syntax check both clean.
- Ran `npm test` — **27/27 backend tests pass, 19/19 frontend tests pass**.
- Inspected `git diff HEAD` — changes are exactly scoped to the 4 implementation files; no unintended modifications.

##### Findings
- All acceptance criteria from the plan are satisfied.
- Migration `up`/`down` is structurally correct; live up/down/up cycle was reported passing by the implementer and confirmed via HANDOFF entry.
- PATCH guard condition correctly uses `icon === undefined` (not falsy), so `{ icon: '🥛' }` alone passes validation.
- RETURNING clauses on GET, POST, and PATCH all include `icon`.

##### Risks
- Live migration rollback was not re-executed by the reviewer (no DB connection in this environment). The implementer's HANDOFF entry records a successful up/down/up run. The migration code itself is correct.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/hooks/useIconSuggestion.js` line 20–24 — `getExactOrPrefixIcon` iterates all 257 map keys with bidirectional `startsWith` on every call. For a grocery app this is imperceptible, but it is O(n) on every render. No fix required.
2. **nit** — `frontend/src/workers/iconWorkerClient.js` line 40–41 — The `handleWorkerError` listener rejects all pending requests but does not set `iconWorker = null`, so subsequent `getIconWorker()` calls return the crashed worker without recreating it. The app would need a page refresh to recover from a fatal worker crash. Acceptable for the current scope; no fix required.

#### Verification

##### Steps
- Read all 6 implementation files: `vite.config.js`, `iconWorker.js`, `iconWorkerClient.js`, `useIconSuggestion.js`, `useIconSuggestion.test.js`, `main.jsx`.
- Verified git diff scope: 7 frontend files changed + `package-lock.json`; no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/hooks/useIconSuggestion.test.js` — **4/4 pass**.
- Ran `npm run build` — clean; `iconWorker-*.js` bundle at 822 KB (expected for WASM ML); upstream `onnxruntime-web eval` warning noted but not actionable.
- Ran `npm test` — **28/28 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `vite.config.js`: `optimizeDeps: { exclude: ['@xenova/transformers'] }` added at top level ✅
- `iconWorker.js`: singleton pipeline via `??=`; threshold read from env with `Number.isFinite` guard; reference embeddings pre-computed on `init` and memoized; `pooling: 'mean'` + `normalize: true` correct for all-MiniLM-L6-v2; error handling posts `matchError` ✅
- `iconWorkerClient.js`: request-ID correlation; pending-request map; `primeIconWorker()` sends `init`; graceful `Worker === undefined` fallback ✅
- `useIconSuggestion.js`: 300 ms debounce; request sequence number guards against stale async results; cleanup via `clearTimeout` in effect; exact + prefix fast path bypasses worker entirely ✅
- `main.jsx`: `primeIconWorker()` called as module-level side effect before rendering, triggering eager model warm-up ✅
- Test suite: exact-match (no worker call), whitespace (null/false), below-threshold (null), above-threshold (icon) — all four acceptance-criteria cases covered ✅
- `iconWorkerClient.js` as a dedicated shared module was not in the plan but is a clean architectural improvement over inline worker construction in `main.jsx`.

##### Risks
- The 822 KB worker bundle will be fetched on first app load. No caching strategy for the WASM model weights is in scope for this task (deferred to T-006 / future work).

#### Verdict
`PASS`

---

## Task: T-004

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/api/entries.js` — When `icon` is `undefined` it is omitted from the JSON payload by `JSON.stringify`, which the backend handles as `null`. When `icon` is `null` it serialises as `null` and is also handled correctly. Both paths are safe; the behaviour is consistent. No fix required.

#### Verification

##### Steps
- Read `AddItemSheet.jsx`, `AddItemSheet.test.jsx`, `entries.js`, `ListDetailPage.jsx`, `index.css`.
- Inspected `app.test.jsx` diff — API call now asserts `body: JSON.stringify({ text: "Milch", icon: "🥛" })` and entry mock includes `icon` field.
- Verified `@keyframes spin` exists in `index.css` (line 88); `.add-item-preview-spinner` references it correctly.
- Verified git diff scope: 6 frontend files changed; no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/components/AddItemSheet.test.jsx src/app.test.jsx` — **17/17 pass**.
- Ran `npm run build` — clean; CSS bundle increased from 16.83 KB to 17.40 KB (new styles); no errors.
- Ran `npm test` — **28/28 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `AddItemSheet.jsx`: hook wired up; spinner shown when `loading === true`; emoji pill shown when `icon` is non-null; nothing shown when both false/null — matches plan spec ✅
- `aria-live="polite"` on both states and `aria-label="Loading icon suggestion"` on spinner — accessible and testable ✅
- `onAdd?.(trimmed, icon)` — icon may be null (no match); callers handle `null` correctly ✅
- `ListDetailPage.jsx`: `addEntryByText(text, icon)` accepts icon param; `temporaryEntry` includes `icon: icon ?? null`; `createEntry` call passes `icon: icon ?? null`; `AddItemSheet` wired with `onAdd={(text, icon) => void addEntryByText(text, icon)}` ✅
- `entries.js`: `createEntry` destructures `{ text, icon }` from body argument and includes both in payload ✅
- Test suite covers: icon preview render, loading indicator, icon passed through `onAdd`, integration POST body assertion ✅

##### Risks
- None.

#### Verdict
`PASS`

---

## Task: T-011

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/components/IconPickerSheet.jsx` line 53 — The button label renders the raw camelCase name (e.g. "IconMilk") rather than a human-readable string. Functional for now; cosmetic improvement is out of scope. No fix required.

#### Verification

##### Steps
- Read `IconPickerSheet.jsx`, `IconPickerSheet.test.jsx`, and the `icon-picker-*` CSS block in `index.css`.
- Verified git diff scope: 3 files changed (`IconPickerSheet.jsx` new, `IconPickerSheet.test.jsx` new, `index.css` extended); no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/components/IconPickerSheet.test.jsx src/components/ui/ui.test.jsx` — **6/6 pass** (3 picker + 3 ui tests).
- Ran `npm run build` — clean.
- Ran `npm test` — **37/37 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `IconPickerSheet.jsx`: search clears on close via effect; filter is case-insensitive substring match; icon grid maps `visibleIconNames`; each button has `aria-label="Select ${iconName}"`, selected-highlight class, `onSelect → onClose` on click; SVG rendered with `aria-hidden="true" size={24} stroke={1.6}` ✅
- Accessible: `<label>` uses `visually-hidden` class + `htmlFor` pairing ✅
- CSS: `auto-fill minmax(88px, 1fr)` grid; `max-height: 52vh` + `overflow-y: auto` prevents sheet overflow; `.icon-picker-btn--selected` provides cyan highlight ✅
- Test 1: grid renders exactly `ICON_REGISTRY_KEYS.length` (88) buttons ✅
- Test 2: searching "milk" narrows to IconMilk; selected button has `icon-picker-btn--selected` class; non-matching buttons absent ✅
- Test 3: clicking "Select IconMilk" fires `onSelect("IconMilk")` and `onClose()` ✅

##### Risks
- None.

#### Verdict
`PASS`

---

## Task: T-008

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/hooks/useIconSuggestion.js` line 67 — `.slice(0, 5)` in the hook is redundant because the worker already caps `topMatches` at 5. Harmless defensive guard; no fix required.
2. **nit** — `frontend/src/components/AddItemSheet.jsx` — The preview pill still renders `{iconName}` as literal text (e.g. "IconMilk"). This is the correct transitional state; SVG rendering is T-009's job. No fix required.

#### Verification

##### Steps
- Read all 6 changed files: `iconWorker.js`, `iconWorkerClient.js`, `useIconSuggestion.js`, `useIconSuggestion.test.js`, `AddItemSheet.jsx`, `AddItemSheet.test.jsx`.
- Confirmed `AddItemSheet` changes are necessary to consume the renamed `iconName` field — scope is minimal and correct.
- Verified git diff scope: 6 frontend files changed; no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/hooks/useIconSuggestion.test.js src/components/AddItemSheet.test.jsx src/app.test.jsx` — **21/21 pass**.
- Ran `npm run build` — clean.
- Ran `npm test` — **34/34 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `iconWorker.js`: reference embeddings now store `iconName` (was `icon`); `matchIcon` returns `{ iconName, score, topMatches }`; per-icon score deduplication via Map; filters ≥ 0.25, sorts descending, slices to 5, returns `topMatches: []` when below threshold ✅
- `iconWorkerClient.js`: `handleWorkerMessage` destructures `{ iconName, topMatches }` with safe defaults; resolves with `{ iconName, score, topMatches }`; no-worker fallback updated ✅
- `useIconSuggestion.js`: `asyncState` shape updated to `{ iconName, topMatches, loading }`; async path maps `topMatches[].iconName` to `string[]`; exact match path returns `topMatches: []`; empty input path returns `topMatches: []` ✅
- Test suite covers: exact match (`topMatches: []`), empty input, below-threshold (both null/empty), above-threshold (iconName + topMatches string array) ✅
- `topMatches` contract: worker returns `Array<{ iconName, score }>` objects; hook surfaces `string[]` for consumer simplicity ✅

##### Risks
- None.

#### Verdict
`PASS`

---

## Task: T-007

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/data/iconDatabase.js` — "banana" maps to `IconCherry` and "potato" maps to `IconCarrot` (no dedicated Tabler icons exist for these). Acceptable substitutions given the available set. No fix required.
2. **nit** — `frontend/src/data/iconRegistry.js` — `IconVaccine`, `IconEggs`, `IconHome`, `IconScissors` are in the registry but unused in `ICON_DB`. Extra registry coverage is intentional (picker grid), not a problem. No fix required.

#### Verification

##### Steps
- Read `iconRegistry.js` — 88 imports matched 88 registry entries; `ICON_REGISTRY_KEYS` and `FALLBACK_ICON` exports verified.
- Read `iconDatabase.js` — 136 bilingual ICON_DB entries; all categories (dairy, produce, bakery, meat/fish, beverages, frozen, snacks, household, condiments, pantry, drugstore) present.
- Runtime spot-checks: registry size = 88, ICON_DB count = 136, `milch → IconMilk`, `toilettenpapier → IconToiletPaper`, zero dangling references.
- Confirmed `FALLBACK_ICON` is a `React.forwardRef` object (`{ $$typeof, render }`) — correct Tabler v3 shape, not a plain function.
- Reviewed diffs for `cosineSimilarity.test.js` (emoji → icon-name assertions, added registry/key count + dangling-reference tests), `useIconSuggestion.test.js` (emoji → icon-name mocks), `app.test.jsx` (emoji → icon-name mock data) — all updates are correct and necessary.
- Verified git diff scope: `iconRegistry.js` (new), `iconDatabase.js`, `package.json`, `package-lock.json`, plus 3 test files updated for Tabler names; no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js` — **7/7 pass** (2 new registry tests + dangling-reference test + 4 original).
- Ran `npm run build` — clean; 73 modules transformed; tree-shaking effective.
- Ran `npm test` — **34/34 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `ICON_REGISTRY` has 88 entries (≥ 80) covering food, household, and drugstore ✅
- `ICON_REGISTRY_KEYS = Object.freeze(Object.keys(ICON_REGISTRY))` — correct ordered key list ✅
- `FALLBACK_ICON = IconShoppingCart` exported ✅
- Every `icon` string in `ICON_DB` resolves to a registered component — no dangling references ✅
- `EXACT_MATCH_MAP["milch"] === "IconMilk"` and `EXACT_MATCH_MAP["toilettenpapier"] === "IconToiletPaper"` verified at runtime ✅
- `@tabler/icons-react` in `frontend/package.json`; build tree-shakes to only the registered icons ✅

##### Risks
- Existing committed code in T-004/T-005 renders `entry.icon` as a text node, so entries created before T-008 through T-010 land will show "IconMilk" etc. as literal text in the UI. This is a known transitional state tracked by the remaining tasks.

#### Verdict
`PASS`

---

## Task: T-005

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/components/entry-row.test.jsx` line 43 — The swipe-delete test passes `entry` without an `icon` property, so `entry.icon` is `undefined`. `undefined ?? "🛒"` still renders the cart fallback — correct behaviour, and the test passes. No fix required.

#### Verification

##### Steps
- Read `EntryRow.jsx` — icon span placement, fallback logic, done-state opacity.
- Read `entry-row.test.jsx` — all 3 test cases reviewed.
- Checked `index.css` — `.entry-icon` and `.entry-icon.entry-row-done` classes at lines 827–835.
- Verified git diff scope: 4 frontend files changed (`EntryRow.jsx`, `entry-row.test.jsx`, `index.css`, `app.test.jsx`); no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/components/entry-row.test.jsx src/app.test.jsx` — **18/18 pass** (3 EntryRow unit tests + 15 integration tests).
- Ran `npm run build` — clean; 73 modules transformed.
- Ran `npm test` — **28/28 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `EntryRow.jsx` line 132–134: icon span placed before `.entry-row-copy` div — matches plan spec exactly ✅
- `entry.icon ?? "🛒"` handles both `null` and `undefined` correctly ✅
- `entry-row-done` class on the icon span applies `opacity: 0.55` when status is done — matches plan ✅
- `aria-hidden="true"` — emoji is decorative, correctly hidden from assistive technology ✅
- Test 1: `icon: "🥛"` renders emoji and asserts `🛒` is absent ✅
- Test 2: `icon: null` renders `🛒` fallback ✅
- Test 3: swipe-delete test (no icon prop) still passes ✅
- CSS: `.entry-icon` at `font-size: 1.5rem`, `flex-shrink: 0`; `.entry-icon.entry-row-done` at `opacity: 0.55` ✅

##### Risks
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/data/iconDatabase.js` — Several entries share an emoji with a more prominent item due to Unicode gaps (`cream` → `🥛`, `cocoa` → `☕`, `mustard` → `🌭`, `black pepper` → `🧂`). This is expected and appropriate given emoji availability. No fix required.
2. **nit** — `frontend/src/data/iconDatabase.js` — Typing "pepper" alone does not resolve to a match (only "black pepper" is in the label/tags). This is a minor gap in coverage but not required by the plan. No fix required.

#### Verification

##### Steps
- Read `frontend/src/data/iconDatabase.js` — structure, entry count, bilingual coverage, `EXACT_MATCH_MAP` construction reviewed.
- Read `frontend/src/utils/cosineSimilarity.js` — algorithm, guard clauses, edge cases reviewed.
- Read `frontend/src/utils/cosineSimilarity.test.js` — all 5 test cases reviewed.
- Runtime spot-check via `node -e` to confirm entry count (78), map size (257 keys), and all 12 plan-specified EN/DE lookups resolve correctly.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js` — **5/5 pass**.
- Ran `npm run build` — clean.
- Ran `npm test` — **24/24 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `ICON_DB` has 78 entries, well above the ≥ 60 minimum.
- All required categories present: dairy, produce, bakery, meat/fish, beverages, frozen, snacks, household, condiments.
- `EXACT_MATCH_MAP` is frozen and derived from label + tags; keys are lower-cased and trimmed.
- `createExactMatchMap` correctly skips empty keys and handles missing `tags` with a default of `[]`.
- `cosineSimilarity` handles zero-magnitude vectors (returns 0), mismatched lengths (RangeError), and non-array inputs (TypeError). Compatible with TypedArrays via `Number()` coercion.
- Test coverage: entry count assertion, 12 exact-match pairs (EN + DE), and 3 vector similarity cases (identical, orthogonal, partial overlap with `toBeCloseTo`).

##### Risks
- None.

#### Verdict
`PASS`

---

## Task: T-009

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/components/AddItemSheet.jsx` line 87 — "Mehr anzeigen" button is always rendered, even when there are no `topMatches` and no semantic alternatives to show. A user typing "Milch" (exact match, `topMatches: []`) will see the button but opening `IconPickerSheet` is still functional, so this is not a blocker. Acceptable UX trade-off. No fix required.
2. **nit** — `frontend/src/components/AddItemSheet.jsx` lines 23–25 — The `useEffect` that syncs `iconName` → `selectedIconName` runs whenever `iconName` changes, which will overwrite a user's manual alternative selection if the debounce fires after they click an alternative. In practice the 300 ms debounce window is short enough that this race is unlikely, and the plan does not require protection against it. No fix required.

#### Verification

##### Steps
- Read `frontend/src/components/AddItemSheet.jsx` — full component reviewed.
- Read `frontend/src/components/AddItemSheet.test.jsx` — all 3 test cases reviewed.
- Ran `git diff HEAD -- frontend/src/components/AddItemSheet.jsx frontend/src/components/AddItemSheet.test.jsx frontend/src/index.css` — confirmed scope of changes.
- Verified CSS classes `add-item-icon-picker`, `add-item-icon-picker-btn`, `add-item-icon-picker-btn--selected`, `add-item-more-btn`, `add-item-preview-svg` are present in `frontend/src/index.css`.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/components/AddItemSheet.test.jsx src/app.test.jsx` — **18/18 pass**.
- Ran `npm run build` — clean (1 upstream `onnxruntime-web` eval warning, unchanged).
- Ran `npm test` — **38/38 frontend + 27/27 backend, all pass**.

##### Findings
- `selectedIconName` local state added; initialised from `useIconSuggestion`'s `iconName` via a dedicated `useEffect`; user alternative clicks and full-picker selection both update it; `onAdd` passes `selectedIconName` — all correct.
- `PreviewIcon` resolves via `ICON_REGISTRY[selectedIconName]` and renders as an SVG `<PreviewIcon>` component with `data-testid="add-item-icon-preview"`. Confirmed by test assertion `container.querySelector("[data-testid='add-item-icon-preview'] svg")`.
- `suggestedIconNames` deduplicated with `Set` and filtered through `ICON_REGISTRY` guard — safe against unknown names returned from the worker.
- `showFullPicker` boolean gates `IconPickerSheet`; picker `onSelect` calls `setSelectedIconName`; picker `onClose` resets `showFullPicker` to false. Round-trip test (`Gemüse` → alternatives → picker → `IconTrash` → submit) passes and asserts `onAdd("Gemüse", "IconTrash")`.
- Reset on close (`open` → false) clears `text`, `selectedIconName`, and `showFullPicker` — no stale state between uses.
- Loading state renders spinner with `aria-label="Loading icon suggestion"` and hides the preview — correct.
- Tests use `vi.mock` for `useIconSuggestion` with three controlled branches: exact match (`Milch`), semantic with alternatives (`Gemüse`), and loading (`Mil`). All three branches exercised.

##### Risks
- Minor: if the ML worker debounce fires after a user clicks an alternative icon, `selectedIconName` is overwritten (see nit #2). Unlikely in typical use and not in scope for this task.

#### Verdict
`PASS`

---

## Task: T-010

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-26

#### Findings

1. **nit** — `frontend/src/components/EntryRow.jsx` line 27 — In edit mode, `PreviewIcon` falls back to `FALLBACK_ICON` when `selectedIconName` is null (i.e. the entry has no icon). This means the preview always shows a cart icon even when the entry genuinely has no icon. The plan says "fallback for null" in view mode, so this is consistent and intentional. No fix required.
2. **nit** — `frontend/src/components/EntryRow.jsx` lines 29–35 — The `useEffect` that resets `selectedIconName` on `editMode` exit is redundant with `cancelEdit` and `submitEdit`, which already call `setSelectedIconName(normalizeSelectedIconName(entry.icon))`. Harmless duplicate state reset; no bug. No fix required.

#### Verification

##### Steps
- Read `frontend/src/components/EntryRow.jsx` — full component reviewed.
- Read `frontend/src/components/entry-row.test.jsx` — all 4 test cases reviewed.
- Ran `git diff HEAD -- frontend/src/components/EntryRow.jsx frontend/src/components/entry-row.test.jsx frontend/src/index.css` — confirmed scope of changes.
- Verified `submitEditEntry` in `frontend/src/pages/ListDetailPage.jsx` (line 171) accepts `(entryId, text, iconName)` and passes `icon: nextIcon` to `updateEntry`; `onEdit` prop wired as `(text, iconName) => void submitEditEntry(entry.id, text, iconName)` at lines 320 and 346.
- Verified CSS classes `entry-row-edit-icon-stack`, `entry-row-edit-preview`, `entry-row-icon-picker`, `entry-icon` are present in `frontend/src/index.css`.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/components/entry-row.test.jsx src/app.test.jsx` — **19/19 pass**.
- Ran `npm run build` — clean (1 upstream `onnxruntime-web` eval warning, unchanged; CSS bundle grew ~0.2 kB for new classes).
- Ran `npm test` — **39/39 frontend + 27/27 backend, all pass**.

##### Findings
- View mode: `EntryIcon = ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON` renders a Tabler SVG component with `data-testid` and `data-icon-name` attributes; `null` entry icon correctly resolves through `normalizeSelectedIconName` → `null` → `FALLBACK_ICON` + `FALLBACK_ICON_NAME`. Test assertions on `getAttribute("data-icon-name")` confirm both branches.
- `normalizeSelectedIconName` guard handles unknown icon names (maps to `FALLBACK_ICON_NAME`) — defensive and correct.
- Edit mode: all 88 registry icons rendered as inline picker buttons (`ICON_REGISTRY_KEYS.map`); `"Mehr anzeigen"` opens `IconPickerSheet`; both paths update `selectedIconName`. Full round-trip test (`Edit Coffee` → picker → `IconTrash` → rename → `Save item`) asserts `onEdit("Ground coffee", "IconTrash")`.
- `onEdit?.(trimmed, selectedIconName)` in `submitEdit` correctly passes the current `selectedIconName` — plan criterion met.
- `submitEditEntry` in `ListDetailPage` correctly threads `iconName` into `updateEntry({ text, icon })` — full stack wiring confirmed.
- Swipe-delete test still passes (no regression).

##### Risks
- None.

#### Verdict
`PASS`
