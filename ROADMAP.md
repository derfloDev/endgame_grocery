# ROADMAP

Goal: Deliver two user-facing improvements to list management: leave-shared-list and list sorting.

## Priority 1 — Leave shared list (Unfollow)

Objective: Let a non-owner member remove themselves from a list shared with them.

- A member (non-owner) can leave a shared list from both the ListCard in the overview and from the list detail page (via list options).
- The list immediately disappears from their overview and they lose access.
- The list owner receives an e-mail notification that the member left (consistent with the existing revoke-notification flow).
- Owners cannot use the "leave" action on their own lists (they must delete the list instead).

### Acceptance Criteria
- `DELETE /api/lists/:id/leave` endpoint removes the calling user from `list_members` (403 if they are the owner, 404 if they are not a member).
- An e-mail is sent to the list owner after a successful leave.
- An SSE `member:removed` event is broadcast to remaining list members.
- The ListCard for non-owner lists exposes a menu button that opens a "Leave list" bottom sheet with a confirmation action.
- The list detail page exposes a "Leave list" option in the list options sheet for non-owners.
- Both entry points optimistically remove the list from the UI on confirmation.
- i18n keys added for DE and EN.
- Tests cover the new backend endpoint and the frontend interaction.

## Priority 2 — List sorting on the overview page

Objective: Let the user sort their list overview by name, creation date, or date of last change.

- A compact sort control appears in the overview header (dropdown or segmented control).
- Sort options: Name (A→Z), Creation date (oldest first), Last change (newest first).
- Default sort when no preference is stored: Creation date ascending (preserves existing behaviour).
- The chosen sort preference is persisted in localStorage and restored on next visit.
- "Last change" is defined as the most recent `entries.updated_at` within the list; if the list has no entries, the list's own `created_at` is used as fallback.

### Acceptance Criteria
- Backend `GET /api/lists` response includes `created_at` and `last_activity` (max entry `updated_at`, falling back to list `created_at`) for each list.
- Frontend sorts the already-fetched list array client-side using these fields.
- Sort state is stored in `localStorage` key `overview_sort` and rehydrated on mount.
- Sort control is rendered in the overview header and is accessible (label + aria).
- i18n keys added for DE and EN.
- Tests cover sort logic and the sort-control render/interaction.
