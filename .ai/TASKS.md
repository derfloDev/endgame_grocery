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
| T-001 | Backend: SseManager + /api/events-Route | done | 401 ohne/ungültigen Token; korrekte SSE-Headers + Heartbeat bei gültigem Token; Verbindung wird beim Close bereinigt; Unit-Tests für SseManager.add/remove/sendToUsers/broadcastToList | `npm run lint`; `npm run build`; `npm test`; `npm run test --workspace backend -- src/sseManager.test.js src/routes/events.test.js` | none |
| T-002 | Backend: SSE-Events nach Mutations (entries, lists, sharing) | done | broadcastToList wird nach jedem erfolgreichen POST/PATCH/DELETE aufgerufen; nicht bei 4xx-Antworten; list:deleted broadcast vor DB-DELETE | `npm run lint`; `npm run build`; `npm test`; `npm run test --workspace backend -- src/entries.test.js src/lists.test.js src/sharing.test.js src/invites.test.js src/auth.test.js` | none |
| T-003 | Frontend: EventSourceContext + useListEvents-Hook | ready_for_implement | EventSource wird bei Token geöffnet und bei Logout geschlossen; Handler werden für eingehende Events aufgerufen; listId-Filter in useListEvents funktioniert; EventSourceProvider in main.jsx eingebunden | n/a | implement |
| T-004 | Frontend: OverviewPage + ListDetailPage reagieren auf SSE-Events | ready_for_implement | list:updated/list:deleted → loadLists() in OverviewPage; entry:*/member:* → gezielter Refetch in ListDetailPage; Handler-Referenzen sind stabil (useCallback) | n/a | implement |
