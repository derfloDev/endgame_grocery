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
| T-001 | Frontend: preserve `details` through the recently-used pipeline (types, state, component, hooks, call sites, tests) | done | (1) Re-added entry from "Zuletzt Verwendet" carries original description; (2) entries without description unaffected; (3) unit + integration tests pass; (4) lint, build, test green | `npm run test --workspace frontend -- recentlyUsedState RecentlyUsedSection ListDetailPage`; `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Backend: v1 toggle endpoint upserts `autocomplete_history` when status → done; extract shared `upsertAutocompleteHistory` utility; extend v1 tests | done | (1) Toggle open→done writes history row with correct userId/listId/text/icon; (2) Toggle done→open skips history upsert; (3) History failure does not affect response; (4) lint, build, test green | `node --test src/v1.test.js`; `node --test src/v1.test.js src/entries.test.js src/docs.test.js src/jsdoc.test.js`; `npm run lint`; `npm run build`; `npm test` | none |
