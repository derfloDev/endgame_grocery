# Plan

Status: **ready**

Goal: Add a free-text `details` field to grocery entries (ROADMAP.md — Priority 1).

## Scope

- DB: nullable `details` column on `entries`.
- Backend: `GET`, `POST`, `PATCH` entry routes expose `details`; `autocomplete_history` is not changed.
- Frontend API client: `createEntry` forwards `details`; `updateEntry` already forwards a generic payload.
- `AddItemSheet`: new optional "Details (optional)" input; `onAdd` callback gains a third `details` argument.
- `EntryRow`: renders a dimmed second line for `details` when non-empty.
- `ListDetailPage`: wires `details` through add, edit, and optimistic-update paths.

## Acceptance Criteria

1. A `details` column (nullable TEXT) exists on `entries` after migration.
2. `POST /api/lists/:id/entries` stores `details` and returns it in the response body.
3. `GET /api/lists/:id/entries` returns `details` for every entry.
4. `PATCH /api/lists/:id/entries/:entryId`:
   - When `details` key is **absent** from the body → existing value is preserved.
   - When `details` key is **present** (including `""` or `null`) → value is trimmed and stored as `null` if blank, otherwise stored as-is.
5. `AddItemSheet` (add mode) renders a second input with `label="Details (optional)"` and `placeholder="Beschreibung, Menge..."`.
6. `AddItemSheet` (edit mode) pre-fills the details input from `initialDetails` prop.
7. Submitting the sheet calls `onAdd(text, icon, details)` with `details` as the third argument (empty string when blank).
8. `EntryRow` renders `entry.details` in a visually subordinate line (CSS class `entry-row-details`) when the value is non-empty; line is absent when details is null/empty.
9. All existing tests continue to pass; new tests cover the `details` field at every layer.

## Implementation Phases

### Phase 1 — T-001: DB migration + backend

**Files to change:**
- `backend/src/db/migrations/<next_timestamp>_add_details_to_entries.cjs` *(new)*
  - `up`: `pgm.addColumns("entries", { details: { type: "text", notNull: false } })`
  - `down`: `pgm.dropColumns("entries", ["details"])`
- `backend/src/routes/entries.js`
  - `GET`: add `details` to `SELECT` column list.
  - `POST`: destructure `details` from body; pass `details?.trim() || null` as new query param; add to INSERT columns and RETURNING list.
  - `PATCH`: destructure `details` from body; detect presence via `'details' in (req.body ?? {})`; when present, include `details = $n` (direct assignment, not COALESCE) in the SET clause; add `details` to RETURNING list. Use a boolean flag param to conditionally update the column (e.g. `details = CASE WHEN $n THEN $n+1 ELSE details END`).
  - Validation: the `details` field is always optional; its presence alone does not satisfy the "at least one field" guard — that guard already covers `text`, `status`, `icon`.
- `backend/src/entries.test.js`
  - Update the SQL assertion regex in "returns entries" test to include `details`.
  - Update the INSERT assertion to include `details` and its param.
  - Update all `params` deep-equal assertions that reference the fixed param array to include `details`.
  - Add test: `POST` with `details` stores and returns it.
  - Add test: `PATCH` with `details` present updates the column.
  - Add test: `PATCH` without `details` key preserves the existing column value.
  - Add test: `PATCH` with `details: ""` clears the column to null.

### Phase 2 — T-002: Frontend

**Files to change:**
- `frontend/src/api/entries.js`
  - `createEntry({ text, icon, details })`: include `details` in the POST payload.
- `frontend/src/components/AddItemSheet.jsx`
  - Add prop `initialDetails = ""`.
  - Add state `const [details, setDetails] = useState(initialDetails)`.
  - Reset `details` in the `open` / `initialDetails` `useEffect`.
  - Add a second `<div className="eg-field">` block after the existing text field:
    ```jsx
    <label htmlFor={detailsInputId}>Details (optional)</label>
    <input
      id={detailsInputId}
      className="eg-input"
      placeholder="Beschreibung, Menge..."
      value={details}
      onChange={(e) => setDetails(e.target.value)}
    />
    ```
  - `handleSubmit`: call `onAdd(trimmed, selectedIconName, details)`.
  - `handleQuickAdd`: call `onAdd(trimmed, suggestedIconName, "")` (quick-add has no details).
- `frontend/src/components/AddItemSheet.test.jsx`
  - Update all `expect(onAdd).toHaveBeenCalledWith(text, icon)` assertions to `(text, icon, "")` (empty details) or the appropriate details value.
  - Add test: renders "Details (optional)" label and correct placeholder.
  - Add test: submitting with details text calls `onAdd` with that details string.
  - Add test (edit mode): pre-fills details input from `initialDetails` prop.
- `frontend/src/components/EntryRow.jsx`
  - Inside `.entry-row-copy`, after the `<p>` for `entry.text`, add:
    ```jsx
    {entry.details ? <p className="entry-row-details">{entry.details}</p> : null}
    ```
- `frontend/src/components/entry-row.test.jsx`
  - Add test: renders `.entry-row-details` when `entry.details` is non-empty.
  - Add test: does not render `.entry-row-details` when `entry.details` is null/undefined.
- `frontend/src/pages/ListDetailPage.jsx`
  - `addEntryByText(text, icon, details)`: pass `details` to `createEntry` and to the optimistic `temporaryEntry`.
  - `submitEditEntry(entryId, text, iconName, details)`: pass `details` in the `updateEntry` payload and in the optimistic update.
  - Edit-mode `AddItemSheet`: add `initialDetails={editingEntry?.details ?? ""}` prop; update `onAdd` callback signature to `(text, icon, details)` and forward to `submitEditEntry`.
  - Add-mode `AddItemSheet`: update `onAdd` callback signature to `(text, icon, details)` and forward to `addEntryByText`.
- `frontend/src/index.css`
  - Add `.entry-row-details` rule: smaller font size (e.g. `0.8rem`), muted color (`var(--text-secondary)` or similar), `margin: 0`, no extra top margin (tight to the name line).

## Validation

```
npm run lint
npm run build
npm test
```
