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
| T-001 | Suchfunktion: Suchleiste auf ListDetailPage filtert offene Einträge nach Name und Details | done | Suchleiste sichtbar; filtert case-insensitiv; eigener EmptyState bei keinen Treffern; i18n de+en; bestehende Tests grün; Zeilen < 400 | `npm run lint`; `npm run build`; `npm test`; ListDetailPage.tsx: 389 lines | none |
| T-002 | Swipe-Fix: Vertikales Scrollen öffnet keine EntryTiles mehr | ready_for_implement | δY ≥ 8 px bricht Timer ab und blockiert Click; kurzes Tippen/langes Drücken unverändert; bestehende Tests grün | n/a | implement |
