# ROADMAP

Goal: deliver the "Recently Used" feature — a per-list, one-tap quick-add panel on the List Detail Page that replaces the Done-items section.

## Priority 1

Objective: Let users instantly re-add items they have bought before without typing.

### Scope decisions (agreed 2026-04-27)

| Question | Decision |
|---|---|
| History scope | Per (user, list) — existing `autocomplete_history` design |
| History trigger | Written on **Done** or **Delete** only; removed from POST /entries |
| UI placement | Separate section on ListDetailPage **below Open Items**; Done section removed |
| One-tap behaviour | Immediately adds item as `open`; no extra form or pre-fill sheet |
| Deduplicate | Items already `open` on the list are excluded from the panel |

### Acceptance Criteria

- When a user marks an entry **done**, the entry is written (upsert) into `autocomplete_history` for that list.
- When a user **deletes** an entry, the entry is written (upsert) into `autocomplete_history` before the row is removed.
- Adding a new entry via POST `/entries` does **not** write to `autocomplete_history`.
- `GET /lists/:id/history` returns up to 20 items, sorted by `use_count DESC, last_used_at DESC`, excluding any item whose `text` matches a currently `open` entry on the list.
- `DELETE /lists/:id/history` with `{ text }` body permanently removes the item from history for that user+list combination.
- The ListDetailPage shows a **"Recently Used"** section below Open Items with up to 20 chips/rows.
- Tapping a Recently Used item calls the existing `addEntryByText` path and the item disappears from the panel immediately (it is now open).
- Each Recently Used item has a dismiss/delete button that permanently removes it from history.
- The **Done** section is removed from ListDetailPage.
- Items with status `open` on the current list never appear in the Recently Used panel.

### Out of scope

- Cross-list history view.
- Any additional "note" or quantity field on one-tap add.
- Migration or purge of existing `autocomplete_history` rows (written on add); they evolve naturally.
