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

## Task: T-002

### Review Round 1

Status: **complete**

Reviewed: 2026-09-18

Scope reviewed: uncommitted working-tree changes for `resyncVersion` with the dedupe window, the overview
and detail wiring on the light reload path, and `mergePendingEntries`, against `.ai/PLAN.md` Task T-002.

#### Findings

1. **minor** — `frontend/src/pages/ListDetailPage.test.tsx:215` — `await waitFor(() => { expect(fetchRecentlyUsedMock).toHaveBeenCalledTimes(2); })`
   asserts an exact count on a monotonically increasing counter inside a retry loop, so it passes only if
   a poll lands on the right instant. Observed failing once as *"expected spy to be called 2 times, but
   got 3 times"* during a contended full-suite run. The same assertion shape is existing house style
   (`AppConfigContext`, `EventSourceContext`, `OfflineQueueContext` tests all use it), so this is a
   pre-existing convention rather than a new anti-pattern, but this instance is the one that has actually
   been seen to flake. Consider awaiting a deterministic condition and asserting the settled count
   outside `waitFor`. *Required fix: no.*
2. **minor** — `frontend/src/pages/ListDetailPage/useListDetailData.ts:61,98` — `entriesRef` is not cleared
   when `listId` changes, and the full loader sets entries only after its fetch resolves, so during a
   navigation from list A to list B the ref still holds list A's entries. If an `entry:*` SSE event for
   list B arrives inside that window, `handleEntryChange` runs `loadEntries()`, which merges B's server
   entries with A's `is_pending_sync` entries. Because the merge keys on id and the server will never
   return list A's `temp-*` id, the foreign entry then sticks across every later light reload until a
   full load or remount. The window is narrow (a still-unsynced write plus an immediate navigation plus a
   concurrent SSE event for the destination list) and nothing is written to the entries cache on this
   path, so no persisted state is corrupted. Clearing `entriesRef` alongside the `listId` change, or
   tagging the ref with the list it belongs to, would close it. *Required fix: no.*
3. **minor** — `frontend/src/pages/ListDetailPage/ListDetailPage.tsx:105-112` — a resync that fails calls
   `setEntryError` through `loadEntries`/`loadMembers`, so a transient fetch failure right after a flaky
   reconnect renders the error banner above content that is otherwise fine. It is a banner rather than a
   full-page error state, so nothing is cleared, but the flow this epic targets is precisely the one where
   the first post-wake request is most likely to fail. T-004 already plans "a transient failure that is
   being retried must not render as a hard error banner" for the queue; the resync path deserves the same
   treatment there. *Required fix: no.*
4. **minor** — suite robustness — the two new `ListDetailPage resync` tests use real timers, `userEvent`
   and deferred promises, and roughly triple that file's runtime under load (33 s isolated, 106 s in a
   contended full run). With `testTimeout: 20000`, no `retry` configured, and Testing Library's 1 s
   `findBy` default, the full suite becomes failure-prone when the machine is busy. Casualties in my runs
   were mostly pre-existing tests (`AddItemSheet` icon tests, `authentication shell > submits the login
   form`). This is a pre-existing fragility that T-002 makes more likely to trigger; a `retry: 1` for the
   frontend project would be the cheap mitigation. *Required fix: no.*
5. **nit** — `frontend/src/pages/ListDetailPage/listDetailUtils.ts:11-19` — moving `ShareInviteResult` and
   `isShareInviteResult` out of `ListDetailPage.tsx` is unrelated to T-002 and was not required by lint.
   Harmless, but it widens the diff. *Required fix: no.*
6. **nit** — `frontend/src/context/EventSourceContext.tsx:92` — `setResyncVersion(0)` on every effect run
   resets the counter on a token change. A page that outlives that change would see its `lastResyncRef`
   (> 0) differ from the new `0` and perform one spurious resync. In practice the protected pages unmount
   on logout, so this is not reachable today. *Required fix: no.*

#### Required Fixes
- None.

#### Verification

##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; moved T-002 to `in_review`.
- Read the full diff for all 12 changed files plus the 2 new files, and read the surrounding
  implementation (`loadListDetail`, `loadEntries`, `reloadHistory`, `loadMembers`, `addRecentlyUsedEntry`,
  `OfflineQueueContext` drain) to check the paths the diff interacts with.
- `npm run lint` — PASS (exit 0). Only the pre-existing `AuthContext.tsx:158` warning.
- `npm run build` — PASS (exit 0), frontend and backend.
- `npm test` — PASS (exit 0) on an idle machine: 40 files / 530 frontend tests, 174 backend tests.
  Frontend-only runs repeated twice more: 530/530, exit 0 both times.
- **Flakiness investigation.** Three earlier full runs failed (exit 1) while I had builds and Playwright
  servers running concurrently. Failures differed per run: 2 failed, then 5 failed, then 1 failed. All but
  one were `Test timed out in 20000ms` or a 1 s `findBy` miss on pre-existing tests. The single
  non-timeout failure was finding 1. I then re-ran `ListDetailPage.test.tsx` in isolation 5 times (25/25
  every time, 33 s) and `app.test.tsx` in isolation (37/37), confirmed no stray dev servers held ports
  4000/5173 and CPU was idle, and re-ran the full gate clean. Conclusion: contention-driven, with the
  one structurally fragile assertion noted above. The gate is green on a quiet machine.
- `npx tsc -b --noEmit` (frontend) — the same three pre-existing errors as in T-001
  (`ListDetailPage.tsx:223`, `OverviewPage.test.tsx:51`, `iconWorker.ts:42`), no new ones. The two
  T-002 line numbers shifted only because lines were added above them.
- **Browser verification** — `npm run e2e -- e2e/resync.spec.js` PASS twice (exit 0, 2/2 both runs). This
  is the strongest evidence in this round: the new spec drives a real Chromium page with a real React
  tree, stubbing only the SSE transport and the `/api/*` responses, so it does not need the PostgreSQL
  instance that blocks the rest of the E2E suite. It proves acceptance criteria 1, 2 and 4 end to end.
- Confirmed the pre-existing full E2E suite is still blocked by the missing local database, unchanged
  from the T-001 round, and that the new spec deliberately sidesteps that with `page.route` fixtures.

##### Findings
- All four acceptance criteria are met:
  - *Changes made while backgrounded appear on return* — covered by the provider unit test for
    hidden-to-visible, by the overview page test, and end to end by "refreshes overview changes made while
    the page was hidden", which renames the list while hidden and asserts exactly one extra `/api/lists`
    request after the transition.
  - *Reconnect plus foreground triggers exactly one resync* — the dedupe window is verified in both
    orders (reconnect-then-foreground and foreground-then-reconnect), at the window boundary
    (199 ms no, 200 ms yes), and end to end by the second E2E test asserting `entries` incremented by
    exactly 1 while `lists` did not move at all.
  - *Pending entries stay visible with their pending state* — parameterised over both the resync and the
    SSE trigger, asserting the queued chip, the entry text and its details all survive an in-flight
    reload, and that the item does not reappear in Recently Used.
  - *No full-screen loading state during resync* — asserted via the absence of the loading element plus
    `fetchLists`/`markListViewed` staying at 1 call, which is the real proof that the heavy
    `loadListDetail` path did not run; the E2E test re-checks it in a browser with a gated response.
- `requestResync` gating is right. `hasOpened`/`lostSinceOpen` correctly exclude the very first connect
  (including the case where the first connect only succeeds after initial failures, which has its own
  test), and the unhealthy-foreground path defers to the subsequent `onopen` rather than firing a resync
  against a stream that is not back yet — covered by "waits for the unhealthy foreground stream to reopen
  before resyncing".
- The `lastResyncRef` guard in the detail page is correct and does real work: `reloadHistory` depends on
  `entries`, so its identity churns on every entries change and the resync effect re-runs often. The ref
  comparison absorbs that. The `isLoading` check defers rather than drops a resync that lands mid-load,
  because the ref is only advanced on the path that actually runs — a subtle detail that is easy to get
  wrong and was got right here.
- The `setEntries` wrapper with `entriesRef` is a genuine improvement, not just plumbing: the previous
  `updateEntries` relied on a state updater running synchronously to capture `nextEntries`, which is a
  React anti-pattern that happened to work. Routing every write through one wrapper also means the full
  loader and every optimistic path keep the ref in sync; I checked that `setEntriesState` has no other
  call site.
- `mergePendingEntries` is a pure function, does not mutate its inputs (explicitly asserted), preserves
  server order then local pending order, and keys on id exactly as the plan specified. Toggle-style
  optimistic entries reuse the real server id, so the merge correctly prefers the server copy for those
  and only retains genuinely unknown `temp-*` adds.
- Documentation is accurate and shipped with the change: the README refetch bullet now describes the
  reconnect and foreground triggers, the 2 s dedupe, the first-connection exclusion, the in-place detail
  refresh and the pending-entry preservation, and a new paragraph documents the resync E2E spec and its
  limits. Code comments explain why the first connect is excluded and why the entries snapshot is needed.

##### Risks
- The full frontend suite is not robust under CPU contention (finding 4). CI runs no vitest retries, so a
  busy runner can produce red builds that have nothing to do with the change under test.
- The E2E spec stubs `window.EventSource` and every `/api/*` response, so it proves the provider-to-page
  integration and the lifecycle wiring, not the real transport or real server data. The README states
  this limitation explicitly, which is the right call.
- Real-device background suspension and bfcache restore remain unproven, carried over from T-001. T-003
  adds the `pageshow` trigger that covers part of this.
- Every client resyncing on foreground return is still a thundering-herd risk, accepted in the plan for
  this deployment size.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

## Task: T-003

### Review Round 1

Status: **complete**

Reviewed: 2026-09-18

Scope reviewed: uncommitted working-tree changes completing the connectivity module (probe, rate limit,
in-flight de-duplication, request-outcome reporting), the `client.ts` outcome hooks, and the offline
queue's derived state plus extended lifecycle triggers, against `.ai/PLAN.md` Task T-003.

#### Findings

1. **minor** — `frontend/src/context/OfflineQueueContext.tsx:29` — the initial banner state is
   `getIsOnline() === false`, which is `false` at startup because reachability is still unknown (`null`).
   Previously it was `!navigator.onLine`, so a cold start with no connectivity showed the offline banner
   immediately; now the app looks online until the first probe resolves (up to
   `REACHABILITY_PROBE_TIMEOUT_MS`). This follows directly from demoting `navigator.onLine` to a hint and
   is arguably the correct trade, but it is a user-visible change that neither the plan nor the README
   calls out. Seeding the initial state from the hint while still letting the probe be authoritative
   would keep both properties. *Required fix: no.*
2. **nit** — `frontend/src/context/OfflineQueueContext.tsx:115-118` — `checkAndDrain` closes over the
   `timings` **prop object**, so a consumer passing an inline object literal would give it a new identity
   every render, tearing down and re-registering all six lifecycle listeners and calling `checkAndDrain()`
   on every render. Not reachable today: production passes no `timings` (stable `undefined`), `app.test.tsx`
   uses a module-level constant, and the provider test renders once. Worth a `useMemo` or destructuring
   the two numbers if the prop ever gets a second caller. *Required fix: no.*
3. **nit** — `frontend/src/context/OfflineQueueContext.tsx:115-118` and `:131-139` — on recovery the drain
   is requested twice: `checkAndDrain` awaits `ensureFreshState()`, whose successful probe calls `notify()`,
   which makes the subscriber see `recovered` and call `checkAndDrain()` again, while the original call
   continues into `drainQueue()`. The `isSyncingRef` guard at the top of `drainQueue` makes the second a
   no-op, so this is harmless today, but it does mean the recovery path depends on that guard for
   correctness rather than by construction. *Required fix: no.*
4. **nit** — `frontend/src/context/OfflineQueueContext.tsx:150-152` — the `offline` browser event no longer
   sets the banner directly; it now only schedules a reachability check, so the banner can lag a genuine
   disconnect by up to the probe timeout. Inherent to the "reachability is truth" design and consistent
   with the README wording ("recheck reachability"), but it is slower than the old immediate flip.
   *Required fix: no.*

#### Required Fixes
- None.

#### Verification

##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; moved T-003 to `in_review`.
- Read the full diff for all changed files and the complete `connectivity.ts`, tracing every state
  transition (`streamState`, `isOnline`, `stale`, `lastCheckedAt`, `lastProbeAt`, `browserHint`,
  `inFlight`) through `confirmOnline`, `reportStreamState`, `reportRequestOutcome`, `ensureFreshState`,
  `probeReachability` and `finish`.
- `npm run lint` — PASS (exit 0). Only the pre-existing `AuthContext.tsx:158` warning.
- `npm run build` — PASS (exit 0), frontend and backend.
- `npm test` — PASS (exit 0) **twice**: 40 files / 558 frontend tests (28 new), 174 backend tests.
  Machine confirmed idle first (ports 4000/5173 free, CPU 0), after the contention problems seen in the
  T-002 round; no flakiness observed in either run.
- `npx tsc -b --noEmit` (frontend) — the same three pre-existing errors, none new.
- `npm run e2e -- e2e/resync.spec.js` — PASS (2/2), confirming T-002's browser scenarios still hold now
  that the queue provider probes on `focus`/`pageshow` during those runs.
- **Live browser verification of the rate limit** (real Chromium against the real dev servers, driven by a
  throwaway script outside the repo): loaded the app and counted `/api/health` requests. One probe on
  load; a burst of five wake-up events (`focus`, `pageshow`, `online`, `offline`, `visibilitychange`)
  inside the window produced **0** additional probes; one further trigger after the window expired
  produced exactly **1**. That is acceptance criterion 3 proven in a browser, not just under fake timers.
- **Live browser verification of the headline criterion**: seeded an authenticated session, stubbed
  `/api/*`, and used an `EventSource` that never opens so the stream shortcut could not mask the probe.
  With a reachable server and `navigator.onLine === true` there was no banner. I then made `/api/health`
  fail while leaving `navigator.onLine === true`, and after one wake-up the banner appeared reading
  *"Offline mode: cached data is available."* Restoring the server and firing another wake-up cleared it
  with no reload. Three probes total across the run. This is acceptance criterion 1 — the exact mobile
  failure mode this epic exists to fix — confirmed end to end.
- My first pass at that check reported no banner and I chased it down rather than accepting it:
  `OfflineBanner` is mounted only inside `ProtectedLayout`, so it never renders on `/login` where the
  first attempt ran. A harness artifact, not a product gap; the second run above corrects it.
- Inspected `/api/health` (`backend/src/app.js:63`) and the service worker. The endpoint is a static
  handler with no database access, no auth and no rate limiting, registered ahead of the other middleware
  and excluded from request logging. The service worker only calls `precacheAndRoute` on the build
  manifest and registers `push`/`notificationclick`; it has no runtime route for `/api/*`. Together with
  `cache: "no-store"` this means the probe genuinely reaches the network and cannot be answered from a
  cache.

##### Findings
- All four acceptance criteria are met:
  - *`navigator.onLine === true` plus a failing probe reports offline and keeps queueing* — the provider
    test asserts the offline state, that no mutation was removed and that the queue still holds its
    entry; confirmed in a real browser as described above.
  - *`navigator.onLine === false` plus a succeeding probe reports online and drains* — parameterised
    across `focus`, `pageshow`, `online`, `offline`, `visibilitychange` and the queue-changed event, each
    asserting the mutation drains while `navigator.onLine` is still `false`.
  - *At most one probe per window* — asserted at the boundary (4999 ms no, 5000 ms yes), for bursts, and
    for the case where a failed probe or a browser-hint change must **not** bypass the limit.
  - *An open stream reports online without a probe* — asserted with a `fetch` spy, including that the
    shortcut survives 10 s and then correctly gives way to probing once the stream is lost.
- The probe implementation is careful in ways the plan did not spell out but that matter: `finish` is
  idempotent via the `finished` flag, always cancels the deadline and removes its abort listener (every
  probe test asserts `vi.getTimerCount() === 0`), and a late-arriving `fetch` result after a timeout
  cannot republish state. A newer `reportStreamState("open")` or `reportRequestOutcome("ok")` landing
  while a probe is in flight cancels it and keeps the newer success rather than letting the stale failure
  overwrite it — tested for both sources.
- The derivation rule matches the plan exactly: a lost stream, a failed request or a `navigator.onLine`
  transition only marks the state **stale**, never offline. `navigator.onLine === false` on its own never
  forces offline, which is the whole point on mobile, and there is a test asserting precisely that.
- Reporting any HTTP response — including 404 and 503 — as "reachable" is the right reading of
  *reachability*: the server answered. It also means a 5xx episode will not flip the app into offline mode
  and start queueing writes behind a server that is actually up. The 5xx retry behaviour belongs to T-004,
  and this split is clean.
- `sendJsonRequest` reports `network-error` only when `isNetworkError(error)` holds, so an
  `AuthExpiredError` or a JSON parse failure does not get misread as a connectivity problem. The probe
  itself uses raw `fetch`, not `sendJsonRequest`, so there is no reporting recursion.
- `mountedRef` correctly prevents a drain from starting after unmount when a probe resolves late, with a
  dedicated test.
- Scope was respected: `OfflineBanner.tsx` and the `en`/`de` translation files were left untouched, which
  the plan permitted only if the wording still fit — it does, as the live check showed.
- `app.test.tsx` now intercepts `/api/health` ahead of the ordered fixture chain. This is the right fix:
  those tests drive `fetch` through strict `mockResolvedValueOnce` sequences, and an unmodelled probe
  request would shift every subsequent response.
- Documentation is accurate and shipped with the change: the README offline bullet now describes probe-based
  reachability, the hint demotion, the no-store probe, the 5 s timeout and window, the stream shortcut and
  the HTTP-response evidence. Code comments cover the derivation rule and why each browser hint is distrusted.

##### Risks
- Initial-state latency (finding 1): a cold start with no connectivity briefly presents as online.
- Every wake-up trigger now funnels into `ensureFreshState`, so the queue's behaviour depends on the shared
  module's rate limiter. It held in both the unit tests and the live browser run, but it is now a single
  point of failure for probe volume across the app; T-004 adds more callers on top of it.
- The module is process-global singleton state. `resetConnectivityForTests` is thorough (listeners,
  in-flight abort, all timestamps, the hint), and the provider tests reset in both `beforeEach` and
  `afterEach`, but any future test that forgets will inherit state from its neighbours.
- Real-device behaviour (iOS bfcache, background suspension) is still unproven by automation; the new
  `pageshow` trigger is the mitigation the plan intended, and it is covered in jsdom but not on a device.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

## Task: T-004

### Review Round 1

Status: **complete**

Reviewed: 2026-09-20

Scope reviewed: uncommitted working-tree changes for request timeouts, transient-vs-permanent error
classification, queue retry with capped backoff, the stall release, and the order/idempotency guarantees,
against `.ai/PLAN.md` Task T-004. This round covers a substantial restructuring: the drain loop moved out
of the provider into `frontend/src/api/offlineQueueDrain.ts`, and the timeout/outcome plumbing into
`frontend/src/api/request.ts`.

#### Findings

1. **minor** — `frontend/src/api/request.ts:29-30` with `:5-9` — a deliberate cancellation is reported as a
   connectivity failure. When the stall deadline or unmount aborts a drain, `requestJson` catches the
   resulting `AbortError`, which `isNetworkError` now classifies as a network error, so it calls
   `reportRequestOutcome("network-error")`. That marks the shared connectivity state stale and provokes an
   extra `/api/health` probe even though nothing about the network failed. Harmless in effect — stale is
   not offline, and T-003's rate limit bounds the probe — but it feeds a false signal into the module that
   is now the app's source of truth. Distinguishing an abort caused by the parent signal from one caused by
   the request deadline would fix it. *Required fix: no.*
2. **minor** — `frontend/src/context/OfflineQueueContext.tsx:100-102` and `:140-143` — a wake-up that lands
   during an active drain is dropped rather than deferred. `checkAndDrain` returns early while
   `activeRun.current` is set, so an `OFFLINE_QUEUE_CHANGED_EVENT` fired between the drain loop's final
   `listOfflineMutations()` and the release of `activeRun` is lost. Because that drain succeeded, no retry
   is scheduled, so the newly queued mutation waits for the next `focus`/`visibilitychange`/`online` event
   instead of syncing promptly. The window is small and every later wake-up recovers it, but the drain loop
   already re-reads the queue each iteration, so a "re-check once more before releasing" pass would close it
   cheaply. *Required fix: no.*
3. **nit** — `frontend/src/context/OfflineQueueContext.tsx:76` — `setIsSyncing(true)` is now unconditional at
   the top of `drainQueue`, whereas the previous implementation set it only after confirming a non-empty
   queue. With an empty queue `isSyncing` therefore goes true then false around an await, and `OfflineBanner`
   renders `offline.syncing` with `queuedCount` 0 — "Syncing 0 queued changes..." — if React ever commits the
   intermediate state. I could not reproduce a visible flash: a real-browser run with a `MutationObserver`
   watching for any banner node recorded nothing across a cold load and three `focus` wake-ups, because the
   settle lands in the same commit. It stays latent rather than actual, but a slow IndexedDB open could
   surface it and no test pins `isSyncing === false` for an empty queue. *Required fix: no.*
4. **nit** — `frontend/src/api/offlineStore.ts:170-196` — `completeOfflineMutation` rewrites every remaining
   queued mutation on each completion, so draining a queue of n mutations performs O(n²) record writes.
   Irrelevant at grocery-list queue sizes and it buys genuine atomicity, so this is a note rather than a
   concern. *Required fix: no.*
5. **nit** — `frontend/src/api/offlineStore.test.ts:9` — the new unit test stubs `indexedDB` to `undefined`
   and therefore exercises only the in-memory fallback, while the IndexedDB cursor path is what production
   uses and is the more intricate of the two. The `e2e/queue-retry.spec.js` reload test covers it end to end,
   and I verified it directly (see Verification), so this is a coverage-shape note, not a gap in behaviour.
   *Required fix: no.*

#### Required Fixes
- None.

#### Verification

##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; moved T-004 to `in_review`.
- Read the full diff and both new modules end to end, tracing the abort plumbing
  (`createTimeoutSignal` → `abortable` → `requestJson`'s parent-signal relay → the drain's `run.signal`) and
  every early return in `drainQueue`/`checkAndDrain`/`scheduleRetry`.
- `npm run lint` — PASS (exit 0). Only the pre-existing `AuthContext.tsx:158` warning.
- `npm run build` — PASS (exit 0), frontend and backend.
- `npm test` — PASS (exit 0) **twice**: 41 files / 579 frontend tests (21 new), 174 backend tests. Machine
  confirmed idle first; no flakiness in either run.
- `npx tsc -b --noEmit` (frontend) — the same three pre-existing errors, none new.
- `npm run e2e -- e2e/queue-retry.spec.js e2e/resync.spec.js` — PASS, 4/4. The two new browser scenarios
  prove the retry-after-transient-failure path and, critically, that a reload mid-drain does **not** resend
  the already-accepted parent (`writes` is exactly `["/api/lists", "/api/lists/real-list/entries",
  "/api/lists/real-list/entries"]`). T-002's resync scenarios still pass unchanged.
- **Direct verification of `completeOfflineMutation` against real IndexedDB**, because its unit test stubs
  IndexedDB away and this function carries the task's headline risk. Driving real Chromium, I enqueued three
  mutations out of chronological order, then completed them one at a time and read the store back. Results:
  listing order followed `createdAt` (`parent`, `child`, `third`); completing `parent` left **both** `child`
  and `third` in place, each carrying `{temp-list: real-list}`; completing `child` left `third` carrying the
  **merged** `{temp-list: real-list, temp-entry: real-entry}`. That matches the memory-path unit test exactly
  and confirms the delete-plus-cursor-update transaction and the accumulating id map behave correctly on the
  production storage path.
- **A false alarm I chased down rather than reported.** My first pass at that check appeared to show
  catastrophic data loss — `third` vanished from IndexedDB, which would have meant silently discarding a
  user's queued item. Re-running against the raw object store reproduced it, so I isolated the cause instead
  of filing it: the app was mounted and live, so `enqueueOfflineMutation`'s queue-changed event woke the
  provider, which legitimately drained my seeded mutations against my stubbed 200 routes. Repeating the
  experiment with `/api/health` failing (so the provider stays offline and never drains) produced the correct
  results above, and the recorded write attempts confirmed the provider had been the one consuming them.
  There is no data-loss defect here.
- Re-read `OfflineBanner.tsx` against the new state model and ran the banner check described in finding 3.

##### Findings
- All five acceptance criteria are met:
  - *Network error or 5xx retries automatically with increasing delay* — the 5xx test walks the full
    `100, 200, 400, 400` capped sequence, asserting at each step that the request fires only on the boundary
    tick, and separately that the delay resets to the base after a successful drain. A second test covers a
    pure network error and confirms recovery happens on the retry timer alone, with no browser event.
  - *4xx does not retry and still offers discard* — asserted including a later `focus` wake-up, with the
    request count pinned at 1, the discard button present and `vi.getTimerCount()` 0.
  - *Timeout treated as offline* — `isNetworkError` now covers `AbortError`/`TimeoutError`, so the
    `client.test.ts` cases show a timed-out read falling back to cache and a timed-out queueable write being
    enqueued.
  - *Interrupted drain resumes in order without resending* — covered three ways: a unit test that remounts
    mid-queue and asserts the exact URL sequence with the resolved real id and the removal order
    `parent, child, last`; a unit test where local acknowledgement fails and the request is **not** resent;
    and the e2e reload test above.
  - *Stalled drain cannot block past the stall timeout* — parameterised over both the request deadline and
    the stall deadline, asserting the signal aborts, `isSyncing` returns to false, a later trigger drains
    successfully, and a late-arriving response from the abandoned run is ignored.
- The idempotency design is stronger than the plan required. The plan asked for removal-after-accepted plus a
  rebuilt id map; the implementation additionally persists the temp→real mappings onto the remaining queued
  mutations inside the *same* IndexedDB transaction that deletes the completed one, so the mapping survives a
  page reload rather than living only in memory. The in-memory `accepted` map then covers the narrower window
  where the server accepted a request but local persistence failed — which is exactly the case its dedicated
  test exercises.
- `syncError` is only ever set from the 4xx path, so a transient failure under retry renders no error banner,
  as the plan required. The e2e test asserts the user-visible consequence directly: the queued-changes text is
  shown while the server error text has count 0.
- Cancellation is handled thoroughly. `abortable` settles operations whose implementations ignore abort,
  `requestJson` bounds the body read as well as the headers and always cancels its deadline in `finally`, and
  the provider's cleanup aborts the active run and clears the retry timer. Many tests assert
  `vi.getTimerCount() === 0`, which is the right way to pin this down.
- `generationRef` guards the post-await continuations against StrictMode double-mount, and `mountedRef` stops
  state updates after unmount — both with tests.
- T-003 review finding 2 (the `timings` prop identity footgun) is incidentally resolved: the provider now
  extracts each timing as a primitive and memoizes `probeTimings` on those, so an inline `timings` object no
  longer re-registers listeners on every render.
- Documentation shipped with the change: the README offline section now covers the 10 s request timeout, the
  transient-vs-permanent split, capped retry backoff, the stall release, and the queue-retry e2e spec. Code
  comments explain the classification, the retry policy and the stall release, as the plan required.

##### Risks
- **At-least-once delivery after a stall.** When the stall deadline aborts a run, the request may already
  have been processed by the server; since the response never arrived, `accepted` was never populated and the
  replacement run resends it. This is inherent to aborting an in-flight write without server-side idempotency
  keys, and the plan's chosen guard (removal only after an accepted response) is honoured. For this app the
  visible consequence is a possible duplicate item after a 30 s stall.
- The drain now depends on the shared connectivity module for every trigger, so T-003's rate limiter and this
  task's retry timer jointly determine how quickly a queue recovers. Both are covered by tests, but they are
  two independent backoffs interacting.
- Real-device behaviour (iOS bfcache, background suspension, throttled timers) remains unproven by automation
  across all four tasks in this cycle; a device smoke test before release is still worthwhile.
- The full E2E suite is still blocked by the missing local PostgreSQL; only the fixture-based specs run here.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
