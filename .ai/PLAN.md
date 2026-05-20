# Plan

Status: **ready**

Goal: Enforce per-list entry limits to prevent unbounded database growth.

## Scope

Two independent limits apply to entries per list:

| Limit | Trigger | Behaviour |
|---|---|---|
| 1 000 open entries | `POST /api/lists/:id/entries` | Reject with HTTP 422 + error message |
| 200 done entries | `PATCH /api/lists/:id/entries/:entryId` (status → "done") | Auto-delete oldest done entry, then complete the update |

Both limits are enforced entirely in the backend. The frontend already surfaces backend error strings via the existing `entryError` banner in `ListDetailPage` — no frontend code changes are required.

## Acceptance Criteria

1. `POST` that would create the 1 001st open entry → HTTP 422 `{ error: "..." }`, no row inserted.
2. `POST` that creates the 1 000th open entry → HTTP 201, succeeds normally.
3. `PATCH status=done` when list already has 200 done entries → oldest done entry deleted, entry updated, HTTP 200.
4. `PATCH status=done` when list has fewer than 200 done entries → unaffected.
5. `PATCH` to fields other than `status` (or `status=open`) is never subject to the done-evict logic.
6. All existing entry-route tests continue to pass.
7. New unit tests cover the boundary conditions (999→1000 success, 1000→fail, 199→200 success+no-evict, 200→evict+succeed).

## Implementation

### Task T-001 — Enforce entry limits (backend)

**File:** `backend/src/routes/entries.js`

#### POST handler — open-entry cap

After `ensureListAccess` passes (before the `INSERT`), add a COUNT query:

```js
const countResult = await pool.query(
  `SELECT COUNT(*) AS cnt FROM entries WHERE list_id = $1 AND status = 'open'`,
  [req.params.id]
);
if (Number(countResult.rows[0].cnt) >= 1000) {
  res.status(422).json({
    error:
      "This list has reached the maximum of 1,000 open entries. Please complete or remove some items first."
  });
  return;
}
```

The INSERT that follows is unchanged.

#### PATCH handler — done-entry auto-evict

After `ensureListAccess` passes and **only when** the incoming `status` field equals `"done"`, add a count-and-evict step before the UPDATE:

```js
if (status === "done") {
  const doneCount = await pool.query(
    `SELECT COUNT(*) AS cnt FROM entries WHERE list_id = $1 AND status = 'done'`,
    [req.params.id]
  );
  if (Number(doneCount.rows[0].cnt) >= 200) {
    await pool.query(
      `DELETE FROM entries
       WHERE id = (
         SELECT id FROM entries
         WHERE list_id = $1 AND status = 'done'
         ORDER BY updated_at ASC, created_at ASC
         LIMIT 1
       )`,
      [req.params.id]
    );
  }
}
```

The existing UPDATE query that follows is unchanged.

**Atomicity note:** The evict and the update are two separate `pool.query` calls (consistent with the rest of the file). A failure between the two is extremely unlikely given the guard above but is acceptable for this use case.

### Task T-001 — Tests

**File:** `backend/src/entries.test.js`

Add a new `describe` block (or extend existing) with the following cases:

| Test | Pool mock strategy |
|---|---|
| POST rejects at 1 001st open entry (returns 422) | Access check → COUNT = 1000 → assert no INSERT called |
| POST succeeds at 1 000th open entry (COUNT = 999) | Access check → COUNT = 999 → INSERT succeeds → 201 |
| PATCH to `done` with 200 existing done entries → evict oldest, then update | Access check → COUNT = 200 → DELETE (check SQL) → UPDATE |
| PATCH to `done` with 199 existing done entries → no evict | Access check → COUNT = 199 → UPDATE directly |
| PATCH to other fields (text only) → count query never called | Access check → UPDATE |

Follow the existing mock-pool pattern in `entries.test.js`: track `callCount`, assert SQL patterns and params per call, use `assert.fail` for unexpected calls.

## Validation

```
npm run lint
npm run build
npm test
```
