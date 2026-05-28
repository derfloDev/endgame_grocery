# ROADMAP

Goal: Deliver a set of client-quality improvements covering UI polish, UX fixes, new icons, PWA update flow, push notification reliability, and a new "changed badges" feature for shared lists.

## Priority 1 — Styling Fixes

Objective: Fix three visual issues reported on mobile.

- `overview-topbar` top padding: reduce from `52px` to `16px`.
- FAB (`+` button): change `bottom` to `16px` to match the `16px` right margin on narrow screens.
- AddItemSheet icon-browser grid: add `min-height` so at least two icon rows are always visible even when the on-screen keyboard is open.

## Priority 2 — Enter-Key UX in AddItemSheet

Objective: Pressing Enter in the title input should submit the item, not advance focus to the Details field.

- Add `onKeyDown` handler on the title `<input>` that calls `handleSubmit` and prevents default when `key === "Enter"`.
- Add `enterKeyHint="done"` on the title input for correct mobile keyboard hint.
- No change to the Details field behaviour.

## Priority 3 — New Icons (4)

Objective: Add four new custom SVG icons to the icon registry.

- **Spülmaschinentabs** — illustration of several dishwasher tabs.
- **Nuss-Nougat-Creme** (Nutella) — illustration of a glass jar for nut-nougat cream.
- **Maultaschen** — illustration of three Maultaschen (German pasta pockets).
- **Kräuter** (Petersilie / Rosmarin / Basilikum) — illustration of a herb bunch.

Each icon: SVG in `frontend/src/assets/icons/custom/`, wrapped as a React component in `customIcons.tsx`, registered in `iconRegistry.ts`.

## Priority 4 — PWA Update Banner

Objective: When a new app version is deployed, the PWA should prompt the user to reload instead of requiring logout/login.

- Change `frontend/src/sw/register.ts` to use `useRegisterSW` from `virtual:pwa-register/react` with an `onNeedRefresh` callback.
- Add an `UpdateBanner` component (dismissible toast/banner) that appears when a new SW version is waiting.
- Clicking the banner calls `updateServiceWorker(true)` to skip waiting and reload.
- Wire into `App.tsx` (or the protected layout) so the banner is visible on all logged-in pages.
- i18n keys for the banner text (de + en).

## Priority 5 — Push Notifications Debug & Fix

Objective: Investigate why push notifications are never delivered and fix the root cause.

- Systematically audit the push notification pipeline:
  1. `usePushNotifications.ts`: verify the subscription is saved with the correct token and that the VAPID public key fetch succeeds.
  2. Backend `routes/push.js`: verify the subscription INSERT is reaching the DB.
  3. Backend `pushWorker.js`: add structured logging for each step (job found, cooldown check, recipients, subscriptions, `webpushLib.sendNotification` result/error).
  4. Service-worker push handler: verify the SW receives the push event.
- Fix any confirmed bug found during audit.
- The `buildNotificationBody` mixing German strings will also be fixed (move to a locale-neutral format or consistent language).

## Priority 6 — Changed Badges

Objective: Show how many items have changed in a shared list (by other users or via API) since the current user last opened it. Inside the list, flag individual changed items. Badges clear on next open.

### Backend
- **Migration A**: Add `last_updated_by uuid REFERENCES users(id)` (nullable) to `entries`.
- **Migration B**: Add `list_views` table: `(user_id uuid, list_id uuid, last_viewed_at timestamptz, PRIMARY KEY (user_id, list_id))`.
- **Entries routes**: Set `last_updated_by = req.user.sub` on INSERT and UPDATE. For API-key requests, leave NULL.
- **Lists route** (`GET /api/lists`): include `changed_count` per list — count of entries where `updated_at > last_viewed_at AND (last_updated_by IS NULL OR last_updated_by <> current_user_id)`. Use `0` when no `list_views` row exists.
- **Entries route** (`GET /api/lists/:id/entries`): include `is_changed boolean` per entry using the same condition.
- **New endpoint**: `POST /api/lists/:id/mark-viewed` — upserts `list_views` with `last_viewed_at = NOW()`. Requires auth + list access.

### Frontend
- **OverviewPage / ListCardHome**: show a numeric badge when `changed_count > 0`.
- **ListDetailPage / EntryTile**: show a small badge (`NEW` / `EDITED` / `DONE`) on entries where `is_changed = true`. Call `mark-viewed` on mount (when list data is first loaded).
- **Types**: extend `List` with `changed_count?: number`, extend entry type with `is_changed?: boolean`.
- **i18n**: add keys for badge labels (de + en).
- **Clearing**: after `mark-viewed` is called, refetch or clear `is_changed` flags locally so badges disappear without a full reload.
