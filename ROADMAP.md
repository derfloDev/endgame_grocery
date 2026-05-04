# ROADMAP

Goal: Harden the Docker deployment with configurable registration, version logging, and a visible logged-in user in the Info sheet.

## Priority 1 — Disable Registration via Runtime Configuration

Objective: Allow administrators to disable self-registration entirely via a Docker environment variable, without a rebuild.

- New env var `REGISTRATION_ENABLED` (default: `true`); when `false`, the backend `/api/auth/register` endpoint returns `404`.
- New public backend endpoint `GET /api/config` returns `{ registrationEnabled: boolean }` — no authentication required.
- Frontend fetches `/api/config` on app startup and stores the flag in a React context or top-level state.
- When `registrationEnabled` is `false`:
  - The `/register` route redirects to `/login`.
  - The "Create an account" link on `LoginPage` is hidden.
- Dockerfile documents the `REGISTRATION_ENABLED` env var in a comment.
- `env.js` and `README.md` (or equivalent docs) updated with the new variable.

Acceptance criteria:
- Container started with `REGISTRATION_ENABLED=false`: POST to `/api/auth/register` returns `404`; the frontend shows no registration link or route.
- Container started without the variable (or `REGISTRATION_ENABLED=true`): registration works as before.

## Priority 2 — Log Software Version at Container Start

Objective: Make the running software version immediately visible in Docker logs.

- Backend `index.js` reads the version from the root `package.json` (already read by `vite.config.js`) and includes it in the existing `"Backend started"` log entry.
- `docker/entrypoint.sh` prints the version via `node -p "require('/app/package.json').version"` before starting supervisord.

Acceptance criteria:
- `docker logs <container>` shows the version string (e.g. `0.8.0`) both in the entrypoint output and in the backend startup JSON log.

## Priority 3 — Show Logged-in User in Info & Settings

Objective: The currently logged-in user's display name is always visible in the Info & Settings sheet, above the logout button.

- `display_name` is required at registration (already enforced); `email` is also always stored.
- Fix the root cause why `display_name` / `email` are currently not rendered in `InfoSheet` (likely a storage or context hydration issue on page load).
- Move the user block (display name + email) to the **top** of the `InfoSheet`, above the logout button.
- `display_name` is the primary label; `email` shown below it as secondary text.
- If for any reason `display_name` is missing, fall back to showing `email`; if both are missing, show nothing (defensive, should not occur in normal flow).

Acceptance criteria:
- After login, the Info & Settings sheet shows the user's display name at the top, above the logout button, without requiring a page reload.
- After a full page reload the user info is still visible (persisted in localStorage).
