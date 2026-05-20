# ROADMAP

Goal: Code Cleanup, Security Audit und Release 1.0.0

## Priority 1 — Code Cleanup & Dead Code

Objective: Das Repository von ungenutztem Code, auskommentierten Blöcken und redundanter Logik befreien.

- Ungenutzte Variablen, Funktionen, Klassen und Imports entfernen (Frontend TS + Backend JS).
- Auskommentierte Code-Blöcke löschen.
- Doppelte Logik konsolidieren (DRY).
- Namenskonventionen prüfen: camelCase für JS/TS, PascalCase für React-Komponenten.

## Priority 2 — Moderates Refactoring & Struktur

Objective: Lesbarkeit und Wartbarkeit verbessern, ohne weitreichende Umbauten vorzunehmen.

- Funktionen/Komponenten mit klar mehrfacher Verantwortung aufteilen.
- Komplexe Algorithmen kurz und präzise kommentieren.
- Backend-Funktionen mit JSDoc-Annotationen (@param, @returns) versehen, wo sie fehlen.
- Frontend: fehlende TypeScript-Typen ergänzen (keine `any` ohne Begründung).

## Priority 3 — Sicherheits-Audit

Objective: Bekannte Schwachstellen identifizieren und beheben.

- `npm audit` ausführen; kritische und hohe CVEs auflisten und Upgrade-Plan erstellen.
- Manueller Code-Review auf:
  - Hardcoded Secrets (API-Keys, Passwörter, Tokens).
  - Unsichere Fehlerbehandlung (Stack Traces / System-Infos in HTTP-Responses).
  - SQL-Injection-Risiken in DB-Queries.
  - XSS-Risiken im Frontend (dangerouslySetInnerHTML, unsanitized user input).
  - Unsichere JWT-Konfiguration oder Auth-Endpunkte.

## Priority 4 — Release 1.0.0

Objective: Stabilitätssignal setzen – keine Breaking Changes, Production-Reife nach dem Cleanup.

- Cycle mit `aide cycle end 1.0.0` schließen.
- CHANGELOG und PR aktualisieren.

## Constraints

- Backend bleibt JavaScript (kein TS-Umbau); JSDoc reicht.
- Refactoring-Tiefe: moderat – kein Datei-/Ordner-Umbau, kein weitreichender Umbau.
- Keine Breaking Changes in API oder DB-Schema.
- Alle Änderungen müssen `npm run lint`, `npm run build` und `npm test` grün lassen.
