# Plan

Status: **ready_for_implement**

Goal: Fix the backend dev server so `DATABASE_URL` is loaded from the root `.env` file automatically, regardless of working directory.

## Root Cause

`dotenv.config()` in `backend/src/env.js` uses the default path resolution: it looks for `.env` in `process.cwd()`. When the backend is launched via `npm run dev --workspace backend` (or `concurrently`), the CWD is `backend/`, but the `.env` file lives in the project root. As a result `DATABASE_URL` is `undefined`, `createPool()` returns `null`, and every auth route fails with "Database connection is not configured."

The same CWD mismatch affects `db:seed` (which also imports `env.js`), though it was not reported separately.

## Scope

- Update `dotenv.config()` in `backend/src/env.js` to resolve `.env` relative to the module file (`import.meta.url`), not `process.cwd()`. This makes the load path CWD-independent.
- No changes to `backend/package.json` scripts are required.
- No new dependencies are required.

## Acceptance Criteria

1. Starting the dev server (`npm run dev`) and sending `POST /api/auth/register` with valid body returns `201` (no "Database connection is not configured" error in the logs).
2. `npm run lint` passes.
3. `npm run build` passes.
4. `npm test` passes.

## Implementation Phases

### Phase 1 — Fix dotenv path resolution in `env.js`

**File**: `backend/src/env.js`

Replace the bare `dotenv.config()` call with one that resolves `.env` relative to the module file:

```js
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export function getConfig() {
  return {
    databaseUrl: process.env.DATABASE_URL ?? "",
    jwtSecret: process.env.JWT_SECRET ?? "",
    port: Number(process.env.PORT ?? 4000),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d"
  };
}
```

`backend/src/env.js` is located at `backend/src/env.js`. Two levels up (`../../`) resolves to the project root where `.env` lives.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
