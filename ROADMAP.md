# ROADMAP

Goal: Home Assistant Integration – externe REST-API mit API-Key-Authentifizierung und OpenAPI-Dokumentation (Swagger UI).

## Priority 1 – API-Key-Verwaltung

Objective: Jeder User kann in „Info & Einstellungen" einen eindeutigen API-Key erzeugen und einsehen.

- Ein API-Key pro User (UUID, generiert via `crypto.randomUUID`).
- Bestehender Key wird bei Regenerierung sofort ungültig.
- Key wird in der DB gespeichert (neue Spalte `api_key` in `users`).
- Frontend zeigt den Key im InfoSheet mit „Kopieren"- und „Neu generieren"-Button.
- Backend: `POST /api/auth/api-key` – erzeugt oder erneuert den API-Key des eingeloggten Users (JWT-Auth).
- Backend: `GET /api/auth/api-key` – gibt den aktuellen API-Key des eingeloggten Users zurück (JWT-Auth).

## Priority 2 – Externe REST-API v1

Objective: Fünf Home-Assistant-taugliche Endpunkte unter `/api/v1/`, gesichert via `X-Api-Key`-Header.

Constraints:
- Auth: `X-Api-Key: <key>` Header – kein JWT, kein Bearer Token.
- Scope: Listen, die der User besitzt **oder** bei denen er Mitglied ist.
- Entry-Status-Mapping: DB `open` ↔ HA `needs_action`; DB `done` ↔ HA `completed`.
- Toggle-Endpunkt: kein Body erforderlich, Status wird automatisch umgeschaltet.

Endpunkte:
1. `GET /api/v1/lists` – alle Listen des authentifizierten Users.
2. `GET /api/v1/lists/:listId/items` – alle Einträge einer Liste (mit Ownership-Check).
3. `POST /api/v1/lists/:listId/items` – neues Item anlegen (`{ "name": "..." }`).
4. `POST /api/v1/lists/:listId/items/:itemId/toggle` – Status umschalten (`open` ↔ `done`).
5. `DELETE /api/v1/lists/:listId/items/:itemId` – Item endgültig löschen.

Response-Format für Items: `id`, `name` (mapped von `text`), `status` (`needs_action` | `completed`).

## Priority 3 – OpenAPI-Dokumentation & Swagger UI

Objective: Die v1-API ist vollständig dokumentiert und über den Backend-Server erreichbar.

- OpenAPI 3.1-Spec als statische Datei `backend/src/openapi/v1.yaml`.
- Swagger UI serviert unter `GET /api/docs` via `swagger-ui-express`.
- Spec-Datei erreichbar unter `GET /api/docs/openapi.yaml` (raw YAML).
- Dokumentation umfasst alle 5 Endpunkte inkl. Authentifizierung, Request/Response-Schemas und Fehlerresponses.

## Acceptance Criteria (gesamt)

- API-Key kann im Frontend erzeugt, angezeigt und kopiert werden.
- Alle 5 v1-Endpunkte funktionieren mit gültigem API-Key.
- Ungültiger/fehlender Key → 401.
- Zugriff auf fremde Liste → 403.
- Swagger UI ist unter `/api/docs` erreichbar und zeigt alle Endpunkte.
- Minor-Release (neue MINOR-Version via `Release-As` im Cycle-Close-Commit).
