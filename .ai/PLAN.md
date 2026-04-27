# Plan

Status: **ready_for_implement**

Goal: deliver the "Recently Used" panel on the List Detail Page (per-list, one-tap re-add, replaces Done section).

## Scope

### What changes

| Layer | Change |
|---|---|
| Backend – `routes/entries.js` | Remove autocomplete_history write from `POST /entries`; add history upsert to `PATCH /:entryId` (only when `status` changes **to** `done`); add history upsert to `DELETE /:entryId` (read `text`+`icon` before deleting) |
| Backend – `routes/history.js` | New router: `GET /api/lists/:id/history` + `DELETE /api/lists/:id/history` |
| Backend – `app.js` | Register `/api/lists/:id/history` |
| Backend tests | Update `entries.test.js`; new `history.test.js` |
| Frontend – `api/history.js` | New file: `fetchRecentlyUsed` + `deleteFromHistory` |
| Frontend – `ListDetailPage.jsx` | Remove Done section; add Recently Used section; load + manage `recentlyUsed` state |
| Frontend – `RecentlyUsedSection.jsx` | New component: renders ≤20 chips with one-tap add + dismiss button |
| Frontend – `index.css` | Styles for the Recently Used section |

### What does NOT change

- `autocomplete_history` DB schema (no migration needed).
- `routes/suggestions.js` and `useAutocomplete` hook (autocomplete while typing is a separate concern and keeps working independently).
- Offline queue behaviour (recently-used calls are not queued; they are best-effort).

---

## Acceptance Criteria

1. Marking an entry **done** (`PATCH` → `status: done`) writes/upserts the item into `autocomplete_history`.
2. **Deleting** an entry writes/upserts the item into `autocomplete_history` before the row is removed.
3. **Adding** an entry (`POST /entries`) does **not** write to `autocomplete_history`.
4. `GET /api/lists/:id/history` returns `{ history: [{text, icon, useCount}] }`, ≤20 items, `use_count DESC, last_used_at DESC`, excluding items whose `text` matches any `open` entry in that list.
5. `DELETE /api/lists/:id/history` with `{ text }` body returns 204 and permanently removes the record for `(user_id, list_id, text)`.
6. The ListDetailPage shows a **"Recently Used"** section below Open Items when `recentlyUsed.length > 0`.
7. Tapping a Recently Used chip calls the existing add-entry path; the item disappears from the panel immediately (optimistic removal).
8. Each chip has a dismiss (×) button; tapping it calls `DELETE /history` and removes the chip immediately.
9. The **Done** section is fully removed from ListDetailPage.
10. Items already `open` on the current list never appear in the Recently Used panel (server-side filter + client-side guard after add).

---

## Implementation Phases

### Phase 1 – Backend (T-001)

#### 1.1 `routes/entries.js`

**`POST /entries`** – remove the entire `try { await pool.query(INSERT INTO autocomplete_history …) } catch` block.

**`PATCH /:entryId`** – after the UPDATE query succeeds, if `status === 'done'`, fire an async history upsert (same pattern as the old POST block: fire-and-forget, errors only logged):

```sql
INSERT INTO autocomplete_history (user_id, list_id, text, icon, use_count, last_used_at)
VALUES ($1, $2, $3, $4, 1, NOW())
ON CONFLICT (user_id, list_id, text)
DO UPDATE SET
  icon       = EXCLUDED.icon,
  use_count  = autocomplete_history.use_count + 1,
  last_used_at = NOW()
```

Parameters: `[req.user.sub, req.params.id, updatedEntry.text, updatedEntry.icon]`

**`DELETE /:entryId`** – before the DELETE query, fetch `text` + `icon` from the entry. After successful delete (204), fire async history upsert with the same query. Errors only logged, never block the 204.

#### 1.2 `routes/history.js` (new file)

Router mounted at `/api/lists/:id/history` (mergeParams: true).

**`GET /`**

```sql
SELECT ah.text, ah.icon, ah.use_count
FROM   autocomplete_history ah
WHERE  ah.user_id = $1
  AND  ah.list_id = $2
  AND  NOT EXISTS (
    SELECT 1 FROM entries e
    WHERE  e.list_id = $2
      AND  e.text    = ah.text
      AND  e.status  = 'open'
  )
ORDER BY ah.use_count DESC, ah.last_used_at DESC
LIMIT 20
```

Response: `{ history: [{ text, icon, useCount }] }`

**`DELETE /`**

Body: `{ text }`. Validate: if `text` is blank → 400. Delete from `autocomplete_history` where `(user_id, list_id, text)`. Returns 204 (even if no row matched, idempotent).

#### 1.3 `app.js`

Add:
```js
import historyRoutes from "./routes/history.js";
// ...
app.use("/api/lists/:id/history", historyRoutes(options));
```

#### 1.4 Tests

**`entries.test.js`** – update existing tests:
- "creates an entry with an icon" → remove the third `callCount === 3` autocomplete assertion; confirm only 2 DB calls are made.
- "still creates the entry when autocomplete history upsert fails" → same: only 2 DB calls, no history write expected.
- Add test: "writes autocomplete history when entry is marked done".
- Add test: "does not write autocomplete history when entry status stays open".
- Add test: "writes autocomplete history when entry is deleted".

**`history.test.js`** (new file) – cover:
- GET 401 without auth.
- GET 403 on inaccessible list.
- GET returns ≤20 items excluding open entries, ordered correctly.
- GET returns empty array when nothing in history.
- DELETE 400 when text is blank.
- DELETE 403 on inaccessible list.
- DELETE 204 removes the record.

---

### Phase 2 – Frontend (T-002)

#### 2.1 `api/history.js` (new file)

```js
export function fetchRecentlyUsed(listId, token) { … GET /api/lists/:id/history … }
export function deleteFromHistory(listId, text, token) { … DELETE /api/lists/:id/history … }
```

Use `sendJsonRequest` from `api/client`. `fetchRecentlyUsed` is GET (not queued). `deleteFromHistory` is DELETE (not queued, best-effort).

#### 2.2 `components/RecentlyUsedSection.jsx` (new file)

Props: `items: [{text, icon, useCount}]`, `onAdd(text, icon)`, `onDismiss(text)`.

Renders a `<section>` with:
- Section header "RECENTLY USED" + item count chip (matching `entry-section-header` pattern).
- For each item: a chip/row showing icon (if any) + text + a dismiss `×` button.
- Tapping the chip body calls `onAdd(text, icon)`.
- Tapping `×` calls `onDismiss(text)`.

#### 2.3 `ListDetailPage.jsx`

State additions:
```js
const [recentlyUsed, setRecentlyUsed] = useState([]);
```

Remove:
- `doneOpen` state.
- `doneEntries` derivation.
- The entire Done `<section>` JSX block.

Load recently used in `loadListDetail` alongside entries:
```js
const [listsResult, entriesResult, historyResult] = await Promise.all([
  fetchLists(token),
  fetchEntries(id, token),
  fetchRecentlyUsed(id, token)   // best-effort; errors caught below
]);
setRecentlyUsed(historyResult?.history ?? []);
```

Handler `handleAddFromHistory(text, icon)`:
1. Optimistically remove from `recentlyUsed` (filter by `text`).
2. Call existing `addEntryByText(text, icon)`.

Handler `handleDismissFromHistory(text)`:
1. Optimistically remove from `recentlyUsed`.
2. Call `deleteFromHistory(id, text, token)` (fire-and-forget; errors logged).

JSX: after the Open Items section and before the FAB:
```jsx
{recentlyUsed.length > 0 ? (
  <RecentlyUsedSection
    items={recentlyUsed}
    onAdd={handleAddFromHistory}
    onDismiss={handleDismissFromHistory}
  />
) : null}
```

#### 2.4 `index.css`

Add styles for `.recently-used-section`, `.recently-used-chip`, `.recently-used-chip-dismiss`. Reuse design tokens; match the visual weight of the entry-section header.

---

## Validation

```
npm run lint
npm run build
npm test
```
