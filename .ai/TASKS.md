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
| T-001 | Backend: drop autocomplete_history table, rewrite history + suggestions routes to query entries, remove upsertAutocompleteHistory from entries.js and v1.js, update all backend tests | done | GET /history returns last 20 done entries per list without user_id filter; DELETE /history route removed; GET /suggestions queries entries table per list_id only; autocomplete_history table absent after migration; no upsertAutocompleteHistory call sites remain; all backend tests pass | `node --test src/history.test.js src/suggestions.test.js src/entries.test.js src/v1.test.js src/db/migrations.test.js` pass; `npm run lint` pass with existing frontend warning; `npm run build` pass; `npm test` pass | none |
| T-002 | Frontend: remove deleteFromHistory, remove dismiss button from RecentlyUsedSection, remove dismissRecentlyUsedEntry from useListDetailData, update frontend tests | ready_for_implement | deleteFromHistory export removed; dismiss button absent from RecentlyUsedSection UI; dismissRecentlyUsedEntry removed from useListDetailData return value; ListDetailPage no longer passes onDismiss; all frontend tests pass | n/a | implement |
