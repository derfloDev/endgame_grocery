# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No blocking or major findings.

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `backend/src/routes/entries.js:129` | PATCH guard excludes `details`-only requests (a body of `{ details: "..." }` gets 400). This is explicitly called out in the plan as intentional, so not a defect — but callers must always pair `details` with at least one of `text`/`status`/`icon`. | No — matches plan |

#### Verification

##### Steps

1. Read `.ai/PLAN.md` and acceptance criteria.
2. Read `git diff HEAD -- backend/` to inspect all changed files.
3. Reviewed migration file `1713906000000_add_details_to_entries.cjs` — `up`/`down` correct.
4. Reviewed `backend/src/routes/entries.js`:
   - `normalizeDetails`: handles non-string → null, trims, empty string → null ✓
   - GET: `details` added to SELECT column list ✓
   - POST: `normalizeDetails(details)` passed as `$4`, included in INSERT + RETURNING ✓
   - PATCH: `hasDetails = "details" in (req.body ?? {})` flag drives `CASE WHEN $4 THEN $5 ELSE details END` — preserves when absent, updates/clears when present ✓
   - PATCH guard still requires at least one of `text`/`status`/`icon` (plan-intentional) ✓
5. Reviewed `backend/src/entries.test.js`: all four plan-specified PATCH tests present; POST details test present; migration test present; existing tests updated with new params/columns.
6. Ran `npm run lint` — 0 errors, 1 pre-existing warning (frontend AuthContext).
7. Ran `npm run build` — succeeded.
8. Ran `npm test` — 50 backend tests pass, 67 frontend tests pass.

##### Findings

- All acceptance criteria satisfied.
- `normalizeDetails` correctly handles `null`, `undefined`, non-string, blank-string, and whitespace-padded inputs.
- CASE-based PATCH pattern correctly implements preserve/update/clear semantics.
- Test coverage covers all four required PATCH scenarios plus the POST details flow and the migration up/down.

##### Risks

- None beyond the intentional UX limitation noted above (details-only PATCH requires at least one other field).

#### Verdict

`PASS`

---

## Task: T-002


### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No blocking or major findings.

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `frontend/src/pages/ListDetailPage.jsx:403` | Add-mode `onAdd` is wrapped as `(text, icon, details) => addEntryByText(text, icon, details)` rather than simply `onAdd={addEntryByText}`. Both are equivalent; the wrapper is harmless but slightly redundant. | No |
| 2 | nit | `frontend/src/components/entry-row.test.jsx` ("omits the details line when details are empty") | The absence assertion queries for the literal string `"Whole grain"` (borrowed from the adjacent test) rather than checking that `.entry-row-details` is absent from the DOM. Works correctly because `afterEach(cleanup)` isolates test state, but a query for the CSS class would be more self-descriptive. | No |

#### Verification

##### Steps

1. Read `.ai/PLAN.md` acceptance criteria for T-002.
2. Ran `git diff HEAD -- frontend/` and inspected all changed files.
3. Reviewed `frontend/src/api/entries.js`: `createEntry` now accepts and forwards `details` in the POST payload ✓
4. Reviewed `frontend/src/components/AddItemSheet.jsx`:
   - `initialDetails` prop (default `""`) and `details` state added ✓
   - `useEffect` reset includes `details` and `initialDetails` dependency ✓
   - `detailsInputId` derived correctly for add/edit mode ✓
   - Second `<div className="eg-field">` with label `"Details (optional)"` and `placeholder="Beschreibung, Menge..."` added ✓
   - `handleQuickAdd` passes `""` as third arg ✓
   - `handleSubmit` passes `details` as third arg ✓
   - Details state cleared on successful non-edit submit ✓
5. Reviewed `frontend/src/components/EntryRow.jsx`: `{entry.details ? <p className="entry-row-details">{entry.details}</p> : null}` added ✓
6. Reviewed `frontend/src/index.css`: `.entry-row-details` rule with `font-size: 0.8rem`, `color: var(--text-secondary)`, `margin: 0`, `line-height: 1.35` added ✓
7. Reviewed `frontend/src/pages/ListDetailPage.jsx`:
   - `addEntryByText` accepts `details = ""`, normalizes for optimistic update, passes raw value to `createEntry` (server normalizes) ✓
   - `submitEditEntry` accepts `details = ""`, normalizes for optimistic update, passes raw value to `updateEntry` ✓
   - Edit-mode `AddItemSheet` receives `initialDetails={editingEntry?.details ?? ""}` ✓
   - Both `onAdd` callbacks forward `details` to the respective functions ✓
   - `normalizeEntryDetails` helper defined at module bottom, mirrors backend logic ✓
8. Reviewed all test changes — all plan-specified test cases present and correct.
9. Ran `npm run lint` — 0 errors (pre-existing frontend warning only) ✓
10. Ran `npm run build` — succeeded ✓
11. Ran `npm test` — 72 frontend + 50 backend tests pass ✓

##### Findings

- All five acceptance criteria satisfied.
- Optimistic-update normalization (frontend) and server-side normalization (backend) are equivalent — no consistency gap.
- Details input resets correctly after add-mode submit and after sheet re-open.
- CSS rule validated via regex in `entry-row.test.jsx`.

##### Risks

- None.

#### Verdict

`PASS`

---

## Task: T-003

### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No blocking, major, or minor findings.

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `RecentlyUsedSection.test.jsx` | `afterEach(cleanup)` added alongside the new test — good hygiene; not a finding, just an observation. | No |

#### Verification

##### Steps

1. Read `.ai/PLAN.md` Phase 3 (T-003) acceptance criteria.
2. Confirmed `FALLBACK_ICON` is exported from `frontend/src/data/iconRegistry.js` (`export const FALLBACK_ICON = IconShoppingCart;`) ✓
3. Reviewed `frontend/src/components/RecentlyUsedSection.jsx`:
   - `resolveIconName`: falsy `iconName` now returns `FALLBACK_ICON_NAME` instead of `null` ✓
   - `ItemIcon` assignment simplified to `ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON` (always non-null) ✓
   - Conditional `{ItemIcon ? ... : null}` replaced with unconditional `<ItemIcon ... />` ✓
4. Reviewed `frontend/src/components/AutocompleteSuggestions.jsx`:
   - `FALLBACK_ICON` imported alongside `ICON_REGISTRY` ✓
   - Resolution: `(suggestion.icon ? ICON_REGISTRY[suggestion.icon] : null) ?? FALLBACK_ICON` — matches plan exactly ✓
   - Conditional `{SuggestionIcon ? ... : null}` replaced with unconditional `<SuggestionIcon ... />` ✓
5. Reviewed `frontend/src/components/AutocompleteSuggestions.test.jsx`:
   - Null SVG assertion removed; truthy fallback SVG assertion added ✓
   - CSS `min-height`/`width` assertions retained ✓
6. Reviewed `frontend/src/components/RecentlyUsedSection.test.jsx`:
   - New test verifies `.recently-used-chip-icon` present when `item.icon` is null ✓
   - Also verifies `data-icon-name === "IconShoppingCart"` — stronger than plan required ✓
7. Ran `npm run lint` — 0 errors (pre-existing frontend warning only) ✓
8. Ran `npm run build` — succeeded ✓
9. Ran `npm test` — 73 frontend + 50 backend tests pass ✓

##### Findings

- All acceptance criteria satisfied.
- Both fallback paths (`resolveIconName` in RecentlyUsed, inline `??` in AutocompleteSuggestions) guarantee a non-null component — unconditional renders are safe.
- The `??` correctly handles unknown icon names (`ICON_REGISTRY[name]` returns `undefined`), falling through to `FALLBACK_ICON`.

##### Risks

- None.

#### Verdict

`PASS`

---

## Task: T-004

### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No blocking or major findings.

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `iconRegistry.js` / `iconDatabase.js` | Plan specifies `IconSeeding`; implementation uses `IconSeedling`. `IconSeeding` does not exist in `@tabler/icons-react`; `IconSeedling` is the correct Tabler name. Build passes — substitution is accurate, plan had a typo. | No |
| 2 | nit | `iconRegistry.js` | `IconBowlChopsticks` and `IconBowlSpoon` are imported and registered but have no `iconDatabase.js` keyword entries. Plan lists them for the registry only — no DB entries required. Consistent with plan. | No |

#### Verification

##### Steps

1. Read `.ai/PLAN.md` Phase 4 (T-004) acceptance criteria and icon lists.
2. Verified all 17 new Tabler icons imported and registered:
   `IconBlender`, `IconBone`, `IconBowl`, `IconBowlChopsticks`, `IconBowlSpoon`, `IconChefHat`, `IconEggCracked`, `IconLollipop`, `IconMelon`, `IconMicrowave`, `IconNut`, `IconPlant`, `IconPlant2`, `IconSeedling` (plan: `IconSeeding` — valid Tabler substitution), `IconSunglasses`, `IconTeapot`, `IconWheat` ✓
3. Verified all 28 new Lucide icons imported and registered:
   `CakeSlice`, `CandyCane`, `Cigarette`, `Citrus`, `CookingPot`, `Croissant`, `CupSoda`, `Dessert`, `Donut`, `Drumstick`, `FishSymbol`, `ForkKnife`, `GlassWater`, `Ham`, `Hamburger`, `Hop`, `IceCreamBowl`, `IceCreamCone`, `Martini`, `PillBottle`, `Popcorn`, `Refrigerator`, `Sandwich`, `Shrimp`, `Syringe`, `UtensilsCrossed`, `Vegan`, `Wine` ✓
4. Runtime check: `ICON_REGISTRY_KEYS.length === 134` (45 new entries); all 45 new keys present; 0 missing ✓
5. Runtime check: all `iconDatabase.js` entries reference icons that resolve in the registry — 0 broken references ✓
6. Verified all 9 existing `iconDatabase.js` icon substitutions:
   croissant → `Croissant`, ham → `Ham`, shrimp → `Shrimp`, ice cream → `IceCreamBowl`, ice cream cone → `IceCreamCone`, nuts → `IconNut`, popcorn → `Popcorn`, tea → `IconTeapot`, wine → `Wine` ✓
7. Verified new `iconDatabase.js` keyword entries present for all plan-specified labels ✓
8. Ran `npm run lint` — 0 errors (pre-existing frontend warning only) ✓
9. Ran `npm run build` — succeeded, bundle grew proportionally (1885 KiB precache vs 1858 KiB prior) ✓
10. Ran `npm test` — 73 frontend + 50 backend tests pass ✓

##### Findings

- All acceptance criteria satisfied.
- `IconSeedling` is the correct Tabler icon name; `IconSeeding` in the plan was a typo — implementer made the right call.
- All Lucide icons correctly wrapped with `fromLucide()` to normalize the `stroke`/`strokeWidth` prop difference.
- No orphaned iconDatabase references (runtime verified).

##### Risks

- None.

#### Verdict

`PASS`

---

## Task: T-005

### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No blocking, major, or minor findings.

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `iconRegistry.js:310` | `formatIconName` defensively guards `typeof name !== "string"` → returns `""`. Plan does not specify this but it is a sound defensive addition. | No |

#### Verification

##### Steps

1. Read `.ai/PLAN.md` Phase 5 (T-005) acceptance criteria and contracts.
2. Verified `iconRegistry.js` exports:
   - `FALLBACK_ICON_NAME = "IconShoppingCart"` ✓
   - `ICON_ALIASES = Object.freeze({})` ✓
   - `resolveIconName(name)`: null/undefined→null, known→same, alias→canonical, unknown→null ✓
   - `formatIconName(name)`: strips `Icon` prefix, splits PascalCase, handles digit boundaries ✓
   - `FALLBACK_ICON` re-derived from `ICON_REGISTRY[FALLBACK_ICON_NAME]` (no hardcoded reference) ✓
3. Verified `EntryRow.jsx`:
   - Local `normalizeSelectedIconName` and `FALLBACK_ICON_NAME` constant removed ✓
   - Now uses `resolveIconName(entry.icon)` + `ICON_REGISTRY[resolvedIconName] ?? FALLBACK_ICON` ✓
4. Verified `RecentlyUsedSection.jsx`:
   - Local `resolveIconName` function and `FALLBACK_ICON_NAME` constant removed ✓
   - Now uses shared `resolveIconName(item.icon) ?? FALLBACK_ICON_NAME` ✓
5. Verified `AutocompleteSuggestions.jsx`:
   - `FALLBACK_ICON` import replaced with `FALLBACK_ICON_NAME` + `resolveIconName` ✓
   - Uses `resolveIconName(suggestion.icon) ?? FALLBACK_ICON_NAME` ✓
6. Verified `AddItemSheet.jsx`:
   - `useState(resolveIconName(initialIconName))` ✓
   - `useEffect` uses `setSelectedIconName(resolveIconName(initialIconName))` ✓
   - Suggested-icon picker: `aria-label={\`Choose ${formatIconName(suggestedIconName)}\`}` ✓
   - Icon browser: `aria-label={\`Browse ${formatIconName(browserIconName)}\`}` and visible label ✓
7. Verified `iconRegistry.test.js`:
   - `resolveIconName`: null, undefined, known, unknown, alias-documentation cases ✓
   - `formatIconName`: all 6 plan-specified examples ✓
8. Verified `AddItemSheet.test.jsx` aria-label updates: `"Choose Leaf"`, `"Browse Trash"`, `"Browse Banana"` etc. ✓
9. Ran `npm run lint` — 0 errors (pre-existing frontend warning only) ✓
10. Ran `npm run build` — succeeded ✓
11. Ran `npm test` — 78 frontend + 50 backend tests pass (14 test files, +1 new `iconRegistry.test.js`, +5 new tests) ✓

##### Findings

- All acceptance criteria satisfied.
- Shared `resolveIconName` / `formatIconName` are clean pure functions with no side effects.
- Alias branch correctly returns `null` when alias target is not in registry — safe fallback.
- `FALLBACK_ICON` now derived from `FALLBACK_ICON_NAME` rather than a separate import, keeping the single source of truth.

##### Risks

- None.

#### Verdict

`PASS`

---

## Task: T-006

### Review Round 1

Status: **approved**

Reviewed: 2026-04-28

#### Findings

No findings.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` Phase 6 (T-006) acceptance criteria.
2. Verified `frontend/vite.config.js`:
   - `useCredentials: true` added inside `VitePWA({...})` options ✓
   - Inline comment above it explains the Cloudflare Access rationale and references README ✓
3. Verified `README.md` "Cloudflare Access" subsection under Docker Deployment:
   - Two-row bypass table: `/sw.js` (SW registration) and `/workbox-*.js` (Workbox chunks) ✓
   - Explanation that manifest does not need bypass (credentials sent via `crossorigin="use-credentials"`) ✓
4. Built the project and grepped `frontend/dist/index.html`: confirmed `crossorigin="use-credentials"` present on the manifest link ✓
5. Verified `vite-config.test.js` has new test "sends credentials with the PWA manifest request" asserting `useCredentials: true` in the config source ✓
6. Ran `npm run lint` — 0 errors (pre-existing frontend warning only) ✓
7. Ran `npm run build` — succeeded ✓
8. Ran `npm test` — 79 frontend + 50 backend tests pass (+1 new vite-config test) ✓

##### Findings

- All acceptance criteria satisfied.
- `crossorigin="use-credentials"` confirmed in the built `index.html` manifest link (E2E verified).
- README subsection is accurate: correctly distinguishes manifest (credentials fix applied) from SW scripts (requires CF bypass).

##### Risks

- None — this is a build-time configuration change with no runtime logic.

#### Verdict

`PASS`
