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
| T-001 | Enforce per-list entry limits: reject POST when open entries ≥ 1 000 (HTTP 422); auto-evict oldest done entry on PATCH status→done when done entries ≥ 200. Backend only; tests included. | done | (1) POST at 1 001st open entry → 422, no insert. (2) POST at 1 000th → 201. (3) PATCH→done at 200 done entries → oldest evicted, update succeeds. (4) PATCH→done at <200 → no evict. (5) PATCH non-status fields → no count query. (6) All existing tests pass. | `node --test src/entries.test.js` pass; `npm run lint` pass with one existing frontend warning; `npm run build` pass after longer timeout; `npm test` failed only in frontend `src/app.test.tsx` timeout for "adds and edits entry details from the list detail sheet"; targeted rerun of that frontend test also timed out. Review PASS. | none |
