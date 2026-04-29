# ROADMAP

Goal: Introduce structured logging (pino + pino-http) in the backend so that relevant, timestamped, machine-readable log entries are visible in the Docker container.

## Priority 1

Objective: Replace scattered `console.*` calls with a central `pino` logger and add HTTP request logging via `pino-http`.

- A `logger.js` module wraps `pino` and is the single log entry point for the backend.
- `pino-http` is registered as Express middleware so every HTTP request/response is logged (method, path, status code, duration).
- Startup logs emit the effective configuration state (port, DB connected, SMTP configured, VAPID configured, log level).
- Auth events (register, login attempt, login failure, email verification, password reset) are logged at `info` level.
- Push worker lifecycle events (start, job processed, notification sent, subscription expired, cooldown skipped) are logged at `info`/`debug` level.
- Mail send success and failure are logged.
- All existing `console.error/warn/log` calls in production code are replaced by the new logger.
- `LOG_LEVEL` environment variable controls verbosity (default: `info`); documented in `docker-compose.example.yml` and `README` (if present).
- Log output is newline-delimited JSON to stdout — compatible with `docker logs` and any log aggregation tool.
