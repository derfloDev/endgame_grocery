# PLAN — api-description-property

Status: **ready_for_implement**

Goal: Extend the v1 API `Item` response object with an optional `description` field that maps to the existing `details` column in the `entries` table. The field is readable in all item responses and writable via POST (create) and PATCH (rename/update).

## Context

- DB column: `entries.details TEXT NULL` — already exists (migration `1713906000000_add_details_to_entries.cjs`). No new migration needed.
- `serializeItem()` in `backend/src/routes/v1.js` is the single serialization point for all `Item` responses.
- OpenAPI spec lives in `backend/src/openapi/v1.yaml`.
- Tests live in `backend/src/v1.test.js`.

## Acceptance Criteria

1. All item responses (`GET /items`, `POST /items`, `PATCH /items/:id`, `POST /items/:id/toggle`) include `description` (string or `null`).
2. `POST /items` accepts optional `description`; value is trimmed and stored in `entries.details`; `null` when omitted.
3. `PATCH /items/:id` accepts optional `description`; when the key is present it updates `entries.details`; when absent it leaves `details` unchanged.
4. OpenAPI `Item` schema includes `description` as an optional, nullable string.
5. OpenAPI POST and PATCH request bodies include `description` as optional.
6. All existing tests pass; new tests cover the `description` read/write paths.

## Implementation Steps

### Step 1 — `backend/src/routes/v1.js`

**1a. `serializeItem` — add `description`**

```js
function serializeItem(row) {
  return {
    id: row.id,
    name: row.text,
    status: row.status,
    description: row.details ?? null
  };
}
```

**1b. `GET /lists/:listId/items` — include `details` in SELECT**

```sql
SELECT id, text, status, details
FROM entries
WHERE list_id = $1
ORDER BY status ASC, created_at ASC
```

**1c. `POST /lists/:listId/items` — accept optional `description`, persist to `details`**

- Destructure `description` from `req.body` (optional).
- Change INSERT to include `details`:

```sql
INSERT INTO entries (list_id, text, status, details)
VALUES ($1, $2, 'open', $3)
RETURNING id, text, status, details
```

Parameters: `[req.params.listId, name.trim(), description?.trim() ?? null]`

**1d. `PATCH /lists/:listId/items/:itemId` — accept optional `description`, conditionally update `details`**

- Destructure `description` from `req.body` (optional).
- Check `'description' in (req.body ?? {})` to decide whether to update `details`.
- Two SQL branches:
  - description key **present**: `UPDATE entries SET text = $1, details = $2, updated_at = NOW() WHERE id = $3 AND list_id = $4 RETURNING id, text, status, details`  
    Parameters: `[name.trim(), description?.trim() ?? null, itemId, listId]`
  - description key **absent**: `UPDATE entries SET text = $1, updated_at = NOW() WHERE id = $2 AND list_id = $3 RETURNING id, text, status, details`  
    Parameters: `[name.trim(), itemId, listId]`

**1e. `POST /lists/:listId/items/:itemId/toggle` — include `details` in SELECT + RETURNING**

- SELECT: `SELECT id, text, status, icon, details FROM entries WHERE id = $1 AND list_id = $2 LIMIT 1`
- UPDATE RETURNING: `RETURNING id, text, status, details`

---

### Step 2 — `backend/src/openapi/v1.yaml`

**2a. `Item` schema — add `description` (optional, nullable)**

Add to `Item` properties (not required):

```yaml
description:
  type: string
  nullable: true
  description: Optional details for the item.
```

**2b. POST `/lists/{listId}/items` request body — add optional `description`**

Add to request body properties:

```yaml
description:
  type: string
  nullable: true
```

**2c. PATCH `/lists/{listId}/items/{itemId}` request body — add optional `description`**

Same as POST body addition.

---

### Step 3 — `backend/src/v1.test.js`

**3a. Update all existing item shape assertions**

Every pool mock row that represents an entry must add `details: null` (or a value when testing description). Every `deepEqual` assertion on an `item` or `items` response must add `description: null` (or the appropriate value).

Affected tests (update pool rows + expected bodies):
- "returns list items with raw entry status values"
- "creates an open item and returns the raw entry status"
- "keeps create responses successful when the SSE broadcast fails"
- "toggles an open item to done"
- "broadcasts after history upsert completes when toggling to done"
- "does not upsert autocomplete history when toggling a done item to open"
- "keeps toggle responses successful when the autocomplete history upsert fails"
- "keeps toggle responses successful when the SSE broadcast fails"
- "renames an existing item and returns the updated item"

**3b. Update SQL assertion in "returns list items" test**

```js
assert.match(normalizeSql(sql), /SELECT id, text, status, details FROM entries/);
```

**3c. New test — `POST` with description**

- "creates an item with a description": send `{ name: "Milk", description: " fresh " }`, assert pool INSERT receives `[LIST_ID, "Milk", "fresh"]`, response includes `description: "fresh"`.

**3d. New tests — `PATCH` with description**

- "updates description when description key is present in patch": send `{ name: "Milk", description: "2%" }`, assert SQL matches `UPDATE entries SET text = \$1, details = \$2`, params include `"2%"`, response includes `description: "2%"`.
- "clears description when description is null in patch": send `{ name: "Milk", description: null }`, assert SQL matches `details = \$2` with null, response includes `description: null`.
- "preserves description when description key is absent from patch": send `{ name: "Milk" }`, assert SQL does NOT match `details`, RETURNING still includes `details` from pool row, response includes `description: null`.

---

## Validation

```
npm run lint
npm run build
npm test
```

## Files to Change

| File | Change |
|------|--------|
| `backend/src/routes/v1.js` | `serializeItem`, all SQL queries/params, POST + PATCH body parsing |
| `backend/src/openapi/v1.yaml` | `Item` schema, POST + PATCH request bodies |
| `backend/src/v1.test.js` | Update existing assertions + add 4 new tests |
