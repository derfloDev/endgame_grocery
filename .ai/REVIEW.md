# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001 — Mail + Package Infrastructure

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `docker-compose.yml` lines 6–13 | SMTP env-var comment block is indented inside the `postgres` service block instead of a top-level or separate comment section. The header line ("Backend mail settings are read from…") makes the intent clear, but the placement is visually confusing — a reader scanning the postgres service may not expect backend-specific documentation there. The dev compose has no backend service to attach them to, so this is the only feasible location; a brief top-level comment or moving the block above `services:` would improve clarity. | No |

No blockers. No major findings.

#### Verification

##### Steps
1. Read all changed files: `mailer.js`, `mailer.test.js`, `base.hbs`, `env.js`, `env.test.js`, `docker-compose.yml`, `docker-compose.example.yml`, `.env.example`, `backend/package.json`.
2. Cross-checked every deliverable against the T-001 plan:
   - `nodemailer` and `handlebars` added to `backend/package.json` ✅
   - `backend/src/mail/mailer.js` created with `createMailer()` factory and `send()` helper ✅
   - `backend/src/mail/templates/base.hbs` created with inline-CSS responsive table layout ✅
   - `backend/src/env.js` extended with all seven fields (`smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `smtpFrom`, `smtpFromName`, `appBaseUrl`) ✅
   - `docker-compose.yml` contains all seven env var names as comments ✅
   - `docker-compose.example.yml` contains all seven env vars as concrete values for the `app` service ✅
   - `.env.example` contains all seven vars with sensible defaults ✅
3. Verified acceptance criteria:
   - `getConfig()` returns all 7 new fields — confirmed in `env.js` and `env.test.js` ✅
   - `mailer.send()` contract verified via unit test with mock transport — `sendMail` called with correct `from`, `to`, `subject`, rendered HTML ✅
   - `docker-compose.yml` contains all seven env var names as comments ✅
4. Ran `npm run lint` — exits clean (one pre-existing warning in `frontend/src/context/AuthContext.jsx`, zero errors introduced by T-001) ✅
5. Ran `npm test` — 51 backend tests pass (including new `getConfig` and `createMailer` suites), 79 frontend tests pass ✅

##### Findings
- All acceptance criteria met.
- `base.hbs` correctly uses triple-brace `{{{content}}}` for the raw HTML slot and double-brace `{{body}}`/`{{intro}}` for text fields — appropriate escaping strategy for a mail template.
- `mailer.js` correctly derives `secure: true` only when port is 465, and omits `auth` entirely when both `smtpUser` and `smtpPass` are empty — suitable for unauthenticated local relays (e.g., MailHog).
- Dependency-injection pattern (`nodemailerLib`, `handlebarsLib`, `templatesDir`) makes the module fully testable without network I/O.

##### Risks
- None for T-001 scope. SMTP credentials are kept out of version control via `.env` (git-ignored); `.env.example` provides safe defaults.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-002 — E-Mail Verification

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | minor | `backend/src/routes/auth.js` lines 39–68 | Register handler executes three separate DB operations (INSERT users, INSERT email_verification_tokens, send mail) outside a transaction. If the token INSERT fails after user creation, the account exists but has no verification token — the user is effectively stuck until they use resend-verification. Recovery is possible but not transparent to the user. The plan does not mandate transaction semantics here, and the pragmatic recovery path (resend-verification deletes+recreates tokens) mitigates the risk. Not blocking, but worth wrapping in a DB transaction in a follow-up. | No |

No blockers.

#### Verification

##### Steps
1. Read all changed files: `auth.js` (routes), `1713909600000_add_email_verification.cjs`, `verification.hbs`, `api/auth.js`, `AuthContext.jsx`, `RegisterPage.jsx`, `VerifyEmailPage.jsx`, `App.jsx`, `auth.test.js`, `migrations.test.js`, `app.test.jsx`.
2. Cross-checked every deliverable against the T-002 plan section:
   - Migration: `email_verified BOOLEAN NOT NULL DEFAULT true` added to `users` ✅; `email_verification_tokens` table created with all required columns and FK ✅
   - `POST /register`: inserts with `email_verified = false`, no JWT in response, sends verification mail, returns `201 { message }` ✅
   - `POST /login`: rejects `email_verified = false` with `403` ✅
   - `GET /verify-email?token=`: looks up token + expiry, sets `email_verified = true`, deletes token, returns `200 { token: JWT }`, invalid/expired → `400` ✅
   - `POST /resend-verification`: deletes old tokens, inserts new one, sends mail, always returns `200` (even for unknown email) ✅
   - `verification.hbs`: delegates to base partial with appropriate subject/context ✅
   - `api/auth.js`: `verifyEmail(token)` (GET) and `resendVerification(email)` (POST) added ✅
   - `AuthContext.jsx`: `register()` returns raw API response, no `setToken` call ✅
   - `RegisterPage.jsx`: navigates to `/verify-email` with `state: { email }` after successful register ✅
   - `VerifyEmailPage.jsx`: auto-verifies on mount when `?token=` present; shows resend form otherwise; handles cancellation on unmount ✅
   - `App.jsx`: `/verify-email` added as public route outside `ProtectedLayout` ✅
3. Verified acceptance criteria:
   - New registration sends exactly one verification e-mail and returns no JWT — confirmed by test and code ✅
   - Login with unverified account → 403 — confirmed ✅
   - Valid token → JWT issued, `email_verified = true` in DB — confirmed ✅
   - Expired/invalid token → 400 — confirmed ✅
   - Resend creates new token, deletes old ones — confirmed by test (DELETE before INSERT) ✅
   - Existing DB users remain `email_verified = true` after migration — `DEFAULT true` on column ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 57 backend tests pass (+6 new), 82 frontend tests pass (+3 new) ✅

##### Findings
- All acceptance criteria met.
- `addHours(now(), 24)` gives a 24-hour token expiry — reasonable default; plan doesn't specify duration.
- `buildAppUrl` gracefully handles missing `appBaseUrl` by returning just the path — useful in dev without `.env`.
- Email addresses consistently lowercased in all DB queries (`email.toLowerCase()`).
- `VerifyEmailPage` correctly guards against stale async calls via `cancelled` flag — clean React pattern.

##### Risks
- Minor strandable-user risk from non-transactional register (see finding #1). Mitigated by resend-verification recovery path.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-003 — Password Reset

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-04-28

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/pages/ForgotPasswordPage.jsx` lines 21–23 | Plan says "on submit shows static success message regardless of outcome." On a network error or 500, the catch block sets `error` instead of `notice`, so the user sees a technical error message rather than the ambiguous success copy. Backend always returns 200 for this endpoint under normal operation, so the risk only surfaces on network/server faults. Showing the static success notice unconditionally would better match the security intent. | No |

No blockers.

#### Verification

##### Steps
1. Read all changed files: migration `1713913200000_add_password_reset_tokens.cjs`, `password-reset.hbs`, `auth.js` (routes), `api/auth.js`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx`, `LoginPage.jsx`, `App.jsx`, `auth.test.js` (new tests), `migrations.test.js` (new test), `app.test.jsx` (new tests).
2. Cross-checked every deliverable against the T-003 plan section:
   - Migration: `password_reset_tokens` table with all required columns (`id`, `user_id` FK CASCADE, `token UNIQUE`, `expires_at`, `used BOOLEAN DEFAULT false`, `created_at`) ✅
   - `POST /forgot-password`: only acts for `email_verified = true` users; `expires_at = NOW() + 1h`; always returns `200 { message }` ✅
   - `POST /reset-password`: validates token (exists, not expired, `used = false`); hashes new password; marks token `used = true`; returns `200 { message }`; invalid/used/expired → `400` ✅
   - `password-reset.hbs`: delegates to base partial with German subject + 60-min warning body ✅
   - `forgotPassword(email)` and `resetPassword(token, password)` in `api/auth.js` ✅
   - `ForgotPasswordPage`: email form, shows success notice on submit ✅
   - `ResetPasswordPage`: reads `?token`, password form, navigates to `/login` with success message on completion ✅
   - `LoginPage`: "Forgot password?" link to `/forgot-password` added ✅; now also renders `location.state?.message` as a success banner (T-003 + prep for future flows) ✅
   - `App.jsx`: `/forgot-password` and `/reset-password` added as public routes ✅
3. Verified acceptance criteria:
   - Unknown email → `200`, no mail sent — confirmed by test and `if (user?.email_verified)` guard ✅
   - Reset link expires after 60 min → `400` — confirmed (`addHours(now(), 1)`, SQL `expires_at > $2`) ✅
   - Used token rejected with `400` — confirmed (SQL `used = false`, then `SET used = true`) ✅
   - Successful reset allows login with new password — confirmed (bcrypt hash written to `users.password_hash`) ✅
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning ✅
5. Ran `npm test` — 62 backend tests pass (+5 new: 4 auth + 1 migration), 85 frontend tests pass (+3 new) ✅

##### Findings
- Token expiry is 1 hour (`addHours(now(), 1)`) — matches plan's "60 min".
- `forgot-password` correctly skips unverified accounts — prevents reset-before-verify bypass.
- `LoginPage` now handles `location.state?.from` for post-login redirect — bonus prep for T-004 invite flow, no regression risk.
- `ResetPasswordPage` shows an immediate error when no `?token` in URL — good defensive UX.
- Used tokens remain in the table (not deleted) — safe and auditable.

##### Risks
- None for T-003 scope.

#### Verdict
`PASS_WITH_NOTES`
