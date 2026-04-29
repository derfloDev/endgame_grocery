# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-29

#### Findings

- **nit** — `backend/src/logger.js` line 7: `export default logger` is redundant alongside the named export. The plan only required the named export. No callers import the default. Harmless; no fix required.
- **nit** — `backend/src/mail/mailer.js` line 27: `logger.warn({}, "SMTP host is not configured; skipping email delivery")` passes an explicit empty-object merging argument. Pino accepts `logger.warn(message)` directly; the `{}` is a no-op but slightly noisy. The test asserts `fields: {}` and passes, so no regression. No fix required.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` — confirmed T-001 acceptance criteria.
2. Read every changed file listed in the implement HANDOFF entry:
   - `backend/src/logger.js` — singleton pino instance, reads `LOG_LEVEL` from env.
   - `backend/src/app.js` — pino-http middleware registered first; health endpoint excluded; global error handler uses `req.log ?? logger`.
   - `backend/src/index.js` — `startServer()` injectable; structured startup log with all required fields.
   - `backend/src/env.js` — `logLevel` field added.
   - `backend/src/routes/auth.js` — all seven auth events from the plan table logged at correct levels; no passwords or tokens logged.
   - `backend/src/workers/pushWorker.js` — all push-worker events logged; injectable logger; `intervalMs` in startup log.
   - `backend/src/mail/mailer.js` — skip/success/error paths all logged; injectable logger.
   - `backend/src/routes/entries.js` — two `console.error` sites replaced with `logger.error`; injectable logger.
   - `backend/src/db/seed.js` — seed script uses pino logger (CLI-only path, no production risk).
   - `backend/src/app.test.js` — new; covers HTTP request logging and unhandled-error path.
   - `backend/src/index.test.js` — new; covers startup structured log.
   - `backend/src/pushWorker.test.js` — updated; four tests with logger-spy assertions.
   - `backend/src/mail/mailer.test.js` — updated; three tests with logger-spy assertions.
   - `backend/src/env.test.js` — updated; asserts `logLevel` default and fixture loading.
   - `docker-compose.example.yml` — `LOG_LEVEL: info` added with explanatory comment.
3. Searched `backend/src/**/*.js` for `console.` — **no matches**.
4. Ran `npm run lint` — PASS (one pre-existing frontend warning, zero errors).
5. Ran `npm run build` — PASS.
6. Ran `npm test` — PASS: 87 backend tests, 0 failures; all frontend tests pass.

##### Findings
- All nine acceptance criteria are satisfied.
- No `console.*` calls remain in any production source file.
- pino-http correctly emits `req.method`, `req.url`, `res.statusCode`, `responseTime` for every non-health request (verified by `app.test.js`).
- Health endpoint is correctly excluded from HTTP logs.
- Startup log emits `port`, `dbConfigured`, `smtpConfigured`, `vapidConfigured`, `logLevel` (verified by `index.test.js`).
- Auth events, push-worker events, and mailer events all match the plan tables (verified by unit tests with logger spies).
- Injectable logger pattern is consistent across `createMailer`, `startPushWorker`, `processPendingPushJobs`, `createAuthRouter`, `createEntryRouter`, and `createApp`/`startServer`.
- `LOG_LEVEL` documented in `docker-compose.example.yml` with trace/debug/info/warn/error/fatal comment.

##### Risks
- Test stdout is noisy with pino JSON lines from route-level tests that do not inject a silent logger. This is cosmetic; it does not affect correctness or CI signal.

#### Open Questions
- None.

#### Verdict
`PASS`
