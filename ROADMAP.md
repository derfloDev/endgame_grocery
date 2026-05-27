# ROADMAP

Goal: Fix two PWA sync bugs that cause permanently stuck pending-change indicators.

## Priority 1 — Bug: Queue steckt nach PWA-Idle (Bug 1)

Objective: Queue wird nach Neuöffnung der PWA automatisch geleert, nicht erst nach manuellem Reload.

### Symptom
Wenn die PWA längere Zeit nicht geöffnet war und der Nutzer nach dem Wiederöffnen eine Änderung macht, erscheint dauerhaft „1 ausstehende Änderung wartet weiter auf Synchronisierung" – obwohl Internetzugang besteht. Erst ein manueller Reload hilft.

### Root Cause
In `OfflineQueueContext.tsx`:
- `handleQueueChanged` ruft nur `refreshQueuedCount()` auf, nicht `drainQueue()`.
- Beim ersten Request nach längerer Idle-Phase schlägt der Netzwerkaufruf mit einem TypeError fehl (Service Worker noch nicht vollständig bereit oder kurze Konnektivitätslücke) → Mutation wird in IndexedDB-Queue eingereiht.
- Da das `online`-Event nicht erneut feuert (Gerät ist bereits als „online" markiert), wird `drainQueue()` nie ausgelöst.
- Es gibt keinen `visibilitychange`-Listener, der bei Rückkehr zur Seite einen Drain-Versuch startet.

### Acceptance Criteria
- Nach einer längeren Pause (PWA im Hintergrund) und Wiederöffnen wird `drainQueue()` automatisch ausgelöst, sobald die Seite wieder sichtbar ist und `navigator.onLine === true`.
- Wenn eine neue Mutation zur Queue hinzugefügt wird während `navigator.onLine === true`, wird sofort `drainQueue()` ausgelöst (kein Warten auf das nächste `online`-Event).
- Kein doppelter gleichzeitiger Drain-Lauf: Wenn `isSyncing === true`, wird ein neuer Drain-Aufruf übersprungen.
- Bestehende `online`/`offline`/`OFFLINE_QUEUE_CHANGED_EVENT`-Logik bleibt unverändert erhalten.

### Files to change
- `frontend/src/context/OfflineQueueContext.tsx` — `visibilitychange`-Listener hinzufügen; in `handleQueueChanged` bei `navigator.onLine` auch `drainQueue()` aufrufen; `isSyncing`-Guard für doppelten Drain-Schutz
- `frontend/src/context/OfflineQueueContext.test.tsx` (neu erstellen) — Tests für visibilitychange-Trigger und Queue-Changed-Drain

---

## Priority 2 — Bug: Nicht-wiederherstellbarer Sync-Fehler blockiert Queue dauerhaft (Bug 2)

Objective: 4xx-Fehler beim Sync werden dem Nutzer angezeigt; er kann die blockierende Mutation manuell verwerfen. Die Queue läuft danach weiter.

### Symptom
Nach dem Verschieben eines Listeneintrags zu „zuletzt verwendet" (Status → done) erscheint dauerhaft „1 ausstehende Änderung wartet weiter auf Synchronisierung. Entry not found." Selbst nach manuellem Reload geht die Meldung nicht weg.

### Root Cause
In `OfflineQueueContext.tsx` → `drainQueue()`:
- HTTP 4xx-Fehler (z. B. `404 Entry not found`) lösen denselben `throw` aus wie transiente Netzwerkfehler.
- Die Mutation wird NICHT aus der Queue entfernt (nur bei Erfolg wird `removeOfflineMutation` aufgerufen).
- Beim nächsten Drain-Versuch wiederholt sich dasselbe → dauerhafte Blockade.

### Acceptance Criteria
- Bei einem 4xx-Fehler für eine Mutation während des Drains:
  - Mutation verbleibt vorerst in der Queue und ihre ID wird in einem neuen `failedMutationId`-State gespeichert.
  - `syncError` enthält die Fehlermeldung aus der API-Antwort.
  - Das OfflineBanner zeigt zusätzlich einen „Ausstehende Änderung verwerfen"-Button.
  - Klick auf den Button: ruft einen neuen `discardFailedMutation`-Callback auf → entfernt die Mutation aus der Queue, setzt `syncError` und `failedMutationId` zurück, triggert anschließend `drainQueue()` für verbleibende Mutations.
- Bei einem 5xx- oder Netzwerkfehler: Verhalten unverändert (Queue bleibt, kein `failedMutationId`).
- `OfflineQueueContextValue` wird um `failedMutationId: string` und `discardFailedMutation: () => Promise<void>` erweitert.

### Files to change
- `frontend/src/context/OfflineQueueContext.tsx` — 4xx-Fehler-Erkennung (`response.status >= 400 && response.status < 500`), `failedMutationId`-State, `discardFailedMutation`-Callback
- `frontend/src/types.ts` — `OfflineQueueContextValue` um `failedMutationId: string` und `discardFailedMutation: () => Promise<void>` erweitern
- `frontend/src/context/offlineQueueContextValue.ts` — keine Änderung (nur Context-Objekt)
- `frontend/src/components/OfflineBanner/OfflineBanner.tsx` — `discardFailedMutation`-Callback und `failedMutationId` aus Context lesen; Button „Ausstehende Änderung verwerfen" rendern, wenn `failedMutationId` gesetzt
- `frontend/src/locales/de/translation.json` — neuer Key `"offline.discard"` mit Text „Ausstehende Änderung verwerfen"
- `frontend/src/locales/en/translation.json` — neuer Key `"offline.discard"` mit Text „Discard queued change"
- `frontend/src/context/OfflineQueueContext.test.tsx` — Tests für 4xx-Fehlerfall und discardFailedMutation
- `frontend/src/components/OfflineBanner/OfflineBanner.test.tsx` (neu erstellen) — Tests für Discard-Button-Rendering und Klick-Verhalten
