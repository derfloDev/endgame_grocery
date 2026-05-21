# Plan

Status: **ready_for_implement**

Goal: (1) preserve `details` through the frontend recently-used pipeline; (2) upsert autocomplete history from the v1 toggle endpoint so items appear in "Zuletzt Verwendet".

---

## T-001 — Frontend: preserve `details` through the recently-used pipeline

### Background

When an entry is marked "done", `upsertRecentlyUsedItems` stores only `text`, `icon`, and `useCount`.
The `Suggestion` type has no `details` field, so the description is silently dropped.
When the user taps the item in "Zuletzt Verwendet", `addRecentlyUsedEntry` calls
`addEntryByText(text, icon)` — `details` is never passed, so the new entry is created without a description.

### Acceptance Criteria

1. After marking an entry with a description as "done", the description appears in the re-added entry when the user taps it in "Zuletzt Verwendet".
2. Entries without a description continue to work as before.
3. `upsertRecentlyUsedItems` unit tests assert that `details` is preserved on upsert and that a second upsert of the same item keeps the latest `details`.
4. `RecentlyUsedSection` tests assert that `onAdd` is called with `details`.
5. `addRecentlyUsedEntry` integration path is covered (details forwarded to `addEntryByText`).
6. `npm run lint`, `npm run build`, and `npm test` all pass.

### Implementation Steps

#### Step 1 — Extend the `Suggestion` type (`frontend/src/types.ts`)

Add `details?: string` to the `Suggestion` interface:

```ts
export interface Suggestion {
  text: string;
  icon?: string | null;
  details?: string;
  useCount?: number;
}
```

#### Step 2 — Preserve `details` in `recentlyUsedState.ts`

1. Extend the `RecentlyUsedEntry` pick to include `details`:
   ```ts
   type RecentlyUsedEntry = Pick<Entry, "text" | "icon" | "details">;
   ```
2. In `upsertRecentlyUsedItems`, include `details` in `nextItem`:
   ```ts
   const nextItem = {
     text,
     icon: entry.icon ?? existing?.icon ?? null,
     details: entry.details ?? existing?.details,
     useCount: (existing?.useCount ?? 0) + 1
   };
   ```

#### Step 3 — Forward `details` in `RecentlyUsedSection.tsx`

1. Update `RecentlyUsedSectionProps.onAdd` signature:
   ```ts
   onAdd?: (text: string, iconName: string | null, details?: string) => void;
   ```
2. Pass `item.details` in the button's `onClick`:
   ```ts
   onClick={() => onAdd?.(item.text, item.icon ?? null, item.details)}
   ```

#### Step 4 — Pass `details` in `useListDetailData.ts`

Update `addRecentlyUsedEntry` to accept and forward `details`:

```ts
const addRecentlyUsedEntry = useCallback(
  async (text: string, icon: string | null, details?: string): Promise<void> => {
    const historyItem = recentlyUsed.find((item) => item.text === text);
    setRecentlyUsed((currentItems) => currentItems.filter((item) => item.text !== text));

    const didAdd = await addEntryByText(text, icon, details ?? "");
    // restore logic unchanged
  },
  [addEntryByText, recentlyUsed]
);
```

#### Step 5 — Update the call site in `ListDetailPage.tsx`

```tsx
onAdd={(text, icon, details) => void addRecentlyUsedEntry(text, icon, details)}
```

#### Step 6 — Update tests (TDD: write before implementation)

| File | What to add / change |
|------|----------------------|
| `frontend/src/pages/recentlyUsedState.test.ts` | Assert `details` stored on upsert; second upsert with new `details` overwrites; entry without `details` leaves field undefined |
| `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx` | Assert `onAdd` called with the item's `details` value |
| `frontend/src/pages/ListDetailPage.test.tsx` | Assert that adding from recently used creates an entry that includes the original `details` |

### Files to Change

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `details?: string` to `Suggestion` |
| `frontend/src/pages/recentlyUsedState.ts` | Pick `details` in `RecentlyUsedEntry`; store in `upsertRecentlyUsedItems` |
| `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.tsx` | Extend `onAdd` prop; pass `details` in onClick |
| `frontend/src/pages/ListDetailPage/useListDetailData.ts` | Accept and forward `details` in `addRecentlyUsedEntry` |
| `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` | Forward `details` in `RecentlyUsedSection` `onAdd` |
| `frontend/src/pages/recentlyUsedState.test.ts` | Add/extend tests for `details` preservation |
| `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.test.tsx` | Assert `onAdd` called with `details` |
| `frontend/src/pages/ListDetailPage.test.tsx` | Assert re-added entry includes `details` |

---

## T-002 — Backend: v1 toggle endpoint upserts autocomplete history

### Background

`POST /api/v1/lists/{listId}/items/{itemId}/toggle` (used by the Home Assistant integration) flips an
entry's status between `open` and `done`. However it never calls `upsertAutocompleteHistory`, so items
toggled to "done" via the external API never appear in "Zuletzt Verwendet".

Additionally, the SELECT in the toggle handler only fetches `id, text, status` — `icon` is missing,
so the history upsert would store a null icon even after the fix.

`upsertAutocompleteHistory` is currently defined as a local function inside `entries.js`. To avoid
duplication it must be extracted to a shared utility before being called from `v1.js`.

### Acceptance Criteria

1. When an item is toggled from `open` to `done` via the v1 API, a row is upserted into `autocomplete_history` with the correct `userId`, `listId`, `text`, and `icon`.
2. When an item is toggled from `done` back to `open`, no history upsert occurs (the history query already filters open entries out of "Zuletzt Verwendet").
3. The existing "toggles an open item to done" test is updated to assert the 4th DB call (history upsert) and that `icon` is included in the SELECT.
4. A new test asserts that toggling from `done` to `open` only makes 3 DB calls (no history upsert).
5. A new test asserts that SSE broadcast failures do not affect the response (mirrors the pattern in the existing create test).
6. `npm run lint`, `npm run build`, and `npm test` all pass.

### Implementation Steps

#### Step 1 — Extract shared utility (`backend/src/db/historyUtils.js`)

Move `upsertAutocompleteHistory` out of `entries.js` into a new file:

```js
// backend/src/db/historyUtils.js
export function upsertAutocompleteHistory(pool, { userId, listId, text, icon }) {
  return pool.query(
    `INSERT INTO autocomplete_history (user_id, list_id, text, icon, use_count, last_used_at)
     VALUES ($1, $2, $3, $4, 1, NOW())
     ON CONFLICT (user_id, list_id, text)
     DO UPDATE SET
       icon = EXCLUDED.icon,
       use_count = autocomplete_history.use_count + 1,
       last_used_at = NOW()`,
    [userId, listId, text, icon]
  );
}
```

#### Step 2 — Update `entries.js`

Replace the local `upsertAutocompleteHistory` definition with an import from `../db/historyUtils.js`.

#### Step 3 — Update the toggle handler in `v1.js`

1. Import `upsertAutocompleteHistory` from `../db/historyUtils.js`.
2. Change the SELECT to also fetch `icon`:
   ```sql
   SELECT id, text, status, icon
   FROM entries
   WHERE id = $1 AND list_id = $2
   LIMIT 1
   ```
3. After the UPDATE, when `nextStatus === "done"`, fire-and-forget the history upsert (matching the pattern in `entries.js`):
   ```js
   if (nextStatus === "done") {
     void upsertAutocompleteHistory(pool, {
       userId: req.user.sub,
       listId: req.params.listId,
       text: currentItem.text,
       icon: currentItem.icon
     }).catch((historyError) => {
       logger.error({ err: historyError }, "Failed to upsert autocomplete history");
     });
   }
   ```

#### Step 4 — Update tests in `v1.test.js` (TDD: write before implementation)

1. **Update** "toggles an open item to done":
   - callCount 2: assert SELECT includes `icon` (`SELECT id, text, status, icon FROM entries`)
   - Return `{ id, text, status, icon }` from the SELECT mock
   - Add callCount 4 branch: assert `INSERT INTO autocomplete_history` with correct params `[userId, listId, text, icon]`
   - Assert `callCount === 4` at the end

2. **Add** "does not upsert autocomplete history when toggling a done item to open":
   - Mock SELECT returning `status: "done"`
   - Assert final `callCount === 3` (no 4th call)

3. **Add** "keeps toggle responses successful when the autocomplete history upsert fails":
   - 4th query throws; assert response is still 200 and error is logged

### Files to Change

| File | Change |
|------|--------|
| `backend/src/db/historyUtils.js` | New file — extracted `upsertAutocompleteHistory` |
| `backend/src/routes/entries.js` | Remove local `upsertAutocompleteHistory`; import from `../db/historyUtils.js` |
| `backend/src/routes/v1.js` | Import shared util; add `icon` to SELECT; call history upsert on done-toggle |
| `backend/src/v1.test.js` | Update existing toggle test; add done→open and history-failure tests |

---

## Validation

```
npm run lint
npm run build
npm test
```
