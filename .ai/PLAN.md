# Plan

Status: **ready_for_implement**

Goal: Fix `npm run migrate` so it loads `.env` automatically without requiring the developer to set `DATABASE_URL` manually in the shell.

## Root Cause

`node-pg-migrate` is a CLI tool that does not load `.env` files. The app's `dotenv.config()` call in `backend/src/env.js` only runs when the Express app starts — not during `npm run migrate`. `DATABASE_URL` is therefore `undefined` at migration time, causing the SASL authentication error ("client password must be a string").

`db:seed` is **not** affected: `seed.js` imports `client.js` → `env.js` → `dotenv.config()`, so dotenv loads automatically for that script.

## Scope

- Update the `migrate` script in `backend/package.json` to pre-load `.env` using Node's native `--env-file` flag (available since Node 20.6.0; project runs on 20.11.0).
- Point directly at the ESM binary `node_modules/node-pg-migrate/bin/node-pg-migrate.mjs` to bypass the platform CMD wrapper.
- Update `README.md` to remove any note suggesting manual env-var export before `npm run migrate` (if present), since the script now handles it automatically.

No new dependencies are required.

## Acceptance Criteria

1. `npm run migrate` completes successfully with only a `.env` file present (no manual shell export needed).
2. `npm run lint` passes.
3. `npm run build` passes.

## Implementation Phases

### Phase 1 — Fix the migrate script

**File**: `backend/package.json`

Change:
```json
"migrate": "node-pg-migrate up --migrations-dir src/db/migrations"
```
To:
```json
"migrate": "node --env-file=../.env node_modules/node-pg-migrate/bin/node-pg-migrate.mjs up --migrations-dir src/db/migrations"
```

### Phase 2 — Update README if needed

**File**: `README.md`

If the README contains any instruction to manually export `DATABASE_URL` before running `npm run migrate`, remove or replace that note to reflect that the script now loads `.env` automatically.

## Validation

- `npm run lint`
- `npm run build`
