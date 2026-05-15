# Plan

Status: **ready**

Goal: Home Assistant Integration – API-Key-Verwaltung, externe REST-API v1, OpenAPI-Dokumentation mit Swagger UI.

## Scope

- **T-001** DB-Migration: `api_key`-Spalte in `users`
- **T-002** Backend: API-Key-Management-Endpoints + `X-Api-Key`-Middleware
- **T-003** Backend: Externe REST-API v1 (5 Endpunkte)
- **T-004** Backend: OpenAPI 3.1-Spec + Swagger UI
- **T-005** Frontend: API-Key-Verwaltung im InfoSheet

## Acceptance Criteria

- User kann API-Key im InfoSheet erzeugen, einsehen und kopieren.
- `POST /api/auth/api-key` erzeugt/erneuert einen Key (JWT-Auth); `GET /api/auth/api-key` liefert den aktuellen Key.
- Alle 5 v1-Endpunkte funktionieren mit gültigem `X-Api-Key`-Header.
- Ungültiger/fehlender Key → 401; Zugriff auf fremde Liste → 403.
- Swagger UI unter `GET /api/docs` erreichbar; Raw-Spec unter `GET /api/docs/openapi.yaml`.
- `npm run lint`, `npm run build`, `npm test` sind grün.

---

## T-001 – DB-Migration: api_key-Spalte

### Ziel
Neue Spalte `api_key` (UUID, nullable, unique) in `users`.

### Dateien
- **Neu**: `backend/src/db/migrations/<timestamp>_add_api_key_to_users.cjs`
  - `pgm.addColumns("users", { api_key: { type: "uuid", unique: true } })`
  - `down`: `pgm.dropColumns("users", ["api_key"])`
- **Aktualisiert**: `backend/src/db/migrations.test.js`
  - Smoke-Test: Migration läuft ohne Fehler durch.

### Hinweise
- Timestamp: aktuell (z. B. `1747350000000`).
- Kein Default-Wert – `null` bis der User explizit einen Key anfordert.

---

## T-002 – Backend: API-Key-Endpoints + Middleware

### Ziel
Management-Endpoints für JWT-Auth-User und neues `createRequireApiKey`-Middleware für externe API.

### Neue Backend-Endpoints in `backend/src/routes/auth.js`

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| `GET`  | `/api/auth/api-key` | JWT Bearer | Gibt `{ api_key: string \| null }` zurück |
| `POST` | `/api/auth/api-key` | JWT Bearer | Erzeugt/erneuert Key → `{ api_key: string }` |

**POST-Logik:**
```
api_key = crypto.randomUUID()
UPDATE users SET api_key = $1 WHERE id = $2
RETURNING api_key
```

### Neues Middleware in `backend/src/middleware/auth.js`

```js
export function createRequireApiKey({ pool }) {
  return async function requireApiKey(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key) { res.status(401).json({ error: 'API key is required.' }); return; }
    const result = await pool.query(
      'SELECT id FROM users WHERE api_key = $1 LIMIT 1', [key]
    );
    if (!result.rows[0]) { res.status(401).json({ error: 'Invalid API key.' }); return; }
    req.user = { sub: result.rows[0].id };
    next();
  };
}
```

### Dateien
- **Aktualisiert**: `backend/src/routes/auth.js` – zwei neue Routes
- **Aktualisiert**: `backend/src/middleware/auth.js` – `createRequireApiKey` exportieren
- **Aktualisiert**: `backend/src/auth.test.js` – Tests für beide neuen Routes + Middleware-Tests

### Tests (Pflicht)
- `GET /api/auth/api-key` → 200 mit `{ api_key: null }` wenn noch kein Key
- `GET /api/auth/api-key` → 200 mit `{ api_key: "..." }` wenn Key vorhanden
- `POST /api/auth/api-key` → 200, Key im Response, Key in DB gesetzt
- `POST /api/auth/api-key` (zweites Mal) → 200, neuer Key, alter Key ungültig
- Middleware: fehlender Header → 401; unbekannter Key → 401; gültiger Key → `req.user.sub` gesetzt

---

## T-003 – Backend: Externe REST-API v1

### Ziel
Fünf Home-Assistant-taugliche Endpunkte unter `/api/v1/`, gesichert via `X-Api-Key`.

### Datei-Struktur
- **Neu**: `backend/src/routes/v1.js` – alle 5 Endpunkte
- **Aktualisiert**: `backend/src/app.js` – `import v1Routes from './routes/v1.js'` + `app.use('/api/v1', v1Routes(routerOptions))`
- **Neu**: `backend/src/v1.test.js` – Tests für alle Endpunkte

### Endpunkte

#### 1. `GET /api/v1/lists`
- Auth: `requireApiKey`
- Query: gleiche SQL wie `GET /api/lists` (owner + member)
- Response: `{ lists: [{ id, name }] }`

#### 2. `GET /api/v1/lists/:listId/items`
- Auth: `requireApiKey`
- Security: `ensureListAccess(pool, listId, userId)` → 403 wenn kein Zugriff
- Query: alle Entries der Liste
- Response: `{ items: [{ id, name, status }] }` (status: `needs_action` | `completed`)

#### 3. `POST /api/v1/lists/:listId/items`
- Auth: `requireApiKey`
- Body: `{ name: string }` (Pflichtfeld)
- Security: `ensureListAccess` → 403
- INSERT Entry mit `status = 'open'`
- Response 201: `{ item: { id, name, status: 'needs_action' } }`

#### 4. `POST /api/v1/lists/:listId/items/:itemId/toggle`
- Auth: `requireApiKey`
- Security: `ensureListAccess` → 403
- Liest aktuellen Status; flippt: `open` → `done`, `done` → `open`
- UPDATE Entry, RETURNING
- Response: `{ item: { id, name, status } }` (HA-gemapped)

#### 5. `DELETE /api/v1/lists/:listId/items/:itemId`
- Auth: `requireApiKey`
- Security: `ensureListAccess` → 403
- DELETE Entry; 404 wenn nicht gefunden
- Response 204: kein Body

### Status-Mapping (intern → HA)
```js
function toHaStatus(dbStatus) {
  return dbStatus === 'done' ? 'completed' : 'needs_action';
}
function toDbStatus(haStatus) {
  return haStatus === 'completed' ? 'done' : 'open';
}
function serializeItem(row) {
  return { id: row.id, name: row.text, status: toHaStatus(row.status) };
}
```

### `createV1Router` Signatur
```js
export function createV1Router({ pool, requireApiKey } = {}) { ... }
```
Im `app.js` wird `requireApiKey` via `createRequireApiKey({ pool })` erzeugt.

### Tests (Pflicht – alle mit Mock-Pool)
- Jeder Endpoint: fehlender Key → 401, fremde Liste → 403
- GET /api/v1/lists → korrekte Listenstruktur
- GET /api/v1/lists/:id/items → Status-Mapping korrekt
- POST create → 400 wenn kein `name`; 201 mit korrektem Item
- POST toggle → Status wird gekippt
- DELETE → 204; 404 wenn Item nicht gefunden

---

## T-004 – Backend: OpenAPI 3.1 Spec + Swagger UI

### Ziel
Vollständige API-Dokumentation, serviert als Swagger UI unter `/api/docs`.

### Abhängigkeiten
```bash
# im backend/-Verzeichnis:
npm install swagger-ui-express js-yaml
```

### Dateien
- **Neu**: `backend/src/openapi/v1.yaml` – OpenAPI 3.1-Spec
- **Neu**: `backend/src/routes/docs.js` – Router für `/api/docs`
- **Aktualisiert**: `backend/src/app.js` – `app.use('/api/docs', docsRoutes(routerOptions))`
- **Aktualisiert**: `backend/package.json` – neue Dependencies

### OpenAPI-Spec Inhalt (`v1.yaml`)
- `openapi: 3.1.0`
- `info.title: Endgame Grocery API`, `version: 1.0.0`
- `servers: [{ url: /api/v1 }]`
- `components.securitySchemes.ApiKeyAuth: { type: apiKey, in: header, name: X-Api-Key }`
- `security: [{ ApiKeyAuth: [] }]` (global)
- Alle 5 Paths dokumentiert inkl. Request Body, Response-Schemas, 401/403/404-Fehlerresponses

### `docs.js` Router
```js
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spec = load(readFileSync(path.join(__dirname, '../openapi/v1.yaml'), 'utf8'));

export function createDocsRouter() {
  const router = Router();
  router.get('/openapi.yaml', (_req, res) => {
    res.setHeader('Content-Type', 'application/yaml');
    res.sendFile(path.join(__dirname, '../openapi/v1.yaml'));
  });
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(spec));
  return router;
}
```

### Tests
- `GET /api/docs` → 200, HTML mit Swagger UI
- `GET /api/docs/openapi.yaml` → 200, Content-Type `application/yaml`

---

## T-005 – Frontend: API-Key-Verwaltung im InfoSheet

### Ziel
User kann im InfoSheet ("Info & Einstellungen") einen API-Key erzeugen, einsehen und kopieren.

### Neue API-Funktionen in `frontend/src/api/auth.ts`
```ts
export function fetchApiKey(token: string): Promise<{ api_key: string | null }> {
  return sendJsonRequest('/api/auth/api-key', { token }) as Promise<...>;
}

export function regenerateApiKey(token: string): Promise<{ api_key: string }> {
  return sendJsonRequest('/api/auth/api-key', { token, method: 'POST' }) as Promise<...>;
}
```

### InfoSheet-Erweiterung (`frontend/src/components/InfoSheet/InfoSheet.tsx`)

Neuer Abschnitt zwischen User-Identität und Sprach-Switcher:

```
[ API-Key-Label ]
[ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ] [ Kopieren ]
[ Neu generieren ]
```

**State:**
- `apiKey: string | null` – initialisiert per `GET /api/auth/api-key` beim Öffnen des Sheets
- `copySuccess: boolean` – kurze Bestätigung nach Kopieren
- `regenerating: boolean` – Loading-State während POST

**Verhalten:**
- Sheet öffnet → `fetchApiKey(token)` wird aufgerufen
- Kein Key vorhanden → Hinweistext + „Key generieren"-Button (löst `POST` aus)
- Key vorhanden → Key anzeigen (masked oder plain) + „Kopieren" + „Neu generieren"
- Kopieren: `navigator.clipboard.writeText(apiKey)` → kurzes "Kopiert!"-Feedback
- Neu generieren: Bestätigungs-Dialog oder direkt → `POST /api/auth/api-key`

### i18n-Keys (beide Locales)

| Key | DE | EN |
|-----|----|----|
| `settings.apiKey` | `API-Schlüssel` | `API Key` |
| `settings.apiKeyNone` | `Noch kein API-Schlüssel vorhanden.` | `No API key generated yet.` |
| `settings.apiKeyGenerate` | `Schlüssel generieren` | `Generate key` |
| `settings.apiKeyCopy` | `Kopieren` | `Copy` |
| `settings.apiKeyCopied` | `Kopiert!` | `Copied!` |
| `settings.apiKeyRegenerate` | `Neu generieren` | `Regenerate` |
| `settings.apiKeyHint` | `Verwende diesen Schlüssel für die Home Assistant Integration.` | `Use this key for the Home Assistant integration.` |

### Dateien
- **Aktualisiert**: `frontend/src/api/auth.ts`
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.tsx`
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.module.css` (ggf. neues Styling)
- **Aktualisiert**: `frontend/src/locales/de/translation.json`
- **Aktualisiert**: `frontend/src/locales/en/translation.json`
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.test.tsx`

### Tests (Pflicht)
- Sheet öffnet → `fetchApiKey` wird aufgerufen
- Key vorhanden → Key-Text und Kopieren-Button sichtbar
- Kein Key → „Noch kein API-Schlüssel"-Text und Generate-Button sichtbar
- Kopieren-Button → `navigator.clipboard.writeText` aufgerufen
- Neu-generieren → `regenerateApiKey` aufgerufen, neuer Key angezeigt

---

## Implementierungsreihenfolge

```
T-001 → T-002 → T-003 → T-004 → T-005
```

T-001 bis T-004 sind Backend-Aufgaben; T-005 ist das Frontend. Jede Aufgabe kann in einem einzigen Commit landen.

## Validation

```bash
npm run lint
npm run build
npm test
```
