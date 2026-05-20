# Plan

Status: **ready_for_implement**

Goal: Code Cleanup, Sicherheits-Audit und Release 1.0.0 gemäß `ROADMAP.md`.

## Audit-Ergebnisse (Zusammenfassung)

| Kategorie | Befund | Priorität |
|-----------|--------|-----------|
| DRY-Verletzung | `ensureListAccess()` 4× dupliziert in entries.js, history.js, suggestions.js, v1.js | P0 |
| Sicherheit | `protobufjs` (critical, transitiv via @xenova/transformers); `bcrypt@5` + `node-pg-migrate@7` veraltet (high) | P0 |
| JSDoc | Alle Backend-Route-Factories und Hilfsfunktionen (auth.js, inviteService.js, sseManager.js) ohne JSDoc | P1 |
| Dead Code | Keine eindeutigen Fälle – statische Analyse (ts-unused-exports, depcheck) zur Bestätigung nötig | P1 |
| Refactoring | `ListDetailPage.tsx` (616 Zeilen, 11 useState-Hooks, ≥5 Verantwortlichkeiten) | P2 |
| Namenskonventionen | Vollständig konform – kein Handlungsbedarf | — |
| TypeScript | Exzellent – keine `any`-Typen, vollständige Return-Types | — |
| XSS / SQLi | Keine Risiken gefunden | — |
| Hardcoded Secrets | Keine gefunden | — |
| Fehlerbehandlung | Sicher – kein Stack-Trace in HTTP-Responses | — |
| Auth-Middleware | Konsistent auf alle geschützten Routen angewendet | — |

---

## Scope

### T-001 — Dead Code Scan & Removal

**Ziel:** Bestätigte tote Imports, Variablen und Funktionen entfernen.

**Vorgehen:**
1. `npx ts-unused-exports tsconfig.json` im Frontend ausführen und Ergebnis sichten.
2. `npx depcheck` im Root ausführen und ungenutzte Pakete identifizieren.
3. `frontend/src/workers/iconWorkerClient.ts` – prüfen, ob alle Exports verwendet werden.
4. Bestätigte Dead-Code-Funde entfernen. Bei Unsicherheit konservativ bleiben (nicht löschen).
5. `npm run lint && npm run build && npm test` grün bestätigen.

**Files to change:**
- Jede Datei mit bestätigtem Dead Code (erst nach Analyse bekannt).
- Keine Dokumentations-Updates erforderlich (keine API/Verhaltensänderung).

---

### T-002 — Backend DRY: `ensureListAccess` in Shared Middleware

**Ziel:** 4× identisch duplizierte `ensureListAccess`-Funktion in eine gemeinsame Datei auslagern.

**Vorgehen:**
1. Neue Datei `backend/src/middleware/listAccess.js` anlegen.
2. Funktion `ensureListAccess(pool, listId, userId)` mit vollständigem JSDoc dorthin verschieben.
3. In folgenden Dateien den lokalen Block entfernen und den Import ergänzen:
   - `backend/src/routes/entries.js` (Zeile 11–27)
   - `backend/src/routes/history.js` (Zeile 5–21)
   - `backend/src/routes/suggestions.js` (Zeile 5–21)
   - `backend/src/routes/v1.js` (Zeile 13–29)
4. `npm run lint && npm run build && npm test` grün bestätigen.

**Files to change:**
- `backend/src/middleware/listAccess.js` (neu)
- `backend/src/routes/entries.js`
- `backend/src/routes/history.js`
- `backend/src/routes/suggestions.js`
- `backend/src/routes/v1.js`

---

### T-003 — Backend JSDoc Annotations

**Ziel:** Alle exportierten und öffentlich genutzten Backend-Funktionen mit JSDoc (`@param`, `@returns`) versehen.

**Scope (prioritisiert):**

**`backend/src/routes/auth.js`:**
- `createAuthRouter({ pool, logger, config, mailer, jwtLib })` – Route-Factory
- `createToken({ jwtLib, config, userId })` – Token-Helper
- `addHours(date, hours)` – Datum-Helper
- `buildAppUrl(baseUrl, path)` – URL-Helper
- `isInviteEmailMatch(email, invite)` – Validierungs-Helper
- `serializeAuthUser(user)` – Serialisierungs-Helper
- `sendVerificationEmail({ config, mailer, token, user })`
- `sendPasswordResetEmail(...)` / `sendInviteEmail(...)`

**`backend/src/routes/entries.js`:** `createEntryRouter(...)` – Factory
**`backend/src/routes/lists.js`:** `createListRouter(...)` – Factory
**`backend/src/routes/sharing.js`:** `createSharingRouter(...)` – Factory
**`backend/src/routes/history.js`:** `createHistoryRouter(...)` – Factory
**`backend/src/routes/suggestions.js`:** `createSuggestionsRouter(...)` – Factory
**`backend/src/routes/push.js`:** Route-Factory (falls vorhanden)

**`backend/src/inviteService.js`:**
- `getPendingInviteByToken(pool, token, now)`
- `acceptInviteForUser({ pool, invite, userId })`

**`backend/src/sseManager.js` (Klasse `SseManager`):**
- Klassen-JSDoc
- `add(userId, res)`, `remove(userId, res)`, `sendToUsers(userIds, eventType, data)`, `broadcastToList(pool, listId, eventType, data)`

5. `npm run lint` grün bestätigen.

**Files to change:**
- `backend/src/routes/auth.js`
- `backend/src/routes/entries.js`
- `backend/src/routes/lists.js`
- `backend/src/routes/sharing.js`
- `backend/src/routes/history.js`
- `backend/src/routes/suggestions.js`
- `backend/src/routes/push.js`
- `backend/src/inviteService.js`
- `backend/src/sseManager.js`

---

### T-004 — Frontend Refactoring: `useListDetailData`-Hook

**Ziel:** `ListDetailPage.tsx` (616 Zeilen, 11 useState-Hooks, ≥5 Verantwortlichkeiten) entlasten, indem die Datenabruf-Logik in einen eigenen Hook ausgelagert wird.

**Vorgehen:**
1. Neuen Hook `frontend/src/pages/ListDetailPage/useListDetailData.ts` anlegen.
2. In den Hook verschieben:
   - `useState`-Variablen für `list`, `entries`, `members`, `history` und die zugehörigen Loading-/Error-States.
   - `loadEntries()`-Callback.
   - `loadMembers()`-Callback.
   - Den `useEffect`, der paralleles Laden von Listen, Entries und History steuert.
3. `ListDetailPage.tsx` importiert und nutzt den Hook statt der direkten State-Definitionen.
4. Bestehende Tests müssen weiterhin grün bleiben.
5. `npm run lint && npm run build && npm test` grün bestätigen.

**Files to change:**
- `frontend/src/pages/ListDetailPage/useListDetailData.ts` (neu)
- `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`

---

### T-005 — Sicherheits-Audit & Dependency-Upgrades

**Ziel:** Kritische und hohe CVEs beseitigen; manuelle Sicherheitscheckliste abarbeiten.

**Befunde aus `npm audit`:**
- **critical**: `protobufjs` (transitiv via `@xenova/transformers`) → Erfordert Untersuchung, ob `@xenova/transformers` auf eine nicht-vulnerable Version aktualisiert oder durch `@huggingface/transformers` ersetzt werden kann. Downgrade auf 2.0.1 ist keine valide Option.
- **high**: `bcrypt@5` → Upgrade auf `bcrypt@6.0.0` (breaking: Node.js ≥ 18 erwartet; API-kompatibel).
- **high**: `node-pg-migrate@7` → Upgrade auf `node-pg-migrate@8.0.4` (breaking: Migration-Script-API prüfen).
- **high**: mehrere transitive Deps (`@babel/...`, `rollup/...`, `serialize-javascript`, `workbox-build`) → `npm audit fix` versuchen.

**Vorgehen:**
1. `npm audit fix` ausführen (auto-fixbare transitive Deps).
2. `bcrypt` auf v6 upgraden: `npm install bcrypt@^6 -w backend`. Smoke-Test: Passwort-Hash/-Verify im Test grün.
3. `node-pg-migrate` auf v8 upgraden: `npm install node-pg-migrate@^8 -w backend`. Migration-Script testen.
4. `@xenova/transformers` analysieren: neueste stabile `@huggingface/transformers`-Version prüfen (der offizielle Nachfolger). Falls kompatibel, migrieren; ansonsten Risiko in Sicherheitsdokumentation festhalten.
5. `npm audit` erneut ausführen und Ergebnisse dokumentieren.
6. `npm run lint && npm run build && npm test` grün bestätigen.

**Manuelle Code-Review-Checkliste (gemäß Audit-Ergebnissen bereits geprüft):**

| Punkt | Befund | Status |
|-------|--------|--------|
| Hardcoded Secrets | Keine gefunden | ✅ |
| SQL-Injection | Parametrisierte Queries, keine Risiken | ✅ |
| XSS (dangerouslySetInnerHTML) | Nicht verwendet | ✅ |
| Error Handling (Stack Trace in Response) | Generische 500-Meldung, sicher | ✅ |
| JWT-Konfiguration | HS256, Expiry konfiguriert, Secret aus env | ✅ |
| Auth-Middleware-Konsistenz | Alle geschützten Routen abgesichert | ✅ |
| Token-Storage (localStorage) | Akzeptabel für PWA; Risiko dokumentiert | ⚠️ |

**Files to change:**
- `backend/package.json` (bcrypt, node-pg-migrate Version)
- `frontend/package.json` (@xenova/transformers oder @huggingface/transformers)
- `package-lock.json`
- Ggf. `backend/src/` wenn Breaking Changes bei Upgrades Anpassungen erfordern.

---

## Acceptance Criteria

| Task | Kriterium |
|------|-----------|
| T-001 | Keine ungenutzten Importe/Variablen (bestätigt durch ts-unused-exports); Build grün |
| T-002 | `ensureListAccess` nur noch in `middleware/listAccess.js`; alle Backend-Tests grün |
| T-003 | Alle exportierten Backend-Funktionen haben JSDoc mit `@param` und `@returns`; Lint grün |
| T-004 | `ListDetailPage.tsx` unter 400 Zeilen; `useListDetailData`-Hook exportiert; Tests grün |
| T-005 | `npm audit`: keine critical, keine high Findings in Prod-Deps; oder dokumentierte Ausnahmen |
| Alle | `npm run lint && npm run build && npm test` grün |

## Validation

```
npm run lint
npm run build
npm test
npm audit
```
