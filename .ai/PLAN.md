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

---

## T-006 – Frontend: InfoSheet API-Key-Sektion – Styling-Fix

### Problem
1. **Icon/Text-Alignment**: Buttons mit `<Icon>` + Text (Generate, Regenerate) nutzen `eg-btn-secondary` / `eg-btn-ghost`, die kein `display: inline-flex; align-items: center; gap` haben. Das `+`-Icon und der Label-Text sind dadurch nicht vertikal ausgerichtet.
2. **Falsches Icon**: Der „Neu generieren"-Button verwendet `<Icon name="plus">` – semantisch falsch (Plus = neu anlegen, nicht aktualisieren/ersetzen).
3. **Unaufgeräumtes Layout**: Abstand, Hierarchie und Konsistenz der API-Key-Sektion wirken unfertig.

### Fix-Strategie

#### 1. Globale Button-Basis-Fix in `shared.css`
Alle Button-Klassen erhalten `display: inline-flex; align-items: center; gap: 8px;`:
```css
.button-primary,
.eg-btn,
.eg-btn-primary,
.button-secondary,
.eg-btn-secondary,
.eg-btn-ghost,
.eg-btn-danger {
  /* bestehende Regeln … */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
```
Das behebt das Alignment-Problem überall, auch beim Logout-Button (die `info-sheet-logout`-Klasse kann dann `display/align-items/gap` entfernen, da redundant).

#### 2. Icon-Tausch in `InfoSheet.tsx`
- „Schlüssel generieren"-Button: `<Icon name="plus">` → `<Icon name="key">` (oder weglassen – ein Generate-Button braucht kein Icon)
- „Neu generieren"-Button: `<Icon name="plus">` → passendes Refresh-Icon (z. B. `<Icon name="refreshCw">` o. Ä., je nach vorhandenen Icons)

> **Vor der Implementierung**: Den `Icon`-Katalog prüfen (`frontend/src/components/ui/Icon` o. Ä.), welche Icon-Namen verfügbar sind, und das am besten passende „Refresh"-Icon wählen.

#### 3. CSS-Aufräumen in `InfoSheet.module.css`
- `.info-sheet-api-key` – Gap zwischen den Elementen auf `var(--space-3)` erhöhen für mehr Luft
- `.info-sheet-api-key-hint` – konsistente Bottom-Margin ergänzen (`margin-bottom: var(--space-1)`)
- `.info-sheet-logout` – redundante Flex-Regeln entfernen (nach globalem Fix in shared.css)
- Die beiden Buttons (Generate / Regenerate) mit `width: 100%` versehen, damit sie die volle Breite einnehmen und konsistent mit dem Logout-Button wirken

### Dateien
- **Aktualisiert**: `frontend/src/styles/shared.css` – `display: inline-flex; align-items: center; justify-content: center; gap: 8px` in die Button-Basis-Gruppe
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.tsx` – Icon-Namen korrigieren; Buttons auf `width: 100%` setzen (ggf. via CSS-Klasse)
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.module.css` – Gap, Hint-Margin, redundante Logout-Flex-Styles entfernen
- **Aktualisiert**: `frontend/src/components/InfoSheet/InfoSheet.test.tsx` – ggf. neue Icon-Namen in Snapshot-Tests anpassen (falls vorhanden)

### Keine verhaltensändernden Anpassungen
Nur visuelle/CSS-Korrekturen. Keine neuen i18n-Keys, keine API-Änderungen, kein Logik-Delta.

### Tests
- Bestehende Tests müssen weiterhin grün sein (`npm test`, `npm run lint`, `npm run build`).
- Falls Icon-Namen in Tests referenziert werden, anpassen.

---

---

## T-007 – Backend: Swagger UI – Trailing-Slash-Redirect + Middleware-Reihenfolge

### Ursache
`swagger-ui-express` generiert HTML mit relativen Asset-Pfaden (`./swagger-ui-bundle.js`, `./swagger-ui.css`). Wenn der Browser `/api/docs` (ohne abschließenden `/`) aufruft, löst er diese relativen Pfade relativ zum **Elternverzeichnis** `/api/` auf – nicht zu `/api/docs/`. Ergebnis: Der Browser sucht die Assets unter `/api/swagger-ui.css` statt `/api/docs/swagger-ui.css`.

Zusätzlich ist die Middleware-Reihenfolge in `docs.js` falsch: `swaggerUi.setup` steht vor `swaggerUi.serve`, obwohl `serve` zuerst kommen muss, damit statische Assets korrekt ausgeliefert werden.

### Fix 1 – Redirect in `app.js`

Vor dem `app.use('/api/docs', ...)` eine explizite `app.get`-Route einfügen, die ohne Trailing Slash auf die Version mit Slash weiterleitet:

```js
// in createApp(), vor dem docs-Router:
app.get("/api/docs", (_req, res) => res.redirect(301, "/api/docs/"));
app.use("/api/docs", docsRoutes(routerOptions));
```

### Fix 2 – Middleware-Reihenfolge in `docs.js`

`swaggerUi.serve` muss **vor** `swaggerUi.setup` registriert sein:

```js
// Vorher (falsch):
router.get("/", swaggerUi.setup(spec));
router.use("/", swaggerUi.serve);

// Nachher (korrekt):
router.use("/", swaggerUi.serve);
router.get("/", swaggerUi.setup(spec));
```

### Dateien
- **Aktualisiert**: `backend/src/app.js` – `app.get('/api/docs', redirect)` vor `app.use('/api/docs', ...)`
- **Aktualisiert**: `backend/src/routes/docs.js` – `swaggerUi.serve` vor `swaggerUi.setup`
- **Aktualisiert**: `backend/src/docs.test.js` – Test dass `GET /api/docs` → 301 auf `/api/docs/`

### Tests
- `GET /api/docs` → 301, `Location: /api/docs/`
- `GET /api/docs/` → 200, Content-Type `text/html`
- `GET /api/docs/openapi.yaml` → 200, Content-Type `application/yaml`
- Bestehende Tests bleiben grün

---

---

## T-008 – Backend: v1 API – HA-Statusmapping entfernen

### Änderung
Das ursprüngliche HA-Statusmapping (`open` → `needs_action`, `done` → `completed`) wird entfernt. Die v1 API gibt den DB-Statuswert direkt zurück: `open` oder `done`.

### Dateien

#### `backend/src/routes/v1.js`
- Funktion `toHaStatus()` **entfernen**
- Funktion `serializeItem()` vereinfachen – `status` direkt aus dem DB-Row übernehmen:
  ```js
  // Vorher:
  function toHaStatus(dbStatus) {
    return dbStatus === "done" ? "completed" : "needs_action";
  }
  function serializeItem(row) {
    return { id: row.id, name: row.text, status: toHaStatus(row.status) };
  }

  // Nachher:
  function serializeItem(row) {
    return { id: row.id, name: row.text, status: row.status };
  }
  ```

#### `backend/src/v1.test.js`
- Alle Assertions, die `needs_action` oder `completed` erwarten, auf `open` bzw. `done` ändern.

#### `backend/src/openapi/v1.yaml`
- Überall wo der Item-Status als Enum definiert ist, von `[needs_action, completed]` auf `[open, done]` ändern.
- Beschreibungstexte entsprechend anpassen.

#### `ROADMAP.md`
- Zeile `Entry-Status-Mapping: DB open ↔ HA needs_action; DB done ↔ HA completed` entfernen oder auf „Status wird unverändert zurückgegeben: `open` | `done`" aktualisieren.

### Keine sonstigen Änderungen
Toggle-Logik in `v1.js` (`open` ↔ `done`) bleibt unverändert – sie arbeitet bereits mit DB-Werten. Frontend und andere Backend-Routen sind nicht betroffen.

---

---

## T-009 – Backend: v1 API – UUID-Validierung für Pfadparameter

### Ursache
Wenn ein Pfadparameter keine gültige UUID ist (z. B. Swagger-UI-Platzhalter `{listId}` oder freie Texteingabe), leitet der aktuelle Code die Zeichenkette direkt an PostgreSQL weiter. PostgreSQL wirft dann einen Fehler `invalid input syntax for type uuid`, Express fängt ihn nicht spezifisch ab, und die globale Fehlerbehandlung antwortet mit 500.

### Fix

#### Hilfsfunktion in `backend/src/routes/v1.js`
```js
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === "string" && UUID_RE.test(id);
}
```

#### Validierung in allen Routen mit `:listId` oder `:itemId`
Vor dem ersten DB-Zugriff (d. h. vor `ensureListAccess` oder der Query) prüfen:
```js
if (!isValidUuid(req.params.listId)) {
  res.status(404).json({ error: "List not found." });
  return;
}
// bei itemId analog:
if (!isValidUuid(req.params.itemId)) {
  res.status(404).json({ error: "Item not found." });
  return;
}
```

Betroffen sind alle vier Routen mit Pfadparametern:
- `GET /api/v1/lists/:listId/items`
- `POST /api/v1/lists/:listId/items`
- `POST /api/v1/lists/:listId/items/:itemId/toggle`
- `DELETE /api/v1/lists/:listId/items/:itemId`

### Dateien
- **Aktualisiert**: `backend/src/routes/v1.js` – `isValidUuid`-Hilfsfunktion + Guards in 4 Routen
- **Aktualisiert**: `backend/src/v1.test.js` – neue Tests: `listId = '{listId}'` → 404; `itemId = 'not-a-uuid'` → 404

### Tests (Pflicht)
- `GET /lists/{listId}/items` mit Literal `{listId}` → 404
- `POST /lists/{listId}/items` mit Literal `{listId}` → 404
- `POST /lists/valid-uuid/items/{itemId}/toggle` mit Literal `{itemId}` → 404
- `DELETE /lists/valid-uuid/items/not-a-uuid` → 404
- Bestehende Tests bleiben grün

---

---

## T-010 – Backend: v1 API – Item umbenennen

### Neuer Endpunkt

```
PATCH /api/v1/lists/:listId/items/:itemId
```

**Request Body:** `{ "name": "Neuer Name" }`  
**Response 200:** `{ "item": { "id", "name", "status" } }`

### Logik

```
1. isValidUuid(listId) → 404 wenn ungültig
2. isValidUuid(itemId) → 404 wenn ungültig
3. name fehlt oder leer → 400 { error: "Item name is required." }
4. ensureListAccess(pool, listId, userId) → 403 wenn kein Zugriff
5. UPDATE entries SET text = $1, updated_at = NOW()
   WHERE id = $2 AND list_id = $3
   RETURNING id, text, status
6. rows[0] fehlt → 404 { error: "Item not found." }
7. res.json({ item: serializeItem(rows[0]) })
```

### Dateien

- **Aktualisiert**: `backend/src/routes/v1.js`
  - Neue Route `router.patch("/lists/:listId/items/:itemId", ...)` nach dem Toggle-Handler
- **Aktualisiert**: `backend/src/v1.test.js`
  - Tests: fehlender Name → 400; 403 bei fremder Liste; 404 bei unbekanntem Item; 404 bei ungültiger UUID; 200 mit aktualisiertem Item
- **Aktualisiert**: `backend/src/openapi/v1.yaml`
  - Neuer Path `patch /lists/{listId}/items/{itemId}` mit Request-Body-Schema und Response-Schemas (200, 400, 401, 403, 404)
- **Aktualisiert**: `ROADMAP.md`
  - Endpunkt-Liste um `PATCH /api/v1/lists/:listId/items/:itemId – Item umbenennen` ergänzen

### Tests (Pflicht)
- `PATCH` ohne `name` → 400
- `PATCH` mit `name: "  "` (nur Leerzeichen) → 400
- `PATCH` mit ungültiger `listId`-UUID → 404
- `PATCH` mit ungültiger `itemId`-UUID → 404
- `PATCH` auf fremde Liste → 403
- `PATCH` auf nicht-existentes Item → 404
- `PATCH` mit gültigem `name` → 200, `item.name` aktualisiert

---

---

## T-011 – Backend: v1 API – SSE-Broadcasts nach Mutationen

### Problem
Der v1-Router ruft `sseManager.broadcastToList()` nach keiner seiner Mutationen auf. Die Web-App empfängt daher keine SSE-Events, wenn Änderungen über die externe API vorgenommen werden, und zeigt den veralteten Stand, bis der User manuell neu lädt.

### Zu sendende Events (analog zu `entries.js`)

| v1-Mutation | SSE-Event |
|-------------|-----------|
| `POST /lists/:listId/items` (Create) | `entry:created` |
| `POST /lists/:listId/items/:itemId/toggle` | `entry:updated` |
| `PATCH /lists/:listId/items/:itemId` (Rename) | `entry:updated` |
| `DELETE /lists/:listId/items/:itemId` | `entry:deleted` |

### Änderungen in `backend/src/routes/v1.js`

`sseManager` wird bereits via `routerOptions` an den Router übergeben (in `app.js` ist `sseManager` Teil von `routerOptions`). Die Funktion `createV1Router` muss es nur entgegennehmen und nutzen.

```js
// Signatur erweitern:
export function createV1Router({ pool, requireApiKey, sseManager = defaultSseManager } = {}) { ... }

// Nach erfolgreichem INSERT (Create):
void sseManager.broadcastToList(pool, req.params.listId, "entry:created", {
  listId: req.params.listId,
  entryId: result.rows[0].id
}).catch((err) => logger.error({ err }, "Failed to broadcast SSE event"));

// Nach UPDATE (Toggle, Rename):
void sseManager.broadcastToList(pool, req.params.listId, "entry:updated", {
  listId: req.params.listId,
  entryId: req.params.itemId
}).catch((err) => logger.error({ err }, "Failed to broadcast SSE event"));

// Nach DELETE:
void sseManager.broadcastToList(pool, req.params.listId, "entry:deleted", {
  listId: req.params.listId,
  entryId: req.params.itemId
}).catch((err) => logger.error({ err }, "Failed to broadcast SSE event"));
```

Wichtig: `void` + `.catch()` – identisches Muster wie in `entries.js`. Der Broadcast darf die HTTP-Response nicht blockieren.

### Logger
`v1.js` benötigt einen Logger für `.catch()`-Fehlerausgaben. `logger` ebenfalls aus `routerOptions` entgegennehmen (analog zu anderen Routern):
```js
export function createV1Router({ pool, requireApiKey, sseManager = defaultSseManager, logger = defaultLogger } = {}) { ... }
```

### Dateien
- **Aktualisiert**: `backend/src/routes/v1.js` – `sseManager` + `logger` in Signatur; Broadcasts in 4 Mutations-Handlern
- **Aktualisiert**: `backend/src/v1.test.js` – `sseManager`-Spy übergeben; prüfen dass Broadcast nach jeder Mutation aufgerufen wird (Spy-Pattern wie in `lists.test.js` oder `entries.test.js`)

### Tests (Pflicht)
- Create-Endpoint: `sseManager.broadcastToList` mit Event `entry:created` aufgerufen
- Toggle-Endpoint: `sseManager.broadcastToList` mit Event `entry:updated` aufgerufen
- Rename-Endpoint: `sseManager.broadcastToList` mit Event `entry:updated` aufgerufen
- Delete-Endpoint: `sseManager.broadcastToList` mit Event `entry:deleted` aufgerufen
- Fehler im Broadcast (Spy wirft) führt **nicht** zu einem 500 – Response ist trotzdem 2xx

---

## Implementierungsreihenfolge

```
T-001 → T-002 → T-003 → T-004 → T-005 → T-006
                                           ↓
                                   T-007 (Bugfix T-004)
                                   T-008 (Rework T-003)
                                   T-009 (Bugfix T-003)
                                   T-010 (Erweiterung v1)
                                   T-011 (Erweiterung v1)
```

T-001 bis T-004 sind Backend-Aufgaben; T-005 und T-006 sind Frontend. T-006 (Styling-Fix) setzt T-005 voraus. Jede Aufgabe kann in einem einzigen Commit landen.

## Validation

```bash
npm run lint
npm run build
npm test
```
