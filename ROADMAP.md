# ROADMAP

Goal: Einkaufslisten und deren Einträge aktualisieren sich automatisch auf allen verbundenen Geräten in Echtzeit, ohne manuelle Seitenaktualisierung.

## Priority 1 — Instant Updates via Server-Sent Events

Objective: Alle Geräte, auf denen ein Nutzer eingeloggt ist, erhalten sofortige Updates wenn sich eine geteilte oder eigene Liste ändert.

### Technologie-Entscheidung
- **Server-Sent Events (SSE)** über einen neuen Endpunkt `GET /api/events`
- Mutations laufen weiterhin über REST; SSE ist nur der Benachrichtigungskanal
- Kein WebSocket-Umbau nötig

### Scope der Echtzeit-Updates
- **Eintrags-Events**: Eintrag hinzugefügt / geändert / gelöscht → alle Geräte, die die betroffene Liste geöffnet haben, refetchen die Einträge sofort
- **Listen-Events**: Liste umbenannt / gelöscht / archiviert → Übersichtsseite auf allen Geräten aktualisiert sich sofort
- **Mitglieder-Events**: Mitglied hinzugefügt / entfernt → Listendetailseite (Members-Bereich) aktualisiert sich sofort

### Architektur
**Backend:**
- Neuer SSE-Endpunkt `GET /api/events` (authentifiziert via Bearer-Token)
- `SseManager`-Singleton: verwaltet offene Verbindungen pro User
- Nach jeder Mutation in Entry-, List- und Sharing-Routes: `sseManager.broadcast(listId, event)`
- Server filtert Events pro User: nur Verbindungen die Zugriff auf die betroffene Liste haben erhalten das Event

**Frontend:**
- `useEventSource`-Hook: baut SSE-Verbindung auf, handled Auto-Reconnect, parst Events
- Verbindung wird beim Login geöffnet und beim Logout geschlossen (globaler Context)
- `OverviewPage`: lauscht auf `list:*`-Events → `loadLists()` neu aufrufen
- `ListDetailPage`: lauscht auf `entry:*`- und `member:*`-Events für die aktuelle Liste → zugehörige Daten refetchen

### Acceptance Criteria
- AC1: Fügt Gerät A einen Eintrag zu einer geteilten Liste hinzu, sieht Gerät B (gleiche Liste geöffnet) ihn innerhalb von 2 Sekunden ohne manuelle Aktualisierung
- AC2: Benennt Gerät A eine Liste um, zeigt die Übersichtsseite auf Gerät B den neuen Namen innerhalb von 2 Sekunden
- AC3: Schließt ein Nutzer den Browser oder verliert die Verbindung, verbindet sich der Client automatisch wieder (Exponential Backoff, max. 30 s)
- AC4: Offline-Geräte (kein SSE) erhalten beim nächsten Seitenaufruf wie bisher die aktuellen Daten (kein Rückschritt)
- AC5: Der SSE-Endpunkt erfordert Authentifizierung; unauthentifizierte Anfragen erhalten HTTP 401
- AC6: Bestehende Push-Notifications (verzögert, für nicht aktive Geräte) bleiben unberührt

### Out of Scope
- Optimistisches Merge von SSE-Events in den lokalen State (stattdessen: Refetch)
- Offline-Queue über SSE statt REST
- Presence-Anzeige ("User X bearbeitet gerade")
- Rate-Limiting für SSE-Verbindungen (kann später ergänzt werden)
