# PLAN — Instant Updates via Server-Sent Events

Status: **ready_for_implement**

Goal: Einkaufslisten und deren Einträge aktualisieren sich automatisch auf allen verbundenen Geräten in Echtzeit, ohne manuelle Seitenaktualisierung.

## Gewählter Ansatz

**Server-Sent Events (SSE)** über `GET /api/events`. Mutations laufen weiterhin über REST; SSE ist ausschließlich der Benachrichtigungskanal. Nach jeder erfolgreichen Mutation sendet der Server ein Event an alle berechtigten, gerade verbundenen Clients. Die Clients reagieren mit einem Refetch der betroffenen Daten.

---

## Architektur-Überblick

```
Client A (Gerät 1)              Server                    Client B (Gerät 2)
──────────────────              ──────                    ─────────────────
POST /api/lists/:id/entries  →  entries-Route
                                 └─ DB INSERT
                                 └─ sseManager.broadcastToList()
                                      └─ query: owner + members von listId
                                      └─ send event an alle Connections dieser User
                                                            ← SSE event: entry:created {listId}
                                                            fetchEntries(id, token) →
                                                            ← aktueller Eintragsstand
```

### SSE-Verbindungslebenszyklus
- Verbindung wird beim Login/Seitenaufruf mit gültigem Token geöffnet (innerhalb `AuthProvider`)
- Heartbeat alle 30 s (`:heartbeat\n\n`) verhindert Proxy-Timeouts
- Beim Logout oder Token-Verlust wird die Verbindung geschlossen
- Native `EventSource` auto-reconnect ist aktiv; bei 401 wird kein Reconnect versucht

### Token-Übertragung für SSE
`EventSource` unterstützt keine Custom-Header. Das JWT wird als Query-Parameter übergeben:
```
GET /api/events?token=<jwt>
```
Der SSE-Endpunkt prüft primär `req.query.token` (Fallback auf `Authorization`-Header für Tests).

### SSE Event-Format
```
event: entry:created
data: {"listId":"<uuid>","entryId":"<uuid>"}

event: entry:updated
data: {"listId":"<uuid>","entryId":"<uuid>"}

event: entry:deleted
data: {"listId":"<uuid>","entryId":"<uuid>"}

event: list:updated
data: {"listId":"<uuid>"}

event: list:deleted
data: {"listId":"<uuid>"}

event: member:added
data: {"listId":"<uuid>","userId":"<uuid>"}

event: member:removed
data: {"listId":"<uuid>","userId":"<uuid>"}
```

---

## Acceptance Criteria

- AC1: Entry auf Gerät A → Gerät B sieht Update in < 2 s (ohne manuelle Aktualisierung)
- AC2: Liste umbenannt auf Gerät A → Übersichtsseite auf Gerät B aktualisiert sich in < 2 s
- AC3: Auto-Reconnect bei Verbindungsabbruch (native EventSource-Verhalten)
- AC4: Offline-Geräte erhalten beim nächsten Seitenaufruf aktuelle Daten (kein Rückschritt)
- AC5: `/api/events` erfordert gültigen Token; 401 ohne/bei ungültigem Token
- AC6: Bestehende Push-Notifications bleiben unberührt

---

## Implementierungsreihenfolge

1. **T-001** — Backend-Infrastruktur (SseManager + Route) → unabhängig
2. **T-002** — Backend-Broadcast in Mutations → abhängig von T-001
3. **T-003** — Frontend-Context + Hooks → unabhängig von T-001/T-002 (kann parallel zu T-001)
4. **T-004** — Seiten verdrahten → abhängig von T-003

---

## T-001 — Backend: SseManager + /api/events-Route

### Ziel
SSE-Infrastruktur auf dem Backend bereitstellen.

### Neue Dateien

#### `backend/src/sseManager.js`
- `SseManager`-Klasse: verwaltet offene SSE-Verbindungen pro User (`Map<userId, Set<res>>`)
- Methoden:
  - `add(userId, res)` — Verbindung registrieren
  - `remove(userId, res)` — Verbindung entfernen, leere Sets bereinigen
  - `sendToUsers(userIds, eventType, data)` — Event an alle Verbindungen der angegebenen User senden; schreibfehler einzelner Verbindungen mit try-catch abfangen
  - `broadcastToList(pool, listId, eventType, data)` — ermittelt per DB-Query alle berechtigten User (`owner_id` aus `lists` + `user_id` aus `list_members`) und ruft `sendToUsers` auf
- Export: `sseManager`-Singleton und `SseManager`-Klasse (für Tests)

#### `backend/src/routes/events.js`
- `createEventsRouter({ requireAuthFn, sseManager })` — Factory-Funktion
- `GET /` prüft Token aus `req.query.token` (primär) oder `Authorization`-Header (Fallback, nützlich für automatische Tests)
- Bei ungültigem/fehlendem Token: HTTP 401
- Bei gültigem Token: SSE-Headers setzen (`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`), `res.flushHeaders()`, Verbindung in SseManager registrieren
- Heartbeat-Interval alle 30 s (`:heartbeat\n\n`)
- `req.on("close")`: Interval clearen, Verbindung aus SseManager entfernen

### Geänderte Dateien

#### `backend/src/app.js`
- Import: `createEventsRouter` aus `./routes/events.js`, `sseManager` aus `./sseManager.js`
- Route registrieren: `app.use("/api/events", createEventsRouter({ requireAuthFn, sseManager }));`
- `sseManager` in `options` aufnehmen und an alle Router-Factories weiterreichen (Vorbereitung für T-002)
- `requireAuthFn`-Helper aus JWT-Secret ableiten (analog zu bestehenden Middleware-Fabriken)

### Tests

#### `backend/src/sseManager.test.js` (neu)
- `add` / `remove`: Map wird korrekt befüllt und bereinigt
- `sendToUsers`: schreibt korrektes SSE-Format an alle Verbindungen; überspringt geschlossene Verbindungen
- `broadcastToList`: stellt korrekte SQL-Query; ruft `sendToUsers` mit den User-IDs auf

#### `backend/src/routes/events.test.js` (neu, oder Erweiterung von `index.test.js`)
- 401 ohne Token
- 401 bei ungültigem Token
- 200 mit korrekten SSE-Headers bei gültigem Token
- Verbindung wird beim Request-Close aus SseManager entfernt

---

## T-002 — Backend: SSE-Events nach Mutations

### Ziel
Nach jeder erfolgreichen Mutation ein SSE-Event broadcasten.

### Geänderte Dateien

#### `backend/src/routes/entries.js`
Erhält `sseManager` als Parameter in `createEntryRouter`. Nach jedem erfolgreichen DB-Write (vor `res.json()`), fire-and-forget mit `void`:

| Route | Event-Typ | Payload |
|-------|-----------|---------|
| `POST /` | `entry:created` | `{ listId: req.params.id, entryId: result.rows[0].id }` |
| `PATCH /:entryId` | `entry:updated` | `{ listId: req.params.id, entryId: req.params.entryId }` |
| `DELETE /:entryId` | `entry:deleted` | `{ listId: req.params.id, entryId: req.params.entryId }` |

#### `backend/src/routes/lists.js`
Erhält `sseManager` als Parameter in `createListRouter`.

| Route | Event-Typ | Payload | Besonderheit |
|-------|-----------|---------|--------------|
| `PATCH /:id` | `list:updated` | `{ listId: req.params.id }` | — |
| `DELETE /:id` | `list:deleted` | `{ listId: req.params.id }` | Broadcast **vor** dem DELETE-Query, damit die Mitglieder-IDs noch bekannt sind |

#### `backend/src/routes/sharing.js`
Erhält `sseManager` als Parameter in `createSharingRouter`.

| Route | Event-Typ | Payload |
|-------|-----------|---------|
| `POST /` (Mitglied hinzugefügt) | `member:added` | `{ listId: req.params.id, userId: <neu hinzugefügter userId> }` |
| `DELETE /:uid` (Mitglied entfernt) | `member:removed` | `{ listId: req.params.id, userId: req.params.uid }` |

### Tests
Bestehende Test-Dateien erweitern (`entries.test.js`, `lists.test.js`, `sharing.test.js`):
- `sseManager`-Mock/Spy als Dependency injizieren
- Nach jeder Mutation prüfen, dass `broadcastToList` mit korrekten Argumenten aufgerufen wurde
- Prüfen, dass `broadcastToList` bei fehlgeschlagener Mutation (4xx-Antworten) **nicht** aufgerufen wird

---

## T-003 — Frontend: EventSourceContext + useListEvents-Hook

### Ziel
Globale SSE-Verbindung im Frontend; gefilterte Event-Subscription pro Seite.

### Neue Dateien

#### `frontend/src/context/EventSourceContext.jsx`
- `EventSourceProvider`: öffnet `EventSource` wenn `token` vorhanden, schließt bei Logout
- Verwaltet intern `Map<eventType, Set<handler>>` (via `useRef`) für alle bekannten Event-Typen
- Exponiert `addEventListener(type, handler) → () => void` (cleanup-Funktion)
- Bei 401 (`es.onerror` + readyState): Connection schließen, kein manuelles Reconnect (native EventSource reconnectet bei transienten Fehlern; 401 wird durch Schließen verhindert)
- Export: `EventSourceProvider`, `useEventSource`

Bekannte Event-Typen (für `es.addEventListener`-Registrierung):
```
"entry:created", "entry:updated", "entry:deleted",
"list:updated", "list:deleted",
"member:added", "member:removed"
```

#### `frontend/src/hooks/useListEvents.js`
```js
/**
 * Lauscht auf ein SSE-Event für eine bestimmte Liste.
 * @param {string} eventType  — z.B. "entry:created"
 * @param {string|null} listId — nur Events dieser Liste werden weitergereicht; null = alle
 * @param {(data: object) => void} handler — stabile Referenz (useCallback) empfohlen
 */
export function useListEvents(eventType, listId, handler) { ... }
```
- Ruft `addEventListener` aus `useEventSource` auf
- Filtert: `!listId || data.listId === listId`
- Cleanup bei Unmount / Dependency-Änderung

### Geänderte Dateien

#### `frontend/src/main.jsx`
`EventSourceProvider` innerhalb `AuthProvider`, außerhalb `OfflineQueueProvider`:
```jsx
<AuthProvider>
  <EventSourceProvider>
    <OfflineQueueProvider>
      <App />
    </OfflineQueueProvider>
  </EventSourceProvider>
</AuthProvider>
```

### Tests

#### `frontend/src/context/EventSourceContext.test.jsx` (neu)
- Mock `window.EventSource` (Klasse mit `addEventListener`, `close`, `onerror`)
- Token gesetzt → EventSource wird geöffnet
- Token entfernt → `close()` wird aufgerufen
- Eingehende Events → registrierte Handler werden aufgerufen
- Handler-Cleanup: nach `removeEventListener`-Rückgabe keine weiteren Aufrufe

#### `frontend/src/hooks/useListEvents.test.js` (neu)
- Handler wird aufgerufen wenn `data.listId === listId`
- Handler wird **nicht** aufgerufen wenn `data.listId !== listId`
- `listId = null` → Handler wird für alle Events aufgerufen
- Cleanup bei Unmount entfernt Handler

---

## T-004 — Frontend: Seiten lauschen auf Events

### Ziel
`OverviewPage` und `ListDetailPage` reagieren auf SSE-Events mit Refetch.

### Geänderte Dateien

#### `frontend/src/pages/OverviewPage.jsx`
- Importiert `useListEvents`
- `loadLists` als `useCallback` ist bereits vorhanden
- Zwei `useListEvents`-Aufrufe mit `listId = null` (betrifft alle Listen des Users):
  ```js
  const handleListChange = useCallback(() => { void loadLists(); }, [loadLists]);
  useListEvents("list:updated", null, handleListChange);
  useListEvents("list:deleted", null, handleListChange);
  ```

#### `frontend/src/pages/ListDetailPage.jsx`
- Importiert `useListEvents`
- Refetch-Funktionen als `useCallback` extrahieren:
  - `loadEntries` — ruft `fetchEntries(id, token)` auf und setzt `entries`-State
  - `loadMembers` — ruft `fetchListMembers(...)` auf und setzt `members`-State
- Entry-Events (gefiltert auf `id`):
  ```js
  const handleEntryChange = useCallback(() => { void loadEntries(); }, [loadEntries]);
  useListEvents("entry:created", id, handleEntryChange);
  useListEvents("entry:updated", id, handleEntryChange);
  useListEvents("entry:deleted", id, handleEntryChange);
  ```
- Member-Events (gefiltert auf `id`):
  ```js
  const handleMemberChange = useCallback(() => { void loadMembers(); }, [loadMembers]);
  useListEvents("member:added", id, handleMemberChange);
  useListEvents("member:removed", id, handleMemberChange);
  ```

**Hinweis:** Die bestehende `loadListDetail`-Funktion lädt alles auf einmal; für SSE-Reaktionen sind gezielte Einzelfetches sauberer. Die Refaktorierung auf separate Lade-Funktionen ist Teil dieser Task.

---

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
