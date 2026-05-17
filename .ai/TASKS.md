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
| T-001 | DB-Migration: `api_key`-Spalte in `users` | done | Migration läuft fehlerfrei durch; `api_key` UUID nullable unique in `users`; down-Migration entfernt Spalte wieder | `node --test src/db/migrations.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-002 | Backend: API-Key-Management-Endpoints + `createRequireApiKey`-Middleware | done | `GET /api/auth/api-key` liefert aktuellen Key (null wenn keiner); `POST /api/auth/api-key` erzeugt/erneuert Key; Middleware setzt `req.user.sub` bei gültigem Header, 401 sonst; alle Tests grün | `node --test src/auth.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-003 | Backend: Externe REST-API v1 (5 Endpunkte) | done | Alle 5 Endpunkte unter `/api/v1/` funktionieren mit gültigem `X-Api-Key`; Status-Mapping `open`↔`needs_action`, `done`↔`completed` korrekt; 401 bei fehlendem/ungültigem Key; 403 bei fremder Liste; 404 bei unbekanntem Item; alle Tests grün | `node --test src/v1.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-004 | Backend: OpenAPI 3.1-Spec + Swagger UI | done | `GET /api/docs` liefert Swagger UI (HTTP 200); `GET /api/docs/openapi.yaml` liefert YAML (Content-Type application/yaml); Spec dokumentiert alle 5 v1-Endpunkte inkl. Schemas und Fehlerresponses | `node --test src/docs.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-005 | Frontend: API-Key-Verwaltung im InfoSheet | done | InfoSheet zeigt API-Key-Sektion; Key kann erzeugt, angezeigt und kopiert werden; Neu-generieren aktualisiert angezeigten Key; i18n-Keys in DE+EN vorhanden; alle Tests grün | `npm run test --workspace frontend -- InfoSheet.test.tsx`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-006 | Frontend: InfoSheet API-Key-Sektion – Styling-Fix | done | Icon und Button-Text sind vertikal zentriert ausgerichtet; „Neu generieren" verwendet ein Refresh-Icon statt Plus; Layout der API-Key-Sektion ist aufgeräumt und konsistent; alle bestehenden Tests grün | `npm run test --workspace frontend -- InfoSheet.test.tsx shared.test.ts ui.test.tsx`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-007 | Backend: Swagger UI – Trailing-Slash-Redirect + Middleware-Reihenfolge | done | `GET /api/docs` leitet auf `GET /api/docs/` weiter (301); Swagger UI lädt CSS und JS-Assets korrekt; keine Konsolenfehler; bestehende Tests grün | `node --test src/docs.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-008 | Backend: v1 API – HA-Statusmapping entfernen, rohe DB-Werte zurückgeben | done | Item-Status in allen v1-Responses ist `open` oder `done` (keine Umwandlung in `needs_action`/`completed`); OpenAPI-Spec zeigt Enum `open \| done`; Tests grün | `node --test src/v1.test.js src/docs.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-009 | Backend: v1 API – UUID-Validierung für Pfadparameter | done | Ungültige `listId`/`itemId` (z. B. Literal `{listId}`) → 404 statt 500; kein PostgreSQL-UUID-Fehler mehr; Tests grün | `node --test src/v1.test.js src/docs.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-010 | Backend: v1 API – Item umbenennen (`PATCH /api/v1/lists/:listId/items/:itemId`) | done | `PATCH` mit `{ "name": "..." }` benennt Item um; 400 wenn kein Name; 403 bei fremder Liste; 404 bei unbekanntem Item oder ungültiger UUID; Response enthält aktualisiertes Item; OpenAPI-Spec dokumentiert neuen Endpunkt; Tests grün | `node --test src/v1.test.js src/docs.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
| T-011 | Backend: v1 API – SSE-Broadcasts nach Mutationen | done | Nach Create/Toggle/Delete/Rename werden SSE-Events an alle List-Subscriber gesendet; Web-App aktualisiert sich ohne Reload; bestehende Tests grün | `node --test src/v1.test.js`, `npm run lint`, `npm run build`, `npm test` passed | none |
