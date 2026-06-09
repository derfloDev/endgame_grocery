# Plan

Status: **ready**

Goal: Deliver two features — "leave shared list" and "list sorting on overview page" — as defined in `ROADMAP.md`.

---

## T-001 — Backend: Leave shared list endpoint

### Scope
Add `DELETE /api/lists/:id/leave` to the lists router.  
A non-owner member calls this to remove themselves from `list_members`.  
The list owner receives an e-mail notification.  
An SSE `member:removed` event is broadcast to all remaining list members.

### Rules
- Respond **403** when the calling user owns the list (owners must delete the list instead).
- Respond **404** when the calling user is not a member of the list.
- Respond **204** on success.
- Reuse `sendRevocationEmail` pattern from `sharing.js` but email the **owner** (not the leaving member).  
  Add a new Handlebars template `member-left.hbs` for "a member left your list" copy.
- The route lives in `createListRouter` (not `createSharingRouter`) because it is a self-service action that does not require list ownership.

### Files to change
| File | Change |
|------|--------|
| `backend/src/routes/lists.js` | Add `router.delete("/:id/leave", ...)` handler; inject `mailer` and `sseManager` dependencies already present on `createListRouter` (add `mailer` param if missing) |
| `backend/src/mail/templates/member-left.hbs` | **New** — "a member has left your list" owner notification template (reuse `{{> base ...}}` pattern) |
| `backend/src/lists.test.js` | Add tests: 204 success, 403 owner attempt, 404 not-a-member, SSE broadcast called, mailer called |

---

## T-002 — Backend: Expose `created_at` and `last_activity` on list response

### Scope
Extend `GET /api/lists` to return two additional fields per list:
- `created_at` — the list's own `created_at` timestamp.
- `last_activity` — `GREATEST(MAX(e.updated_at), l.created_at)` across all entries of the list (falls back to `l.created_at` when the list has no entries).

These fields enable client-side sorting in T-004.

### SQL change
Replace the current `ORDER BY l.created_at ASC` query with a version that also exposes these fields via a `LEFT JOIN LATERAL` or a correlated subquery — either approach is acceptable.

```sql
-- Example lateral addition (alongside the existing changes lateral join)
LEFT JOIN LATERAL (
  SELECT COALESCE(MAX(e.updated_at), l.created_at) AS last_activity
  FROM entries e
  WHERE e.list_id = l.id
) activity ON true
```

Return `l.created_at` and `activity.last_activity` in the result row mapping.

### Files to change
| File | Change |
|------|--------|
| `backend/src/routes/lists.js` | Add `l.created_at` and `activity.last_activity` to SELECT + lateral join; include both in the JSON response map |
| `backend/src/lists.test.js` | Add / update tests asserting `created_at` and `last_activity` are present in the response |

---

## T-003 — Frontend: Leave shared list UI

### Scope
Expose a "Leave list" action for non-owner lists:
1. **ListCard (Overview):** Non-owner lists gain a `⋮` menu button (same pattern as owner cards). The menu contains a single "Leave list" action; a `window.confirm` guard precedes the API call. On confirm, optimistically remove the list from state.
2. **ListOptionsSheet (Detail page):** Extend the sheet to render for non-owners too (currently `if (!open || !isOwner) return null`). Non-owners see only "Leave list"; owners continue to see Rename + Share.
3. After leaving from the detail page, navigate back to `/` (overview).
4. The `leaveList` API call is `DELETE /api/lists/:id/leave`.

### Design notes
- `ListCardHome` already has `onDelete`; add a parallel `onLeave?: () => void` prop.
- `ListOptionsSheet` receives an `onLeaveSelect?: () => void` prop and renders the leave row only when `!isOwner`.
- `OverviewPage`: call `leaveList(token, list.id)`, then `updateLists` to filter out the list on success.
- `ListDetailPage`: call `leaveList(token, listId)`, then `navigate("/")` on success. Wire through `showOptions` → `ListOptionsSheet` leave callback.

### i18n keys to add (EN + DE)
| Key | EN | DE |
|-----|----|----|
| `list.leaveList` | Leave list | Liste verlassen |
| `list.leaveListDesc` | Remove yourself from this shared list | Dich selbst aus dieser geteilten Liste entfernen |
| `list.leaveConfirm` | Leave this shared list? | Diese geteilte Liste verlassen? |

### Files to change
| File | Change |
|------|--------|
| `frontend/src/api/sharing.ts` | Add `leaveList(listId, token)` → `DELETE /api/lists/:id/leave` |
| `frontend/src/components/ListCardHome/ListCardHome.tsx` | Add `onLeave` prop; render `⋮` button + "Leave list" menu row for `!is_owner` cards |
| `frontend/src/components/ListCardHome/ListCardHome.test.tsx` | Test: non-owner card shows menu button; clicking Leave triggers `onLeave` |
| `frontend/src/components/ListOptionsSheet/ListOptionsSheet.tsx` | Remove early-return guard on `!isOwner`; add `onLeaveSelect` prop; render leave row when `!isOwner` |
| `frontend/src/pages/OverviewPage/OverviewPage.tsx` | Add `handleLeave(listId)` handler; pass `onLeave` to `ListCardHome` |
| `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` | Add `handleLeave()` handler; pass `onLeaveSelect` to `ListOptionsSheet`; navigate on success |
| `frontend/src/locales/en/translation.json` | Add `list.leaveList`, `list.leaveListDesc`, `list.leaveConfirm` |
| `frontend/src/locales/de/translation.json` | Add DE equivalents |

---

## T-004 — Frontend: List sorting on overview page

### Scope
Add a sort control to the overview header. Sorting is client-side; the sort preference is persisted in `localStorage` under key `overview_sort`.

### Sort options
| Value | Label | Sort key |
|-------|-------|----------|
| `created_asc` | Creation date (oldest first) *(default)* | `created_at` ascending |
| `name_asc` | Name (A → Z) | `name` ascending, locale-aware |
| `activity_desc` | Last change (newest first) | `last_activity` descending |

### Implementation notes
- Read `localStorage.getItem("overview_sort")` on mount; fall back to `"created_asc"` if absent or invalid.
- Write to `localStorage` on every sort change.
- Implement a pure `sortLists(lists, mode)` function (testable in isolation) in `OverviewPage.tsx` or a co-located utility.
- Render a `<select>` element (or equivalent) in `overview-brand` div with an accessible `<label>` visually hidden.
- Apply `sortLists` before rendering the list map.
- The `List` type gains `created_at?: string` and `last_activity?: string`; `OverviewList` inherits them.
- Offline cached data may lack the new fields — treat `undefined` as `""` (sorts to bottom) rather than crashing.

### i18n keys to add (EN + DE)
| Key | EN | DE |
|-----|----|----|
| `overview.sortLabel` | Sort lists | Listen sortieren |
| `overview.sortCreatedAsc` | Oldest first | Älteste zuerst |
| `overview.sortNameAsc` | Name (A–Z) | Name (A–Z) |
| `overview.sortActivityDesc` | Recently changed | Zuletzt geändert |

### Files to change
| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `created_at?: string` and `last_activity?: string` to `List` interface |
| `frontend/src/pages/OverviewPage/OverviewPage.tsx` | Add `sortMode` state + `sortLists` function; add sort `<select>` in header; apply sort before render |
| `frontend/src/pages/OverviewPage/OverviewPage.module.css` | Add styles for sort control row in overview header |
| `frontend/src/locales/en/translation.json` | Add `overview.sort*` keys |
| `frontend/src/locales/de/translation.json` | Add DE equivalents |
| `frontend/src/pages/OverviewPage/OverviewPage.test.tsx` | **New** — tests for `sortLists` logic (all three modes) and sort select render/interaction |

---

## Validation (all tasks)

```
npm run lint
npm run build
npm test
```

## Task order

T-001 and T-002 are independent backend tasks (both touch `lists.js` in separate sections).  
T-003 and T-004 are independent frontend tasks (both touch `OverviewPage.tsx` and translation files — implementer should pick one at a time to avoid merge conflicts or implement them sequentially in a single session).
