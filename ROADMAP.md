# ROADMAP

Goal: When the user's session token expires, they are automatically redirected to the login page instead of seeing a generic error message.

## Priority 1

Objective: Automatic session-timeout redirect to login page.

### Acceptance Criteria
- When any API request returns HTTP 401 (expired/invalid token), the app clears the local session and navigates the user to `/login` immediately.
- The login page shows a short hint: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an." when redirected due to a session timeout.
- The `from` location is preserved in `location.state` so the user lands back on the page they were on after a successful re-login.
- The generic "Etwas ist schiefgelaufen"-error is **not** shown for session-timeout 401s.
- Non-session 403 errors (e.g. "no access to this list") remain unchanged.
- 401 errors during the login request itself (wrong credentials) are **not** treated as session expiry.

### Technical Decisions
- **Mechanism:** `client.ts` dispatches a global `auth:expired` DOM event on 401. `AuthContext` listens for this event, calls `logout()`, and navigates to `/login` with `{ state: { from: currentLocation, sessionExpired: true } }`.
- 401 from `/api/auth/login` must **not** trigger the event (it's a credential error, not a session expiry).
- The login-page info banner reads `sessionExpired` from `location.state` to decide whether to show the hint.
- i18n keys are added to `de/translation.json` and `en/translation.json`.
