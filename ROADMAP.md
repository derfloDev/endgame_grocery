# ROADMAP

Goal: Extend the v1 API `Item` response object with an optional `description` field that maps to the existing `details` column in the `entries` table.

## Priority 1

Objective: Expose `description` (read + write) on the v1 API `Item` object.

- `GET /api/v1/lists/:listId/items` — each item includes `description` (null when empty).
- `POST /api/v1/lists/:listId/items` — accepts optional `description` in the request body; response includes `description`.
- `PATCH /api/v1/lists/:listId/items/:itemId` — accepts optional `description` in the request body; response includes `description`.
- `POST /api/v1/lists/:listId/items/:itemId/toggle` — response includes `description`.
- OpenAPI spec (`v1.yaml`) updated to reflect the new field on `Item` and updated request bodies.
- All tests updated/added to cover the new field.

### Constraints

- The `details` column already exists in the DB (migration `1713906000000_add_details_to_entries.cjs`); no new migration needed.
- `description` is always optional (nullable); existing items without details return `description: null`.
- No change to authentication, list access, or status-toggle logic.
