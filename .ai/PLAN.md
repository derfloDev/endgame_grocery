# Plan

Status: **ready_for_implement**

Goal: Introduce structured logging (pino + pino-http) in the backend so that relevant, timestamped, machine-readable log entries appear in the Docker container.

## Scope

Replace all scattered `console.*` calls in the backend with a central `pino` logger and add HTTP request/response logging via `pino-http`. Log key lifecycle events (startup, auth, push worker, mail) so that problems are diagnosable from `docker logs` alone.

## Acceptance Criteria

1. Every HTTP request/response is logged (method, URL, status code, response time in ms).
2. Startup emits: port, whether DB / SMTP / VAPID are configured, effective log level.
3. Auth events logged at `info`: successful registration, login, email verification, password reset completion; login failures logged with reason at `warn`.
4. Push worker: start logged at `info`; per job: processed, notifications sent (count), subscriptions expired (count), cooldown skipped; errors at `error`.
5. Mailer: skipped (no SMTP) at `warn`; successful send at `info` (to, subject); send errors at `error`.
6. All existing `console.error/warn/log` calls in production code are gone.
7. `LOG_LEVEL` env var controls verbosity (default: `info`); documented in `docker-compose.example.yml`.
8. Log lines are newline-delimited JSON written to stdout.
9. `npm run lint`, `npm run build`, and `npm test` all pass.

## Dependencies to Install

```
pino pino-http
```

(added to `backend/package.json` dependencies)

## Architecture Decisions

- **Singleton logger**: `backend/src/logger.js` exports a single pino instance (same pattern as `getPool()`). Most modules import it directly.
- **Injectable logger for testable modules**: `createMailer` and `startPushWorker` accept an optional `logger` parameter so existing unit tests can inject a no-op/spy. This follows the existing dependency-injection pattern used throughout the codebase.
- **No `pino-pretty` in production**: Raw JSON to stdout. Operators can pipe through `pino-pretty` locally if desired.
- **`pino-http` in app.js**: Registered before route handlers. Uses the same pino instance so log levels and config are consistent.
- **Health endpoint excluded**: `/api/health` requests are filtered out of HTTP logs to reduce noise.

## Implementation Phases

### Phase 1 — Logger Infrastructure

**Files:**
- `backend/package.json` — add `pino` and `pino-http` to `dependencies`
- `backend/src/logger.js` — **new file**

**`logger.js` contract:**
```js
import pino from "pino";
import { getConfig } from "./env.js";  // not imported; read process.env directly to avoid circular deps

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});
```

Export a named `logger` singleton. No other logic.

---

### Phase 2 — HTTP Request Logging & Global Error Handler

**Files:**
- `backend/src/app.js`

**Changes:**
1. Import `pinoHttp` from `pino-http` and `logger` from `./logger.js`.
2. Register `pinoHttp({ logger, ignore: "req.url === '/api/health'" })` as the first middleware before all routes.
3. Update the global error handler to call `logger.error({ err: error }, "Unhandled error")` instead of `console.error(error)`.

---

### Phase 3 — Startup Logging

**Files:**
- `backend/src/index.js`
- `backend/src/env.js`

**`env.js` changes:**
- Add `logLevel: process.env.LOG_LEVEL ?? "info"` to the returned config object.

**`index.js` changes:**
Replace the single `console.log` with a structured startup block:
```js
import { logger } from "./logger.js";
// after app.listen callback:
logger.info({
  port,
  dbConfigured: Boolean(config.databaseUrl),
  smtpConfigured: Boolean(config.smtpHost),
  vapidConfigured: Boolean(config.vapidPublicKey && config.vapidPrivateKey),
  logLevel: config.logLevel
}, "Backend started");
```

---

### Phase 4 — Auth Event Logging

**Files:**
- `backend/src/routes/auth.js`

Import `logger` from `../logger.js`. Add log calls (no user passwords or tokens logged):

| Event | Level | Fields |
|---|---|---|
| Registration success | `info` | `userId`, `email`, `inviteUsed` |
| Registration — email already exists | `warn` | `email` |
| Login success | `info` | `userId` |
| Login failure (user not found or wrong password) | `warn` | `email`, `reason: "invalid_credentials"` |
| Login failure (email not verified) | `warn` | `email`, `reason: "email_not_verified"` |
| Email verified | `info` | `userId` |
| Password reset completed | `info` | `userId` |

---

### Phase 5 — Push Worker Logging

**Files:**
- `backend/src/workers/pushWorker.js`

Accept optional `logger` parameter (default: import from `../logger.js`):
```js
export function startPushWorker({ ..., logger: loggerOverride } = {}) {
  const log = loggerOverride ?? logger;
  log.info("Push worker started");
  ...
}
```

Log events:
| Event | Level | Fields |
|---|---|---|
| Worker started | `info` | `intervalMs` |
| Worker tick error | `error` | `err` |
| Job processed | `info` | `jobId`, `listId`, `notificationsSent`, `subscriptionsExpired` |
| Job skipped (cooldown) | `debug` | `jobId`, `listId` |
| Job skipped (no recipients) | `debug` | `jobId`, `listId` |
| Subscription expired (410) | `info` | `endpoint` (truncated to 60 chars) |

---

### Phase 6 — Mailer Logging

**Files:**
- `backend/src/mail/mailer.js`

Accept optional `logger` parameter:
```js
export function createMailer({ ..., logger: loggerOverride } = {}) {
  const log = loggerOverride ?? logger;
  ...
}
```

| Event | Level | Fields |
|---|---|---|
| SMTP not configured, skipping | `warn` | — |
| Email sent successfully | `info` | `to`, `subject` |
| Email send error | `error` | `err`, `to`, `subject` |

Remove the existing `console.warn` call.

---

### Phase 7 — Remaining console.* Replacements

**Files:**
- `backend/src/routes/entries.js`

Replace:
- `console.error("Failed to enqueue push notification job.", pushError)` → `logger.error({ err: pushError }, "Failed to enqueue push notification job")`
- Both `console.error("Failed to upsert autocomplete history.", historyError)` → `logger.error({ err: historyError }, "Failed to upsert autocomplete history")`

---

### Phase 8 — Test Updates

**Files:**
- `backend/src/mail/mailer.test.js`

The existing test stubs `console.warn` to assert the "SMTP not configured" warning. With injectable logger, update to pass a no-op/spy logger:
```js
const warnMessages = [];
const fakeLogger = { warn: (msg) => warnMessages.push(msg), info: () => {}, error: () => {} };
const mailer = createMailer({ logger: fakeLogger });
// assert warnMessages contains the expected message
```

---

### Phase 9 — Documentation

**Files:**
- `docker-compose.example.yml`

Add `LOG_LEVEL: info` to the `app` service's `environment` section with an explanatory comment:
```yaml
# Log verbosity: trace | debug | info | warn | error | fatal (default: info)
LOG_LEVEL: info
```

## Validation

```
npm run lint
npm run build
npm test
```

All three must pass with zero errors before the task moves to `ready_for_review`.
