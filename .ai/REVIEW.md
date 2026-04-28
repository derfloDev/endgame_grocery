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
