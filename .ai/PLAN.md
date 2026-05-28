# Plan

Status: **ready_for_implement**

Goal: Deliver six improvement areas for the client cycle: styling fixes, enter-key UX, four new icons, a PWA update banner, push-notification debugging/fix, and a server-side "changed badges" feature for shared lists.

---

## T-001 — Styling Fixes

### Scope
Three isolated CSS/layout fixes on mobile.

### Acceptance Criteria
- `overview-topbar` top padding is `16px` (was `52px`).
- FAB `bottom` equals `16px` (matching the `16px` right margin on narrow screens).
- When the icon browser is open in `AddItemSheet` and the on-screen keyboard is visible, the icon grid always shows at least two full rows of icons.

### Files to Change
- `frontend/src/pages/OverviewPage/OverviewPage.module.css` — change `padding: 52px 16px 16px` → `padding: 16px 16px 16px`.
- `frontend/src/components/ui/FAB/FAB.module.css` — change `bottom: 92px` → `bottom: 16px`.
- `frontend/src/components/AddItemSheet/AddItemSheet.module.css` — add `min-height: calc(2 * 88px + 10px)` (≈ 186px) to `.add-item-icon-browser-grid` so two rows are always visible.

### Validation
- `npm run lint`
- `npm run build`

---

## T-002 — Enter-Key UX in AddItemSheet

### Scope
Pressing Enter in the title field submits the entry immediately instead of focusing the Details input.

### Acceptance Criteria
- Pressing Enter while the title `<input>` is focused submits the form (same as clicking the primary button) when `text.trim()` is non-empty.
- The Details field retains default Enter behaviour (no change).
- Mobile keyboard shows a "Done" action button (via `enterKeyHint`).
- Existing tests still pass; a new unit test covers the Enter-submit path.

### Files to Change
- `frontend/src/components/AddItemSheet/AddItemSheet.tsx`
  - Add `enterKeyHint="done"` to the title `<input>`.
  - Add `onKeyDown` handler: if `event.key === "Enter"`, call `void handleSubmit()` and `event.preventDefault()`.
- `frontend/src/components/AddItemSheet/AddItemSheet.test.tsx` — add test: typing into title input and pressing Enter triggers `onAdd`.

### Validation
- `npm run lint`
- `npm test -- AddItemSheet`

---

## T-003 — New Icons (4)

### Scope
Add four custom SVG icons and wire them into the icon registry.

### Icons
| Registry key | Description |
|---|---|
| `dishwasherTabs` | Several dishwasher tabs (rectangles/rounded squares with dots) |
| `nutNougatCream` | Closed glass jar with lid and label stripe |
| `maultaschen` | Three stuffed pasta pockets / Maultaschen |
| `herbs` | Herb bunch tied with string (parsley / rosemary / basil shape) |

### Files to Change
- `frontend/src/assets/icons/custom/dishwasherTabs.svg` — new file, 24×24 viewBox, stroke-based.
- `frontend/src/assets/icons/custom/nutNougatCream.svg` — new file.
- `frontend/src/assets/icons/custom/maultaschen.svg` — new file.
- `frontend/src/assets/icons/custom/herbs.svg` — new file.
- `frontend/src/data/customIcons.ts` — import four new `*Svg` components; export four new `Custom*` wrapper functions.
- `frontend/src/data/iconRegistry.ts` — add four new entries to `ICON_REGISTRY` and `ICON_REGISTRY_KEYS`.

### Validation
- `npm run lint`
- `npm run build` (verifies SVG imports resolve)

---

## T-004 — PWA Update Banner

### Scope
Show a dismissible "New version available" banner when a new service worker is waiting; clicking it reloads the page with the new version.

### Acceptance Criteria
- When a new SW version installs and is waiting, a visible banner appears at the top of the app (on all logged-in pages).
- Banner text is translated (de + en).
- Clicking the banner button calls `updateServiceWorker(true)` (triggers `skipWaiting` and reloads).
- Dismissing the banner without reloading hides it for the session (no forced reload).
- The banner does NOT appear in the development build (`registerSW` already guards dev mode).

### Files to Change
- `frontend/src/sw/register.ts` — replace current `registerSW({ immediate: true })` with a `useRegisterSW` export from `virtual:pwa-register/react`; export `{ needRefresh, updateServiceWorker }` so they can be consumed in the app.
- `frontend/src/components/UpdateBanner/UpdateBanner.tsx` — new component: renders a fixed banner with "New version available – click to update" and a dismiss button.
- `frontend/src/components/UpdateBanner/UpdateBanner.module.css` — new file, banner styles.
- `frontend/src/components/UpdateBanner/UpdateBanner.test.tsx` — unit tests: banner renders when `needRefresh` is true, calls `updateServiceWorker(true)` on click.
- `frontend/src/app.tsx` — import `UpdateBanner`; render it inside `ProtectedLayout` (or at the root level).
- `frontend/src/locales/de/translation.json` — add `update.bannerText`, `update.bannerAction`.
- `frontend/src/locales/en/translation.json` — same keys.

### Note on register.ts refactor
`virtual:pwa-register/react` exposes `useRegisterSW({ onNeedRefresh, onOfflineReady })`. The `register.ts` file becomes a thin re-export so existing call sites (only `main.tsx` if any) remain compatible. Check whether `main.tsx` imports and calls `registerServiceWorker()` and update accordingly.

### Validation
- `npm run lint`
- `npm run build`
- `npm test -- UpdateBanner`

---

## T-005 — Push Notifications Debug & Fix

### Scope
Systematic audit of the push notification pipeline; fix every confirmed bug; improve observability.

### Acceptance Criteria
- A push notification is delivered to all subscribed recipients within ~10 minutes of another user adding an item.
- Backend logs at `info` level: job enqueued, job fired, recipients found, subscriptions targeted, notifications sent.
- Stale/expired subscriptions (HTTP 410) are removed from the DB and logged.
- `buildNotificationBody` uses only English (consistent with the rest of the backend code).
- No silent error swallowing in the push pipeline.

### Investigation Checklist (implementer works through each)
1. **VAPID configuration** — `processPendingPushJobs` returns early if any key is missing; add a startup warning log in `app.js` if VAPID vars are absent.
2. **Subscription persistence** — verify `POST /api/push/subscribe` reaches the DB; add a log line on successful INSERT/UPDATE.
3. **Push-worker tick** — add `logger.debug` at the start of each tick listing how many jobs are due.
4. **Recipient query** — log when zero recipients are found (currently just deletes the job silently).
5. **Subscription query** — log when zero subscriptions are found for valid recipients.
6. **webpush.sendNotification** — ensure all non-410 errors are re-thrown (they already are); confirm 410 path removes the subscription and continues.
7. **Service-worker push handler** — the existing `push` listener looks correct; add a `console.log` in dev to confirm the event fires.
8. **`buildNotificationBody` language fix** — replace `"und"` / `"weitere Artikel"` with English equivalents.

### Files to Change
- `backend/src/app.js` — add startup log warning when VAPID environment variables are not set.
- `backend/src/workers/pushWorker.js`
  - Add `logger.debug` at start of `processPendingPushJobs` (job count).
  - Log zero-recipient and zero-subscription cases at `info` rather than `debug`.
  - Fix `buildNotificationBody` to use English strings.
  - Confirm all non-410 errors propagate.
- `backend/src/routes/push.js` — add `logger.info` on successful subscribe/unsubscribe.
- `backend/src/pushWorker.test.js` — update `buildNotificationBody` assertions to English; add test that a missing VAPID key causes early return with a log.

### Validation
- `npm run lint`
- `npm run build`
- `npm test -- pushWorker`

---

## T-006 — Changed Badges

### Scope
Track which list entries have been modified by other users or the API since the current user last viewed the list. Show a count badge on each list card in the overview; show per-entry badges inside the list; clear all badges when the list is opened.

### Acceptance Criteria
- **Overview**: `ListCardHome` shows a numeric badge when `changed_count > 0`; badge disappears after the user opens and returns from the list.
- **Detail**: Entries with `is_changed = true` show a small pill badge (`New` / `Edited` / `Done`); badges are gone on the next open.
- Only changes by **other** users or via **API** (no authenticated user, `last_updated_by IS NULL`) count.
- Changes made by the **current user** never produce a badge for that user.

### Backend Implementation

#### Migration A — `last_updated_by` on entries
File: `backend/src/db/migrations/<timestamp>_add_last_updated_by_to_entries.cjs`
```sql
ALTER TABLE entries ADD COLUMN last_updated_by uuid REFERENCES users(id) ON DELETE SET NULL;
```

#### Migration B — `list_views` table
File: `backend/src/db/migrations/<timestamp>_add_list_views.cjs`
```sql
CREATE TABLE list_views (
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  list_id   uuid NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  last_viewed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, list_id)
);
```

#### Entries routes (`backend/src/routes/entries.js`)
- `POST /api/lists/:id/entries` — set `last_updated_by = req.user.sub` in the INSERT.
- `PATCH /api/lists/:id/entries/:entryId` — set `last_updated_by = req.user.sub` in the UPDATE.
- `GET /api/lists/:id/entries` — join with `list_views`; add `is_changed` boolean per entry:
  ```
  is_changed = (
    e.updated_at > COALESCE(lv.last_viewed_at, '-infinity') AND
    (e.last_updated_by IS NULL OR e.last_updated_by <> req.user.sub)
  )
  ```

#### Lists route (`backend/src/routes/lists.js`)
- `GET /api/lists` — LEFT JOIN with `list_views` and subquery on `entries`; add `changed_count` per list:
  ```
  changed_count = COUNT(*) FILTER WHERE (
    e.updated_at > COALESCE(lv.last_viewed_at, '-infinity') AND
    (e.last_updated_by IS NULL OR e.last_updated_by <> current_user_id)
  )
  ```

#### New endpoint — `POST /api/lists/:id/mark-viewed`
File: `backend/src/routes/lists.js` (or new `markViewed.js`)
```
POST /api/lists/:id/mark-viewed
Auth: required + list access
Body: none
Effect: UPSERT list_views SET last_viewed_at = NOW() WHERE user_id = req.user.sub AND list_id = :id
Response: 204
```

### Frontend Implementation

#### Types (`frontend/src/types.ts`)
- Add `changed_count?: number` to `List`.
- Add `is_changed?: boolean` to `Entry`.

#### API (`frontend/src/api/lists.ts`)
- Ensure `fetchLists` result maps `changed_count` through.

#### API (`frontend/src/api/entries.ts`)  
- Ensure `fetchEntries` result maps `is_changed` through.

#### New API function (`frontend/src/api/lists.ts`)
- `markListViewed(token, listId): Promise<void>` — `POST /api/lists/:id/mark-viewed`.

#### ListCardHome (`frontend/src/components/ListCardHome/ListCardHome.tsx` + `.module.css`)
- Accept `changedCount?: number` prop; render a numeric badge chip when `> 0`.

#### OverviewPage (`frontend/src/pages/OverviewPage/OverviewPage.tsx`)
- Pass `list.changed_count` to `ListCardHome`.

#### EntryTile (`frontend/src/components/EntryTile/EntryTile.tsx` + `.module.css`)
- Accept `isChanged?: boolean` and `changeKind?: 'new' | 'edited' | 'done'` props (derive `changeKind` from entry status and creation vs update time).
- Render a pill badge when `isChanged` is true.

#### ListDetailPage (`frontend/src/pages/ListDetailPage/ListDetailPage.tsx`)
- On initial data load (entries fetched), call `markListViewed(token, listId)`.
- Pass `is_changed` and derived `changeKind` to `EntryTile`.
- After `markListViewed` succeeds, clear `is_changed` on all local entries so badges do not reappear without a reload.

#### i18n
- `frontend/src/locales/de/translation.json` — add `entry.changeNew`, `entry.changeEdited`, `entry.changeDone`.
- `frontend/src/locales/en/translation.json` — same keys.

### Tests to Update/Add
- `backend/src/entries.test.js` — verify `last_updated_by` is set on create/update; verify `is_changed` logic.
- `backend/src/lists.test.js` — verify `changed_count` in list response.
- New test file or section in `backend/src/lists.test.js` for `mark-viewed` endpoint.

### Validation
- `npm run lint`
- `npm run build`
- `npm test`

---

## Validation Summary (full cycle)
```
npm run lint
npm run build
npm test
```
