# ROADMAP

Goal: Add a free-text details field to grocery entries so users can note quantities, units, brands, or any other context without a rigid format.

## Priority 1

Objective: Persist and display a `details` field on every entry.

- DB migration adds a nullable `details` column to the `entries` table.
- Backend `POST /entries` and `PATCH /entries/:entryId` accept and return `details`.
- `autocomplete_history` is unchanged — `details` is intentionally excluded (details are per-occasion context, not reusable history).
- `AddItemSheet` (add & edit mode) exposes a second optional text input labelled **"Details (optional)"** with placeholder `Beschreibung, Menge...`.
- `EntryRow` renders details as a second, visually subordinate line below the entry name (smaller / dimmed text), shown only when details are non-empty.
