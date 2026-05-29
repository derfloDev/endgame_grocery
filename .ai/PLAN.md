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

## T-007 — ListDetailPage TopBar Top-Padding Fix

### Scope
The shared `TopBar` component used on the List Detail page still has a top padding of `52px`. Apply the same fix as T-001 (which only touched `OverviewPage.module.css`).

### Acceptance Criteria
- `TopBar.module.css`: top padding changed from `52px` to `16px` (full rule: `padding: 16px 16px 12px`).
- Lint and build pass.

### Files to Change
- `frontend/src/components/ui/TopBar/TopBar.module.css` — change `padding: 52px 16px 12px` → `padding: 16px 16px 12px`.

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

## T-008 — Icon Database Entries for New Icons

### Scope
The four icons added in T-003 (`dishwasherTabs`, `nutNougatCream`, `maultaschen`, `herbs`) have no entries in `iconDatabase.ts` and are therefore never suggested when users type matching terms. Add the required `ICON_DB` entries including German and English synonyms.

### Acceptance Criteria
- Typing "spülmaschinentabs", "tabs", "finish tabs", "dishwasher tablet" etc. suggests `CustomDishwasherTabs`.
- Typing "nutella", "nuss-nougat", "nuss nougat creme", "haselnussaufstrich", "chocolate spread" etc. suggests `CustomNutNougatCream`.
- Typing "maultaschen", "maultasche", "schwäbische maultaschen", "pasta pockets" etc. suggests `CustomMaultaschen`.
- Typing "kräuter", "petersilie", "basilikum", "rosmarin", "herb bunch" etc. suggests `CustomHerbs`.
- The `"nutella"` and `"aufstrich"` tags are **removed from the existing `jam` entry** to avoid misdirecting "nutella" to the jam icon.
- Existing icon database tests still pass; a new test verifies each of the four new exact-match terms resolves to the correct icon.

### Files to Change
- `frontend/src/data/iconDatabase.ts`
  - Remove `"nutella"` and `"aufstrich"` from the `jam` entry's tags (keep `"marmelade"`, `"konfitüre"`, `"fruchtaufstrich"` etc.).
  - Add four new `ICON_DB` entries (suggested placement: Household Cleaning section for dishwasherTabs; Spreads/Condiments section for nutNougatCream; Meals/Prepared Foods section for maultaschen; Produce/Herbs section for herbs):

  ```ts
  { label: "dishwasher tabs", icon: "CustomDishwasherTabs",
    tags: ["spülmaschinentabs", "spülmaschinentab", "spuelmaschinentabs",
           "geschirrspültabs", "geschirrspueltabs", "tabs", "finish tabs",
           "dishwasher tablet", "dishwasher pod", "spülmittel tabs", "spuelmittel tabs"] },

  { label: "nut nougat cream", icon: "CustomNutNougatCream",
    tags: ["nutella", "nuss-nougat-creme", "nuss nougat creme", "nussnugatcreme",
           "nuss nougat", "haselnussaufstrich", "hazelnut spread", "chocolate spread",
           "schokocreme", "nougat aufstrich", "aufstrich", "kakaoaufstrich"] },

  { label: "maultaschen", icon: "CustomMaultaschen",
    tags: ["maultasche", "schwäbische maultaschen", "schwaebische maultaschen",
           "pasta pockets", "nudeltaschen", "german pasta", "filled pasta",
           "schwäbische küche", "schwäbische nudeln"] },

  { label: "herbs", icon: "CustomHerbs",
    tags: ["kräuter", "krauter", "kräuterbund", "kraeuter", "petersilie", "rosmarin",
           "basilikum", "thymian", "schnittlauch", "minze", "dill", "koriander",
           "fresh herbs", "herb bunch", "frische kräuter", "gewürzkräuter"] },
  ```

- `frontend/src/data/iconDatabase.test.ts` (create if it does not exist, or extend existing icon suggestion tests)
  - Verify `EXACT_MATCH_MAP["spülmaschinentabs"] === "CustomDishwasherTabs"`.
  - Verify `EXACT_MATCH_MAP["nutella"] === "CustomNutNougatCream"`.
  - Verify `EXACT_MATCH_MAP["maultaschen"] === "CustomMaultaschen"`.
  - Verify `EXACT_MATCH_MAP["petersilie"] === "CustomHerbs"`.
  - Verify `EXACT_MATCH_MAP["nutella"] !== "CustomJam"` (regression guard).

### Validation
- `npm run lint`
- `npm test -- iconDatabase`

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

## T-009 — Fix Entry Change Badges (T-006 rework)

### Root Cause
Two bugs prevent the per-entry change badges from working correctly after T-006.

**Bug 1 — Badges cleared before the user sees them**
In `useListDetailData.ts`, `markListViewed` is called immediately after entries are loaded, and on success it calls `clearChangedFlags(entries)`, wiping the `is_changed` flags before React has a chance to paint. The badges therefore never appear.

Fix: remove the `clearChangedFlags` call after `markListViewed`. The server-side `last_viewed_at` has already been updated, so on the *next* load `is_changed` will come back as `false` from the API. This matches the user requirement: "badges disappear when I open the list the next time."

**Bug 2 — Badge positioned inside the card instead of flush with the border**
Current CSS: `top: 6px; right: 6px` — badge is inset.
Required: badge sits at the top-right corner, overlapping the border edge ("bündig mit dem Rahmen"), using `top: 0; right: 0; transform: translate(50%, -50%)`. The card needs `overflow: visible` so the badge isn't clipped.

### Acceptance Criteria
- When opening a list that has `is_changed` entries, the NEW/EDITED/DONE badge is **visible** on the entry tile.
- The badge is positioned at the top-right corner of the tile, centred on the border edge (translate 50%, -50%).
- On the **next** open of the same list, the badges are gone (server-side `last_viewed_at` has been updated).
- No `clearChangedFlags` call inside `markListViewed`'s `.then()`.
- Existing EntryTile tests still pass.

### Files to Change
- `frontend/src/pages/ListDetailPage/useListDetailData.ts`
  - In `loadListDetail`, remove the `.then(() => setEntries(clearChangedFlags(...)))` callback from the `markListViewed` call. Keep the fire-and-forget call itself so `last_viewed_at` is still updated.
  - The `clearChangedFlags` helper can be left in file (used nowhere else, but harmless) or removed.
- `frontend/src/components/EntryTile/EntryTile.module.css`
  - Change `.entry-tile-change-badge`: `top: 6px; right: 6px` → `top: 0; right: 0; transform: translate(50%, -50%)`.
  - Add `overflow: visible` to `.entry-tile` so the badge is not clipped by the card boundary.

### Validation
- `npm run lint`
- `npm test -- EntryTile`

---

## T-010 — Fix badge corner radius, bottom-left corner, and self-done badge (T-009 rework)

### Root Causes & New Requirement

**Bug 1 — Badge top-right corner looks slightly clipped**
`--radius-md: 12px`, tile `border: 1px solid`. `overflow: hidden` clips at inner radius = `12px - 1px = 11px`. Without an explicit `border-top-right-radius` on the badge, its square corner is clipped at 11px and the outer card corner is 12px — visible as a tiny mismatch.

Fix: `border-top-right-radius: calc(var(--radius-md) - 1px)` on the badge to match the inner clip radius exactly.

**Bug 2 — Badge bottom-left corner should be sharp (0 radius)**
Currently `border-bottom-left-radius: 999px`. User wants `0`.

**Bug 3 — Done+changed entries appear in "open items" instead of "recently used"**
`visibleEntries = entries.filter(e => e.status === "open" || e.is_changed)` incorrectly pulls done+is_changed entries into the open section.

Fix: `visibleEntries` = only `status === "open"`. Done+is_changed surface via `changedDoneTexts` in recently-used.

**New: "Done" badge when the current user themselves completes an item**
When the user moves an item from open → done in the current session, it should immediately appear in "recently used" with a "Done" badge.

Fix: in `useListDetailData → toggleStatus`, set `is_changed: true` on the optimistic entry when `nextStatus === "done"`, and preserve it after the server response (spread server result first, then override `is_changed: true`).

### Acceptance Criteria
- Badge top-right corner is seamlessly flush with the outer card corner (no visible gap or clip artefact).
- Badge bottom-left corner is sharp (`border-bottom-left-radius: 0`).
- No `done` entry in the "open items" section.
- Done entries with `is_changed: true` (from others, API, **or self in current session**) appear in "recently used" with a "Done" badge.
- Same corner CSS applied to `recently-used-chip` badge.
- Tests pass.

### Files to Change

#### 1. `frontend/src/components/EntryTile/EntryTile.module.css`
- `.entry-tile`: ensure `overflow: hidden`.
- `.entry-tile-change-badge`: set `border-radius: 0 calc(var(--radius-md) - 1px) 0 0` (top-left: 0, top-right: 11px, bottom-right: 0, bottom-left: 0). Remove any `transform`.

#### 2. `frontend/src/pages/ListDetailPage/useListDetailData.ts` — `toggleStatus`
- Optimistic entry when `nextStatus === "done"`: add `is_changed: true`.
- Server-result update: spread `result.entry` first, then apply `...(nextStatus === "done" ? { is_changed: true } : {})` so the server's own-actor `is_changed: false` does not overwrite the local flag.

#### 3. `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`
- `visibleEntries`: `entries.filter(e => e.status === "open")` — remove `|| e.is_changed`.
- Add `changedDoneTexts`: `new Set(entries.filter(e => e.status === "done" && e.is_changed).map(e => e.text))`.
- Pass `changedDoneTexts` to `<RecentlyUsedSection>`.

#### 4. `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.tsx`
- Add `changedDoneTexts?: ReadonlySet<string>` prop.
- Render `<span className={styles["recently-used-change-badge"]}>{t("entry.changeDone")}</span>` inside the chip when `changedDoneTexts?.has(item.text)`.

#### 5. `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.module.css`
- `.recently-used-chip`: add `position: relative; overflow: hidden`.
- `.recently-used-change-badge`: `position: absolute; top: 0; right: 0; border-radius: 0 calc(var(--radius-md) - 1px) 0 0;` plus same colour/font tokens as `.entry-tile-change-badge`.

### Validation
- `npm run lint`
- `npm test -- EntryTile RecentlyUsedSection ListDetailPage`

---

## T-011 — Badge corner radius precision and self-done badge

### Scope
Three remaining badge issues after T-010.

### Issues

**1 — Top-right corner has a visible clip artefact**
`--radius-md: 12px`, `border: 1px`. CSS `overflow: hidden` clips at inner radius = `12px − 1px = 11px`. Without an explicit radius on the badge, its corner is clipped at 11px while the outer card corner is 12px — a visible mismatch.

Fix: `border-top-right-radius: calc(var(--radius-md) - 1px)` on both `.entry-tile-change-badge` and `.recently-used-change-badge`.

**2 — Bottom-left corner should have zero radius**
Currently `border-bottom-left-radius: 999px` (or whatever T-010 left). Change to `0`.

Fix: `border-radius: 0 calc(var(--radius-md) - 1px) 0 0` (shorthand: top-left 0, top-right 11px, bottom-right 0, bottom-left 0) on both badge classes.

**3 — Self-done badge: no badge when user completes an item themselves**
When the current user moves an item from open → done, it moves to "recently used" but shows no badge. User wants an immediate "Done" badge.

Fix: in `useListDetailData → toggleStatus`, when `nextStatus === "done"`, add `is_changed: true` to the optimistic entry. After the server response, preserve `is_changed: true` (spread server result first, then apply `...(nextStatus === "done" ? { is_changed: true } : {})`).

### Acceptance Criteria
- No visible gap or clipping at the badge's top-right corner on either tile or recently-used chip.
- Badge bottom-left corner is sharp (0 radius) on both tile and chip.
- When the user completes an item, the "Done" badge appears on the chip in "recently used" in the same session.
- Tests pass.

### Files to Change
- `frontend/src/components/EntryTile/EntryTile.module.css`
  - `.entry-tile-change-badge`: `border-radius: 0 calc(var(--radius-md) - 1px) 0 0`.
- `frontend/src/components/RecentlyUsedSection/RecentlyUsedSection.module.css`
  - `.recently-used-change-badge`: `border-radius: 0 calc(var(--radius-md) - 1px) 0 0`.
- `frontend/src/pages/ListDetailPage/useListDetailData.ts`
  - `toggleStatus`: set `is_changed: true` on optimistic entry when `nextStatus === "done"`, and preserve after server response.

### Validation
- `npm run lint`
- `npm test -- EntryTile RecentlyUsedSection ListDetailPage`

---

## Validation Summary (full cycle)
```
npm run lint
npm run build
npm test
```
