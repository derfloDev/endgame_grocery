# PLAN — Session-Timeout Redirect to Login

Status: **ready_for_implement**

Goal: When a JWT token expires, the user is automatically redirected to `/login` with a session-expired info banner instead of seeing the generic "Etwas ist schiefgelaufen"-error.

## Scope

Single task: **T-001**.

---

## Architecture

### Mechanism: Custom DOM Event

```
client.ts (401 + token present)
  └─ window.dispatchEvent(new Event("auth:expired"))
  └─ throw new AuthExpiredError()

AuthContext.tsx (useEffect, event listener)
  └─ logout()                      // clears token + localStorage
  └─ navigate("/login", { replace: true, state: { from: location.pathname, sessionExpired: true } })

LoginPage.tsx (reads location.state.sessionExpired)
  └─ shows info banner: t("auth.sessionExpired")
```

### Why `AuthExpiredError`?

Throwing a plain `Error` after dispatching the DOM event would still propagate to the calling page component (OverviewPage, ListDetailPage) and trigger the "Etwas ist schiefgelaufen" error state before the React Router navigation completes. By throwing a typed `AuthExpiredError`, the pages can detect it and render `null` instead of the error UI, avoiding any visible flash.

### 401 Exclusion for unauthenticated requests

The `auth:expired` event must only fire when the request was made with a token (i.e., `token !== ""`). This naturally excludes:
- `POST /api/auth/login` — no token passed; 401 = wrong credentials
- `POST /api/auth/register` — no token
- `POST /api/auth/resend-verification` — no token
- `POST /api/auth/reset-password` — no token

`GET /api/auth/me` **does** use a token and **should** trigger the redirect if the token is expired.

---

## Task T-001: Automatic session-timeout redirect to login

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `frontend/src/api/client.ts` | Export `AuthExpiredError` class. Inside `sendJsonRequest`, before the generic `throw new Error(...)`, check: if `response.status === 401` and `token` is non-empty, dispatch `window.dispatchEvent(new Event("auth:expired"))` and throw `new AuthExpiredError("session:expired")` instead. |
| 2 | `frontend/src/context/AuthContext.tsx` | Import `useNavigate`, `useLocation` from react-router-dom. Add a `useEffect` (defined before the existing profile-rehydration `useEffect`) that registers an `auth:expired` event listener on `window`. The handler calls `logout()` and then `navigate("/login", { replace: true, state: { from: location.pathname, sessionExpired: true } })`. The `useEffect` must clean up the listener on unmount. Dependency array: `[logout, navigate, location.pathname]`. |
| 3 | `frontend/src/pages/LoginPage/LoginPage.tsx` | Extend `LoginLocationState` interface to include `sessionExpired?: boolean`. Read `locationState?.sessionExpired` and render the `auth.sessionExpired` translation as an info banner (use `eg-success-banner` class for the info style, matching existing banner usage). Position the banner above the existing `successMessage` banner. The banner only renders when `sessionExpired` is `true`. |
| 4 | `frontend/src/pages/OverviewPage/OverviewPage.tsx` | Import `AuthExpiredError` from `../../api/client`. Where the component renders `<ErrorState />` for a list-load error, add a guard: if the error is `instanceof AuthExpiredError`, render `null` instead. |
| 5 | `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` | Same as #4: import `AuthExpiredError`; render `null` instead of `<ErrorState />` when error is `instanceof AuthExpiredError`. |
| 6 | `frontend/src/locales/de/translation.json` | Add key `"auth.sessionExpired": "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an."` (after the `"auth.signIn"` key). |
| 7 | `frontend/src/locales/en/translation.json` | Add key `"auth.sessionExpired": "Your session has expired. Please sign in again."` (after the `"auth.signIn"` key). |

### Acceptance Criteria

- [ ] Navigating to a protected page with an expired token redirects to `/login` without showing the generic error screen.
- [ ] The login page displays the session-expired info banner (both DE and EN locales).
- [ ] After a successful re-login, the user is returned to the original page (via `from` in `location.state`).
- [ ] Entering wrong credentials on the login page does NOT trigger the session-expired redirect.
- [ ] 403 access errors (e.g. "no access to this list") continue to display their existing error UI unchanged.
- [ ] `npm run lint` passes without new errors.
- [ ] `npm run build` completes without errors.

### Implementation Notes

- `AuthExpiredError` is a plain subclass of `Error`; set `this.name = "AuthExpiredError"` in the constructor for reliable `instanceof` checks across module boundaries.
- The `useEffect` event listener in `AuthContext` depends on `logout`, `navigate`, and `location.pathname`. `logout` is already wrapped via `setAuthToken`'s `useCallback`. `navigate` is stable from React Router.
- Do NOT dispatch the event from the network-error catch block — only from the `if (!response.ok)` HTTP path with status 401.
- The `successMessage` banner and the `sessionExpired` banner are mutually exclusive in practice but can coexist in code without conflict.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
