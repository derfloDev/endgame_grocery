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
| T-001 | DB migration: `autocomplete_history` table + `pg_trgm` extension | done | Migration runs up/down without error; lint and build pass | `backend/src/db/migrations.test.js` pass; `npm run lint` pass; `npm run build` pass; `npm test` fails in existing `backend/src/license.test.js` license header assertion | none |
| T-002 | Backend: `GET /suggestions` endpoint + upsert on `POST /entries` | done | Suggestions ranked by use_count; typo-tolerant; upsert increments count; all tests pass | `backend/src/entries.test.js` pass; `backend/src/suggestions.test.js` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-003 | Frontend: `useAutocomplete` hook + `fetchSuggestions` API client | done | Hook debounces 300 ms; skips < 2 chars; offline fuzzy filter; tests pass | `frontend/src/hooks/useAutocomplete.test.js` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
| T-004 | Frontend: `AutocompleteSuggestions` component + `AddItemSheet` integration | done | Chips ≥ 44 px; tap adds item directly; empty = no render; tests pass | `frontend/src/components/AutocompleteSuggestions.test.jsx` pass; `frontend/src/components/AddItemSheet.test.jsx` pass; `npm run lint` pass; `npm run build` pass; `npm test` pass | none |
