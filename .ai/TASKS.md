# TASKS

Use this board to coordinate handoff between planner, implementer, and reviewer.

Status values:
- `in_planning`
- `ready_for_implement`
- `in_implementation`
- `ready_for_review`
- `in_review`
- `ready_to_commit`
- `changes_requested`
- `done`

Command expectations:
- planner moves tasks into `in_planning` and `ready_for_implement`
- implementer moves tasks into `in_implementation`, `ready_for_review`, and `done`, and resumes work from `changes_requested` and `ready_to_commit`
- reviewer moves tasks into `in_review`, `ready_to_commit`, or `changes_requested`
- `status_cycle` should report deterministic task status, current owner role, and next recommended action based on this board

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | Backend: `DELETE /api/lists/:id/leave` endpoint — non-owner self-removal from list_members; 403 for owner, 404 for non-member, 204 on success; SSE member:removed broadcast; owner e-mail notification via new member-left.hbs template | done | `DELETE /api/lists/:id/leave` returns 204 and removes member; returns 403 when caller is owner; returns 404 when caller is not a member; SSE broadcast called; mailer called with owner as recipient; tests pass | `node --test src/lists.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Backend: Expose `created_at` and `last_activity` on `GET /api/lists` response — last_activity = GREATEST(MAX(entries.updated_at), list.created_at) | done | GET /api/lists response includes `created_at` (ISO string) and `last_activity` (ISO string) per list; last_activity falls back to created_at when list has no entries; tests pass | `node --test src/lists.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Frontend: Leave shared list UI — non-owner ListCard menu with "Leave list" action; ListOptionsSheet leave option for non-owners; optimistic removal from overview; navigate to "/" after leaving from detail page; i18n DE+EN | done | Non-owner ListCard shows ⋮ menu with "Leave list"; non-owner ListOptionsSheet shows "Leave list" option; confirmation shown before leave; list removed from overview on success; detail page navigates to "/" on leave; leaveList API call uses DELETE /api/lists/:id/leave; i18n keys present in EN+DE; tests pass | focused frontend tests; `npm run lint`; `npm run build`; `npm test` | none |
| T-004 | Frontend: List sorting on overview page — sort by name/created_at/last_activity; sort control in overview header; localStorage persistence; default = created_asc; i18n DE+EN | ready_for_implement | Sort control renders in overview header with 3 options; selecting a sort option reorders the list immediately; preference is persisted in localStorage under key "overview_sort"; page reload restores the previously selected sort; offline cached lists without new fields do not crash; i18n keys present in EN+DE; sortLists unit tests pass | n/a | implement |
