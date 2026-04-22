# Plan

Status: **ready_for_implement**

Goal: Fix the 404 error on registration by adding the missing Vite dev-server proxy for `/api` requests.

## Root Cause

`frontend/vite.config.js` has no `server.proxy` entry. During development the frontend Vite dev server (default port 5173) receives `POST /api/auth/register` but has no route for it → 404. The backend (port 4000) never receives the request.

## Scope

- Add a `server.proxy` block to `frontend/vite.config.js` that forwards every `/api` request to `http://localhost:4000`.

## Acceptance Criteria

1. `POST /api/auth/register` from the frontend dev server reaches the backend and returns 201.
2. `npm run lint` passes.
3. `npm run build` passes.

## Implementation Phases

### Phase 1 — Fix Vite proxy config

**File**: `frontend/vite.config.js`

Add `server.proxy` inside `defineConfig`:

```js
server: {
  proxy: {
    "/api": "http://localhost:4000"
  }
}
```

No other files need to change; the backend routes are already correct.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
