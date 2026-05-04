# Plan

Status: **rework — T-001 doc gap + T-003 me-endpoint**

Goal: Harden the Docker deployment with configurable registration, version logging, and a visible logged-in user in the Info sheet.

## Scope

- **T-001** Disable registration via runtime environment variable (`REGISTRATION_ENABLED`)
- **T-002** Log the software version at Docker container start
- **T-003** Show logged-in user's display name at the top of the Info & Settings sheet

## Acceptance Criteria

- `REGISTRATION_ENABLED=false` → `POST /api/auth/register` returns `404`; frontend hides the route and login-page link.
- `docker logs <container>` shows the version string in both the entrypoint output and the backend JSON startup log.
- Info & Settings sheet always shows `display_name` (and `email` below it) at the very top, above the logout button, immediately after login and after a full page reload.

---

## T-001 — Disable Registration via Runtime Configuration

### Overview

A new `REGISTRATION_ENABLED` runtime env var (default `true`) gates the register endpoint and surfaces a public `/api/config` endpoint so the frontend can adjust its UI without a rebuild.

### Backend changes

#### 1. `backend/src/env.js`
Add `registrationEnabled` to `getConfig()`:
```js
registrationEnabled: process.env.REGISTRATION_ENABLED !== 'false'
```
Default is `true`; only the exact string `'false'` disables it.

#### 2. `backend/src/env.test.js`
- Add a test case: `REGISTRATION_ENABLED=false` → `getConfig().registrationEnabled === false`.
- Add a test case: env var absent → `getConfig().registrationEnabled === true`.

#### 3. `backend/src/routes/auth.js`
In `createAuthRouter`, guard the `POST /register` handler:
```js
router.post("/register", async (req, res, next) => {
  if (!config.registrationEnabled) {
    res.status(404).end();
    return;
  }
  // existing logic …
});
```
The `config` object is already injected via the factory parameter.

#### 4. `backend/src/auth.test.js`
Add a test: when `config.registrationEnabled` is `false`, `POST /register` returns `404` with no body.

#### 5. `backend/src/app.js`
Add a public config route **before** authenticated routes:
```js
app.get("/api/config", (_req, res) => {
  const cfg = options.config ?? getConfig();
  res.json({ registrationEnabled: cfg.registrationEnabled });
});
```

#### 6. `backend/src/app.test.js`
Add tests:
- `GET /api/config` with default config → `{ registrationEnabled: true }`.
- `GET /api/config` with `registrationEnabled: false` → `{ registrationEnabled: false }`.

### Frontend changes

#### 7. `frontend/src/api/config.js` *(new file)*
```js
import { sendJsonRequest } from "./client";

export function fetchAppConfig() {
  return sendJsonRequest("/api/config");
}
```

#### 8. `frontend/src/context/AppConfigContext.jsx` *(new file)*
- Creates `AppConfigContext` with default `{ registrationEnabled: true }`.
- `AppConfigProvider` fetches `/api/config` on mount via `useEffect`; updates state on success; silently keeps default on error (fail-open = registration stays visible if config endpoint unreachable).
- Exports `useAppConfig()` hook.

#### 9. `frontend/src/main.jsx`
Wrap the provider tree with `<AppConfigProvider>` (outside `<AuthProvider>`, no auth needed):
```jsx
<AppConfigProvider>
  <AuthProvider>
    …
  </AuthProvider>
</AppConfigProvider>
```

#### 10. `frontend/src/App.jsx`
Import `useAppConfig`. In the route for `/register`:
```jsx
<Route
  path="/register"
  element={
    registrationEnabled ? <RegisterPage /> : <Navigate to="/login" replace />
  }
/>
```

#### 11. `frontend/src/pages/LoginPage.jsx`
Import `useAppConfig`. Conditionally render the "Create an account" link:
```jsx
{registrationEnabled ? (
  <Link className="eg-link" to="/register">Create an account</Link>
) : null}
```

### Documentation changes

#### 12. `Dockerfile`
Add a comment block in the `runtime` stage documenting `REGISTRATION_ENABLED`:
```dockerfile
# REGISTRATION_ENABLED — set to "false" to disable self-registration (default: "true")
```

#### 13. `README.md`
Add `REGISTRATION_ENABLED` to the environment variable reference table/section.

---

## T-002 — Log Software Version at Container Start

### Overview

Read the version from `/app/package.json` (root workspace manifest) and emit it in two places: the shell entrypoint and the backend startup log.

### Changes

#### 1. `docker/entrypoint.sh`
Add a version echo before the database migration step:
```sh
APP_VERSION=$(node -p "JSON.parse(require('fs').readFileSync('/app/package.json','utf8')).version")
echo "Version: ${APP_VERSION}"
```

#### 2. `backend/src/index.js`
Read the version from `package.json` using `fs.readFileSync` (already available in the Node runtime; avoids static import assertions which need `--experimental-json-modules` in some Node versions):
```js
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const _dir = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(resolve(_dir, "../../package.json"), "utf8"));
```
Include `version` in the startup log object:
```js
logger.info({ port, version, dbConfigured: …, … }, "Backend started");
```

#### 3. `backend/src/index.test.js`
Update the existing `"logs backend startup details"` test to assert `version` is present in the logged fields. Pass version via the existing config mock or as a separate option.

---

## T-003 — Show Logged-in User in Info & Settings

### Overview

The user block (`display_name` + `email`) is already rendered in `InfoSheet` but placed **below** the logout button, making it easy to miss or cut off if the sheet has no scroll. The fix is:
1. Move the user block to the **top** of the sheet content.
2. Verify that `display_name` and `email` arrive in the `user` object from `AuthContext` after login and after page reload; fix any hydration gap if found.

### Changes

#### 1. `frontend/src/components/InfoSheet.jsx`
Reorder the sections so the user block comes first:
```jsx
return (
  <BottomSheet open={open} onClose={onClose} title="Info & Settings">
    {/* 1. User identity — always at top */}
    {user?.display_name || user?.email ? (
      <div className="info-sheet-section">
        {user.display_name ? <div className="info-sheet-user-name">{user.display_name}</div> : null}
        {user.email ? <div className="info-sheet-user-email">{user.email}</div> : null}
      </div>
    ) : null}

    {/* 2. Logout */}
    <div className="info-sheet-section">
      <button …>Log out</button>
    </div>

    {/* 3. Version / License meta */}
    …
  </BottomSheet>
);
```

#### 2. `frontend/src/context/AuthContext.jsx` *(if investigation reveals a hydration gap)*
During implementation, verify the following invariant in the browser after login:
- `localStorage["endgame_grocery.auth_user"]` contains `display_name` and `email`.
- On a fresh page load, `getStoredUser` re-hydrates both fields into the `user` state.

If a bug is found (e.g., `normalizeAuthUser` discards `display_name`/`email` due to a type mismatch, or the stored key is missing), fix it here. Document the fix in the HANDOFF entry.

#### 3. `frontend/src/components/InfoSheet.test.jsx`
- Add/update a test that asserts the user name block appears **before** the logout button in DOM order.
- Existing coverage for rendering `display_name` and `email` is already present; extend rather than replace.

---

---

## Rework: T-001 — docker-compose.example.yml gap

### Problem

`docker-compose.example.yml` was not updated with `REGISTRATION_ENABLED`. Administrators deploying from the example file have no hint that the option exists.

### Fix

#### `docker-compose.example.yml`
Add a commented-out entry in the `environment` block, grouped with the other app-behaviour vars (near `LOG_LEVEL`):
```yaml
# Self-registration: set to "false" to disable the /register route (default: "true")
# REGISTRATION_ENABLED: "true"
```

---

## Rework: T-003 — User profile not hydrated for existing sessions

### Problem

`AuthContext` initialises `user` from `localStorage` on every page load. For users with a valid JWT but no `USER_STORAGE_KEY` entry (sessions created before user-data persistence was added, or after a browser storage clear), `getStoredUser` returns only `{ id: sub }` — no `display_name`, no `email`. Because `InfoSheet` only renders the identity block when at least one of those fields is truthy, the block is invisible.

A fresh login resolves it for that session, but the app must not rely on the user logging out and back in.

### Fix

#### 1. Backend — `backend/src/routes/auth.js`

Add a new authenticated route **at the end of `createAuthRouter`**, using the `requireAuth` middleware (already injected in `app.js` as `requireAuthFn` but the auth router has its own `config`/`pool` scope):

```js
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, email, display_name FROM users WHERE id = $1 LIMIT 1",
      [req.user.sub]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json(serializeAuthUser(user));
  } catch (error) {
    next(error);
  }
});
```

`requireAuth` from `../middleware/auth.js` is already available; import it in the router file.

#### 2. Backend tests — `backend/src/auth.test.js`

Add tests for `GET /api/auth/me`:
- Returns `{ id, email, display_name }` for a valid token whose user exists.
- Returns `401` when no token is provided.
- Returns `404` when the user row is missing (edge case).

#### 3. Frontend — `frontend/src/api/auth.js`

Add:
```js
export function fetchCurrentUser(token) {
  return sendJsonRequest("/api/auth/me", { token });
}
```

#### 4. Frontend — `frontend/src/context/AuthContext.jsx`

Add a `useEffect` that fires whenever `token` is set but `user?.display_name` is missing:

```js
useEffect(() => {
  if (!token || user?.display_name) {
    return;
  }

  let cancelled = false;

  fetchCurrentUser(token)
    .then((profile) => {
      if (!cancelled) {
        setAuthToken(token, profile);
      }
    })
    .catch(() => {
      // fail silently — user stays logged in, identity block stays hidden
    });

  return () => {
    cancelled = true;
  };
}, [token, user?.display_name, setAuthToken]);
```

Import `fetchCurrentUser` from `../api/auth`.

#### 5. Frontend tests — `frontend/src/context/AuthContext` (or existing auth test file)

Add tests:
- When `token` is present but `user` has only `id`, `fetchCurrentUser` is called and the returned profile is merged into state.
- When `user.display_name` is already set, `fetchCurrentUser` is **not** called (no redundant fetch).
- When `fetchCurrentUser` rejects, the user remains logged in (state unchanged beyond what was already there).

---

## Validation

Run after each task before marking `ready_for_review`:
```
npm run lint
npm run build
npm test
```
