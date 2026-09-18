# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-09-18

Scope reviewed: uncommitted working-tree changes for the SSE reconnect manager, heartbeat watchdog,
lifecycle-triggered reconnect, named backend `ping` heartbeat, shared connectivity state container and
timing constants module, against `.ai/PLAN.md` Task T-001.

#### Findings

1. **minor** — `.ai/config.json` (staged, whole file) — The working tree carries a staged change to the
   role agent/model/effort settings that is unrelated to T-001. `commit_task` runs `git add -A`, so this
   change will be swept into the T-001 commit. Not a code defect and not a behaviour regression; flagged
   so the inclusion is a deliberate choice rather than an accident. *Required fix: no.*
2. **minor** — validation flakiness (no file) — One `npm test` invocation exited 1 while reporting
   514/514 frontend tests and 174/174 backend tests passing, with no failing test, no unhandled-error
   section and no output after the summary. Two subsequent full runs exited 0. Not reproducible and not
   attributable to this change, but recorded so a repeat on CI is recognised. *Required fix: no.*
3. **nit** — `frontend/src/api/connectivity.ts:6-19` — `stale` is assigned only as
   `nextState === "lost"` alongside `streamState`, and `resetConnectivityForTests` keeps the two
   consistent, so `stale` is always derivable from `streamState` and the `stale === nextStale` half of
   the change guard can never change the outcome. It is also not exported, so T-003 cannot read it yet.
   Consider collapsing it or giving staleness independent meaning when T-003 extends the module.
   *Required fix: no.*
4. **nit** — `frontend/src/context/EventSourceContext.tsx:202-210` — `reconnectIfUnhealthy` classifies an
   in-progress first connect (`readyState === CONNECTING`, no traffic yet) as unhealthy, so a
   `visibilitychange`/`online` event arriving in the first moments of a connect tears down a stream that
   was never given a chance to open. Bounded by user interaction and self-correcting; the conservative
   behaviour is also the safer one for the mobile case this task targets. *Required fix: no.*

#### Required Fixes
- None.

#### Verification

##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; moved T-001 to `in_review`.
- Reviewed the full working-tree diff and read every changed file: `connectionTimings.ts`,
  `connectivity.ts`, `EventSourceContext.tsx`, the three test files, `backend/src/routes/events.js`,
  `backend/src/routes/events.test.js`, `useListEvents.test.ts`, `README.md`.
- `npm run lint` — PASS (exit 0). Only the pre-existing `AuthContext.tsx:158` react-refresh warning.
- `npm run build` — PASS (exit 0), frontend and backend. Only the pre-existing chunk-size warning.
- `npm test` — PASS (exit 0): frontend 39 files / 514 tests, backend 174 tests, 0 failures.
- `npx tsc -b --noEmit` (frontend) — no errors in any T-001 file. Three errors remain in files this task
  does not touch (`ListDetailPage.tsx:221`, `OverviewPage.test.tsx:47`, `iconWorker.ts:42`); the build
  script is `vite build`, which does not typecheck, so these are pre-existing and out of scope.
- `npm run e2e` — 9/9 failed, all at `setupLoggedInUser` on the registration request, before any SSE
  behaviour is exercised. Root cause confirmed environmental and pre-existing: no local PostgreSQL
  (`connect ECONNREFUSED 127.0.0.1:5432` and `::1:5432` in the backend log). Not attributable to T-001,
  and the plan does not require an E2E run for this task.
- **Manual live test of the backend heartbeat** (the acceptance criterion an automated test cannot fully
  prove): started the real backend, minted a JWT against the configured `JWT_SECRET`, and held a real
  SSE connection open for 65 s with `curl -N`. Captured the raw bytes with `od -c`. Two frames arrived,
  exactly `event: ping` + `data: {"ts":"2026-09-18T10:19:56.713Z"}` followed by a blank line, and the
  same at `10:20:26.712Z` — correct wire format, correct 30 s interval, and
  `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache`, `Connection: keep-alive`,
  `X-Accel-Buffering: no` headers intact. Because the frames carry `event: ping`, they cannot dispatch
  `onmessage`, so a client that registers no `ping` listener is provably unaffected. Backend stopped
  afterwards; port 4000 confirmed free.
- `grep` for residual `:heartbeat` producers/consumers across `backend/src`, `frontend/src` and
  `README.md` — none left; only the unchanged `heartbeatIntervalMs` option and explanatory comments.
- `grep` for `useEventSource` consumers — only `useListEvents.ts`, which destructures `addEventListener`
  and is unaffected by the additive `connectionState` field.

##### Findings
- All six acceptance criteria are met and each is backed by a test:
  - No token means no connection and no timer — asserted for mount plus `visible` and `online` wake-ups.
  - Increasing, capped delay — the `100, 200, 400, 400, 400` sequence, plus separate jitter tests at
    `Math.random()` 0 and 1 (`70`/`130` ms) and a cap test proving positive jitter cannot exceed the
    maximum. `Math.min(maxDelay, delay * (1 + (random * 2 - 1) * ratio))` matches the documented ±30%.
  - Watchdog without an `error` event — a silent stream is closed at exactly the timeout and reconnects;
    also verified at the real 45 s / 1 s defaults, not only the injected test timings.
  - `ping` re-arms the watchdog — parameterised over `ping`, `message`, `entry:created`,
    `history:updated`.
  - `visibilitychange`/`online` — reconnect immediately when unhealthy and cancel the pending backoff,
    no-op when healthy, ignore `hidden`. The elapsed-time check in `reconnectIfUnhealthy` correctly
    handles a throttled background timer that never fired, covered by the `setSystemTime` test.
  - Unmount and token removal — stream closed, `onopen`/`onerror` nulled, all listeners removed,
    `vi.getTimerCount()` 0, and stale callbacks from the old stream provably ignored via `isCurrent()`.
- The `attemptRef` reset rule matches the plan's explicit constraint: it resets only in `onopen`, never
  on a scheduled attempt, and the "resets backoff only after the stream opens" test locks that in.
- StrictMode double-mount is covered: exactly one live stream and one watchdog survive setup/cleanup,
  and unmount leaves zero timers. This was called out as a risk in the plan and is properly discharged.
- Documentation is accurate and shipped in the same change: the `README.md` SSE bullet now describes the
  backoff, jitter, cap, watchdog, lifecycle recovery and `connectionState`, and a new bullet documents
  the `ping` event and its backward compatibility. Code comments state the mobile-lifecycle reason for
  the watchdog, the backoff and the named backend heartbeat, as the plan required.
- `createTimeoutSignal` and the T-003/T-004 constants land early in `connectionTimings.ts`. This follows
  the plan's "shared foundations" section rather than exceeding scope, and the helper is covered by its
  own tests, so it is not untested dead code.
- The backend change is additive and backward compatible; no producer or consumer of the old
  `:heartbeat` comment remains anywhere in the repository.

##### Risks
- The E2E suite cannot be exercised locally without PostgreSQL, so no browser-level proof of the
  reconnect path exists on this machine. Residual risk is low: the reconnect manager is covered by 20+
  fake-timer tests and the backend half was verified against a real server. T-002 and T-004 should
  re-attempt E2E once a database is available.
- Real-device behaviour (iOS/Android background timer throttling, bfcache restore) is still unproven by
  any test. `reconnectIfUnhealthy` compensates with an elapsed-time check rather than trusting timers,
  which is the right mitigation, but a real-device smoke test before release remains worthwhile.
- Every client reconnecting after a shared outage is bounded only by the ±30% jitter and the 30 s cap.
  Accepted in the plan for this deployment size; revisit if the user base grows.
- The one unexplained non-zero exit from `npm test` (finding 2) could resurface in CI.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
