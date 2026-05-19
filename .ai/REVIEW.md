# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Automatic session-timeout redirect to login page

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-19

#### Findings

- **nit** — `frontend/src/context/AuthContext.tsx` (useEffect handler)  
  `navigate()` is called before `logout()` in `handleAuthExpired`, which is the reverse of the order stated in the plan ("calls `logout()` and then `navigate(...)`"). In React 18, both state updates are batched so there is no visible flash or incorrect re-render. Functionally correct; the ordering is safe. No fix required.

- **nit** — `frontend/src/components/ProtectedRoute/ProtectedRoute.tsx`  
  Added `readSessionExpiredRedirect()` helper + sessionStorage read. This file was not listed in the plan's "Files to Change" table. The addition is a valid resilience enhancement that handles the browser-back-button edge case (user navigates back to a protected route after the AuthContext redirect has already cleared the token). It does not contradict any acceptance criterion and tests pass. No fix required.

- **nit** — `frontend/src/context/AuthContext.tsx` line 158 — pre-existing lint warning  
  `react-refresh/only-export-components` warning for `useAuth`. Confirmed pre-existing (present at line 132 on the baseline commit); this task did not introduce it. No fix required.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` — verified scope, architecture, and acceptance criteria.
2. `git diff HEAD` — reviewed all changed files against the plan.
3. `npm run lint` (in `frontend/`) — confirmed 0 errors, 1 pre-existing warning.
4. `npm run build` (in `frontend/`) — clean build with no new errors.
5. `npm test` — all 416 tests pass, including:
   - `src/api/client.test.ts` — 3 new unit tests covering 401+token, 401 no-token, 403+token paths.
   - `src/context/AuthContext.test.tsx` — new test: `auth:expired` event → logout + navigate with correct state.
   - `src/app.test.tsx` — new E2E tests: session-expired redirect + re-login return; wrong credentials stay on login; 403 keeps error UI.

##### Findings
- All 7 plan-required files modified correctly.
- `authStorage.ts` (new, unplanned) — tiny constant-only module; reduces magic-string duplication across three files. Sound addition.
- `ProtectedRoute.tsx` (unplanned) — additive only; passes sessionExpired state through on browser-back navigations. Does not affect primary happy path.
- Acceptance criteria met:
  - ✅ 401 with token → redirect to `/login`, no generic error screen.
  - ✅ Session-expired banner rendered in both DE and EN.
  - ✅ Successful re-login returns user to original page.
  - ✅ Wrong credentials do NOT trigger session-expired redirect or banner.
  - ✅ 403 errors show existing error UI unchanged.
  - ✅ `npm run lint` passes (0 errors).
  - ✅ `npm run build` completes cleanly.
  - ✅ `npm test` — 416/416 pass.

##### Risks
- The `sessionStorage` fallback in `ProtectedRoute` and `LoginPage` relies on both reading the same key before LoginPage's cleanup `useEffect` fires. In the browser-back scenario this works correctly; in the direct navigate scenario both location.state and sessionStorage carry the flag and the cleanup runs on mount. No risk identified.
- Dependency array `[location.pathname, logout, navigate]` in AuthContext is correct; `logout` is `useCallback`-wrapped, `navigate` is stable from React Router. No stale-closure risk.
