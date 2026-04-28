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
