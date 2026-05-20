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
| T-001 | Dead Code Scan & Removal (frontend + backend) | done | Keine ungenutzten Importe/Variablen (ts-unused-exports clean); `npm run lint && npm run build && npm test` grün | `npx ts-unused-exports tsconfig.json` clean; `npx depcheck` clean; `npm run lint`, `npm run build`, `npm test` pass | none |
| T-002 | Backend DRY: `ensureListAccess` → `middleware/listAccess.js` | ready_for_implement | Funktion nur noch in middleware/listAccess.js; alle 4 Route-Dateien importieren sie; Backend-Tests grün | n/a | implement |
| T-003 | Backend JSDoc Annotations (route factories + key helpers) | ready_for_implement | Alle exportierten Backend-Funktionen haben @param/@returns JSDoc; `npm run lint` grün | n/a | implement |
| T-004 | Frontend Refactoring: `useListDetailData`-Hook aus ListDetailPage extrahieren | ready_for_implement | ListDetailPage.tsx < 400 Zeilen; Hook in eigenem File; Frontend-Tests grün | n/a | implement |
| T-005 | Security Audit & Dependency Upgrades (npm audit fix + bcrypt v6 + node-pg-migrate v8 + @xenova/transformers) | ready_for_implement | `npm audit` ohne critical/high in Prod-Deps (oder dokumentierte Ausnahmen); `npm run build && npm test` grün | n/a | implement |
