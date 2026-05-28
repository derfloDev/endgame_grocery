# Plan

Status: **ready**

Goal: Remove `autocomplete_history` entirely. Source "Recently Used" from `entries WHERE status='done'` and typing autocomplete from all `entries` per list. Remove the dismiss button.

## Scope

- Drop `autocomplete_history` table via new DB migration.
- Rewrite `GET /api/lists/:id/history` to query `entries` (done, per-list, last 20 by `updated_at DESC`).
- Remove `DELETE /api/lists/:id/history` endpoint.
- Rewrite `GET /api/lists/:id/suggestions` to query `entries` (all, per-list, fuzzy match, top 5 by frequency then recency). `user_id` no longer used anywhere in these routes.
- Remove `upsertAutocompleteHistory` helper and all call sites (`entries.js`, `v1.js`).
- Remove dismiss button from `RecentlyUsedSection`.
- Remove `deleteFromHistory` from the frontend API layer and `useListDetailData`.

## Acceptance Criteria

1. `GET /api/lists/:id/history` returns `{ history: [{text, icon, details}] }` — the last 20 distinct-by-text done entries for the list, ordered `updated_at DESC`, excluding any text that also has a current `status='open'` entry.
2. `DELETE /api/lists/:id/history` returns 404 (route does not exist).
3. `GET /api/lists/:id/suggestions?q=…` queries `entries` by `list_id`; no `user_id` filter.
4. `autocomplete_history` table is absent after migration runs.
5. No `upsertAutocompleteHistory` import or call anywhere in the codebase.
6. Dismiss button absent from `RecentlyUsedSection` UI.
7. All tests pass (`npm test`); lint and build pass.

## Implementation Phases

### Phase 1 — Backend (T-001)

#### 1.1 New DB migration: drop autocomplete_history

- File: `backend/src/db/migrations/1748304000000_drop_autocomplete_history.cjs`
- `up`: `pgm.dropTable("autocomplete_history", { ifExists: true, cascade: true })`
  - Do **not** drop `pg_trgm`; it is still used for similarity search on `entries`.
- `down`: recreate the table with all columns (`id`, `user_id`, `list_id`, `text`, `icon`, `details`, `use_count`, `last_used_at`), add constraint `autocomplete_history_user_list_text_key` on `(user_id, list_id, text)`, add index `autocomplete_history_user_list_idx` on `(user_id, list_id)`.

#### 1.2 Delete historyUtils.js

- Delete `backend/src/db/historyUtils.js` entirely.

#### 1.3 Rewrite `routes/history.js`

- Remove the `DELETE "/"` handler.
- Replace the `SELECT` in `GET "/"` with:

```sql
SELECT text, icon, details
FROM (
  SELECT DISTINCT ON (text) text, icon, details, updated_at
  FROM entries
  WHERE list_id = $1
    AND status = 'done'
    AND NOT EXISTS (
      SELECT 1 FROM entries e2
      WHERE e2.list_id = $1
        AND e2.text = entries.text
        AND e2.status = 'open'
    )
  ORDER BY text, updated_at DESC
) ranked
ORDER BY updated_at DESC
LIMIT 20
```

  - Parameter: `[req.params.id]` (no user_id).
  - Response: `{ history: rows.map(({ text, icon, details }) => ({ text, icon, details })) }` — `useCount` is removed from the response.
  - Update JSDoc to reflect the new data source.

#### 1.4 Rewrite `routes/suggestions.js`

- Replace the `SELECT` with:

```sql
SELECT text,
  (array_agg(icon ORDER BY updated_at DESC NULLS LAST))[1] AS icon,
  count(*) AS use_count
FROM entries
WHERE list_id = $1
  AND (
    text ILIKE $2
    OR similarity(text, $3) > 0.25
  )
GROUP BY text
ORDER BY use_count DESC, max(updated_at) DESC
LIMIT 5
```

  - Parameters: `[req.params.id, `%${query}%`, query]` (no user_id).
  - Response: `{ suggestions: rows.map(({ text, icon, use_count }) => ({ text, icon, useCount: use_count })) }` — keep `useCount` so the existing offline-sort logic in the frontend continues to work.
  - Update JSDoc.

#### 1.5 Clean up `routes/entries.js`

- Remove `import { upsertAutocompleteHistory }` from `../db/historyUtils.js`.
- Remove both `void upsertAutocompleteHistory(...)` calls (the one on `status === 'done'` toggle and the one in the DELETE handler).

#### 1.6 Clean up `routes/v1.js`

- Remove `import { upsertAutocompleteHistory }` from `../db/historyUtils.js`.
- Remove the `upsertAutocompleteHistory` call in the status-toggle handler.

#### 1.7 Update backend tests

**`backend/src/history.test.js`**
- Remove test cases for `DELETE` (400 blank text, 403 inaccessible, 204 success).
- Update the GET success test:
  - Assert new SQL pattern: `FROM entries` / `status = 'done'` / `ORDER BY` / `LIMIT 20`.
  - Assert params contain only `["list-1"]` (no user-id).
  - Remove `useCount` from expected response body.
- Keep 401, 403, and empty-history test cases (adjust SQL/param assertions).

**`backend/src/suggestions.test.js`**
- Update success test:
  - Assert `FROM entries` and `GROUP BY text` in SQL.
  - Assert params: `["list-1", "%Schokollade%", "Schokollade"]` (no user-id).
  - Response may still include `useCount` (count-based).

**`backend/src/entries.test.js`**
- Remove all assertions that match `INSERT INTO autocomplete_history` (lines ~317, 321, 390, 602, 644).
- Adjust pool mock call counts wherever they assumed a history upsert query.

**`backend/src/v1.test.js`**
- Remove all assertions that match `INSERT INTO autocomplete_history` (lines ~323, 365, 437).
- Adjust pool mock call counts.

**`backend/src/db/migrations.test.js`**
- Add a new test `"drops and restores the autocomplete_history table"` for `1748304000000_drop_autocomplete_history.cjs`:
  - `up` asserts `["dropTable", "autocomplete_history", { ifExists: true, cascade: true }]`.
  - `down` asserts `createTable`, `addConstraint`, and `createIndex` calls that recreate the table.

---

### Phase 2 — Frontend (T-002)

#### 2.1 `frontend/src/api/history.ts`

- Remove the `deleteFromHistory` export (function and its JSDoc).
- Keep `fetchRecentlyUsed` unchanged.

#### 2.2 `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.tsx`

- Remove `onDismiss` from the `RecentlyUsedSectionProps` interface.
- Remove the dismiss `<button>` element and its container logic from JSX.
- Update JSDoc/comments if present.

#### 2.3 `frontend/src/pages/ListDetailPage/useListDetailData.ts`

- Remove `deleteFromHistory` from the import of `../../api/history`.
- Remove the `dismissRecentlyUsedEntry` callback entirely.
- Remove `dismissRecentlyUsedEntry` from the returned object.

#### 2.4 `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`

- Remove `onDismiss={dismissRecentlyUsedEntry}` from the `<RecentlyUsedSection>` usage.

#### 2.5 Update frontend tests

**`frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx`**
- Remove test cases that test the dismiss button interaction.
- Remove `onDismiss` from component usage in remaining test cases.

**`frontend/src/pages/ListDetailPage.test.tsx`**
- Remove the `fetchRecentlyUsed` mock that returns `useCount` in history items (or update it to omit `useCount`).
- Remove `deleteFromHistory` mock setup and any tests that assert dismiss behaviour.
- Remove the `vi.mocked(deleteFromHistory)` usage and import.

## Validation

```
npm run lint
npm run build
npm test
```

Run from both `backend/` and `frontend/` (or the workspace root if configured).
