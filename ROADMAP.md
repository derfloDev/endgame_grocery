# ROADMAP

Goal: Refactor suggestion history so both "Recently Used" and typing autocomplete draw directly from the `entries` table per list. The separate `autocomplete_history` table is removed entirely.

## Priority 1

Objective: Remove `autocomplete_history` and source all suggestions from `entries`.

### Acceptance criteria

- **Recently Used section** reads the last 20 `entries` with `status = 'done'` for the list, sorted by `updated_at DESC`. Items that are also currently present as `status = 'open'` are excluded (e.g. re-added items).
- **Dismiss button** is removed from the Recently Used section (no separate history table to delete from).
- **Typing autocomplete** (the ≥2-char dropdown) queries the `entries` table directly, filtered by `list_id` only. Results are `DISTINCT` on `text`, ordered by frequency/recency, limited to 5. Deleted entries no longer appear in suggestions.
- **`autocomplete_history` table** is dropped via a new migration. No more `upsertAutocompleteHistory` calls anywhere.
- **One-time data migration** drops the `autocomplete_history` table (and its extension is left in place since `pg_trgm` may still be used for the new entries-based similarity search).
- All existing tests pass and new behaviour is covered by updated/new tests.

### Out of scope

- Pagination of recently-used results (hard limit of 20 stays).
- Offline fallback changes for suggestions beyond adjusting the cache key.
- Re-ranking or weighting suggestions by anything other than frequency/recency from entries.
