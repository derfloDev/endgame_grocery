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
| T-001 | Fix push-notification subscription race condition in `usePushNotifications` | done | Button disabled until VAPID key loaded; subscribe/unsubscribe cycle completes; button label updates; lint + build + tests pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-002 | Unblock push-notification testing in Vite dev mode | done | `isReady` set on VAPID key load independent of SW; new regression test passes; lint + build + tests pass | `npm run lint`; `npm run build`; `npm test` | none |
| T-003 | Fix SW activation failure and redundant serviceWorker.ready wait in dev mode | ready_for_implement | SW activates in dev (DevTools shows "activated and running"); subscribe/unsubscribe cycle completes on localhost; subscribe() rejects with clear error within 8 s when SW unavailable; lint + build + tests pass | n/a | implement |
