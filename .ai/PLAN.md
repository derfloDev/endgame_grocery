# Plan

Status: **ready_for_implement**

Goal: make the PWA survive mobile lifecycle events as defined in `ROADMAP.md` — a backgrounded tab
reconnects and resynchronizes by itself, and queued offline writes reach the server without a manual
reload.

## Scope

Four tasks, one per roadmap priority, in dependency order:

| Task | Scope | Depends on |
| --- | --- | --- |
| T-001 | SSE reconnect manager with backoff, heartbeat watchdog, lifecycle-triggered reconnect | — |
| T-002 | Resync of the active view after reconnect / foreground return, pending entries preserved | T-001 |
| T-003 | Reachability-based connectivity state replacing bare `navigator.onLine` | T-001 |
| T-004 | Request timeouts and queue retry with backoff | T-003 |

Decisions locked in during roadmap refinement:
- Keep `EventSource`; no WebSocket migration, no polling fallback.
- Full resync on reconnect/foreground; no backend event IDs and no `Last-Event-ID` replay buffer.
- Reachability probe against the existing `GET /api/health` is the source of truth; `navigator.onLine`
  is only a hint.
- Retry with backoff plus request timeouts; no Background Sync API.

## Shared foundations

### Timing constants

New file `frontend/src/api/connectionTimings.ts` — every value a named export, all consumers import
from here, and both providers accept an optional `timings` prop that defaults to these values so tests
never depend on real wall-clock delays.

| Constant | Value | Reason |
| --- | --- | --- |
| `SSE_RECONNECT_BASE_DELAY_MS` | `1_000` | first retry is fast enough to be invisible |
| `SSE_RECONNECT_MAX_DELAY_MS` | `30_000` | bounds battery drain while backgrounded |
| `SSE_RECONNECT_JITTER_RATIO` | `0.3` | avoids synchronized reconnect storms after an outage |
| `SSE_HEARTBEAT_TIMEOUT_MS` | `45_000` | 1.5x the 30 s server heartbeat, tolerates one lost ping |
| `REQUEST_TIMEOUT_MS` | `10_000` | a mobile request past this is effectively offline |
| `REACHABILITY_PROBE_TIMEOUT_MS` | `5_000` | probe must answer faster than a normal request |
| `REACHABILITY_PROBE_MIN_INTERVAL_MS` | `5_000` | rate limit against wake-up trigger bursts |
| `RESYNC_DEDUPE_WINDOW_MS` | `2_000` | collapses reconnect + visibilitychange into one resync |
| `QUEUE_RETRY_BASE_DELAY_MS` | `1_000` | first drain retry right after a failed wake-up attempt |
| `QUEUE_RETRY_MAX_DELAY_MS` | `60_000` | upper bound for a long outage |
| `QUEUE_DRAIN_STALL_TIMEOUT_MS` | `30_000` | releases a drain guard that never resolved |

### Timeout signal helper

`AbortSignal.timeout` is not reliably present on the jsdom global used by Vitest, so requests use a
local helper instead: `createTimeoutSignal(ms)` in `frontend/src/api/connectionTimings.ts`, built from
`AbortController` + `setTimeout`, returning `{ signal, cancel }` so the timer is always cleared. It is
driven by fake timers in tests.

### Connectivity module

New file `frontend/src/api/connectivity.ts` — a provider-free singleton so the SSE layer and the
offline queue can share one connectivity truth without React coupling (`EventSourceProvider` wraps
`OfflineQueueProvider` in `frontend/src/main.tsx:24`, but the existing standalone provider tests must
keep rendering each provider in isolation):

- `reportStreamState("open" | "lost")` — called by the SSE reconnect manager.
- `reportRequestOutcome("ok" | "network-error")` — called by `sendJsonRequest` and the queue drain.
- `probeReachability()` — `fetch("/api/health", { cache: "no-store", signal })` with
  `REACHABILITY_PROBE_TIMEOUT_MS`; de-duplicates in-flight probes and returns the cached result inside
  `REACHABILITY_PROBE_MIN_INTERVAL_MS`.
- `ensureFreshState()` — probes only when the cached state is stale or unknown.
- `getIsOnline()` / `subscribe(listener)` — read and observe the derived state.
- `resetConnectivityForTests()` — clears cached state, in-flight probe and listeners.

Derivation rule: an open SSE stream means online without probing; a lost stream, a failed request or a
`navigator.onLine` transition marks the state stale and the next `ensureFreshState()` probes.
`navigator.onLine === false` alone never forces offline without a failed probe, because mobile browsers
report it wrongly in both directions.

## Task T-001 — SSE reconnect manager

Problem: `frontend/src/context/EventSourceContext.tsx:98` closes the stream for good once
`readyState === CLOSED`, with no path back except a token change or a page reload. There is also no
client-side liveness check, so a half-open mobile connection is never detected.

Backend prerequisite: the browser `EventSource` API surfaces no JS event for SSE comment lines, so the
current `:heartbeat\n\n` (`backend/src/routes/events.js:5`) is invisible to a client watchdog. The
heartbeat becomes a named event — `event: ping\ndata: {"ts":"<iso>"}\n\n` — which is additive and
backward compatible: existing clients register no `ping` listener and ignore it, and the frame keeps
the connection alive exactly like the comment did.

Implementation:
- `backend/src/routes/events.js`: emit the named `ping` heartbeat; keep the 30 s default and the
  `heartbeatIntervalMs` option unchanged.
- `frontend/src/context/EventSourceContext.tsx`: replace the single token effect with a reconnect
  manager holding refs for the active source, the reconnect timer, the watchdog timer and the attempt
  counter.
  - `connect()` opens the stream, registers the `EVENT_TYPES` listeners plus a `ping` listener, and
    arms the watchdog.
  - `onopen` resets the attempt counter to 0, reports `reportStreamState("open")` and re-arms the
    watchdog.
  - Any incoming event, `ping` included, re-arms the watchdog.
  - The watchdog firing after `SSE_HEARTBEAT_TIMEOUT_MS` with no traffic closes the stream, reports
    `reportStreamState("lost")` and schedules a reconnect.
  - `onerror` schedules a reconnect instead of giving up; a non-`CLOSED` state is left to the browser's
    own retry and only the watchdog escalates it.
  - Reconnect delay: `min(BASE * 2^attempt, MAX)` with `±JITTER_RATIO` jitter; the attempt counter
    increments per failed attempt.
  - `visibilitychange` to `visible` and the `online` event cancel the pending backoff timer and
    reconnect immediately when the stream is not healthy; when it is healthy they do nothing.
  - Teardown on unmount and on token removal closes the stream and clears both timers; nothing
    reconnects without a token.
- Context value gains `connectionState: "connecting" | "open" | "closed"` for T-002 and T-003. It must
  stay referentially stable for the existing `addEventListener` consumers, so the value is memoized and
  the state is exposed through a `useState` in the provider rather than a mutable ref.

Tests (written before the implementation):
- `frontend/src/context/EventSourceContext.test.tsx` — extend the existing `MockEventSource` with
  `onopen` and a `readyState` that can be driven, and add: no connection and no timer without a token;
  error schedules a reconnect with increasing, bounded delay; watchdog expiry reconnects without any
  error event; `ping` re-arms the watchdog so no reconnect happens; `visibilitychange` and `online`
  reconnect immediately when closed and are no-ops when open; unmount and token removal leave no open
  stream and no pending timer.
- `backend/src/routes/events.test.js` — assert the named `ping` frame instead of `:heartbeat\n\n`.

Files to change:
- `frontend/src/api/connectionTimings.ts` (new)
- `frontend/src/context/EventSourceContext.tsx`
- `frontend/src/context/EventSourceContext.test.tsx`
- `frontend/src/api/connectivity.ts` (new — only `reportStreamState` and the state container are needed
  here; the probe lands in T-003)
- `frontend/src/api/connectivity.test.ts` (new)
- `backend/src/routes/events.js`
- `backend/src/routes/events.test.js`
- `README.md:274` — one shared SSE connection now reconnects with backoff and a heartbeat watchdog
- `README.md` SSE/heartbeat mention around the API section — document the `ping` event
- Code comments on the reconnect manager and the watchdog stating the mobile-lifecycle reason for each
  timing constant

Acceptance criteria:
- No token means no connection and no scheduled timer.
- A closed or errored stream produces a new attempt with increasing delay, capped at
  `SSE_RECONNECT_MAX_DELAY_MS`.
- No traffic within `SSE_HEARTBEAT_TIMEOUT_MS` closes and reconnects the stream even without an `error`
  event.
- `visibilitychange` to `visible` and `online` reconnect immediately when unhealthy, no-op when
  healthy.
- Unmount and token removal leave no open stream and no pending timer.
- Backend emits the named `ping` heartbeat at the configured interval; unknown-event clients are
  unaffected.

## Task T-002 — Resync after reconnect and foreground return

Problem: events emitted while the stream was down are unrecoverable (`backend/src/sseManager.js:54`
writes no `id:` field) and nothing refetches on `visibilitychange`, so the view stays stale while
looking connected.

Implementation:
- `frontend/src/context/EventSourceContext.tsx`: add `resyncVersion: number` to the context value, plus
  an internal `requestResync()` that increments it at most once per `RESYNC_DEDUPE_WINDOW_MS`.
  - Triggered by a confirmed reconnect — an `onopen` that follows a previous loss, never the first
    connect, because pages already load on mount.
  - Triggered by `visibilitychange` to `visible` when the page was hidden and the stream is healthy.
  - The dedupe window makes a reconnect immediately followed by a foreground return one increment.
- `frontend/src/pages/OverviewPage/OverviewPage.tsx:84`: add `resyncVersion` to the `loadLists` effect
  dependencies, mirroring the existing `syncVersion` pattern.
- `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`: add an effect on `resyncVersion` that runs the
  light reload path — `loadEntries()`, then `reloadHistory(nextEntries)` and
  `loadMembers({ isOwner })` — deliberately **not** the full loader in
  `frontend/src/pages/ListDetailPage/useListDetailData.ts:375`, which sets `isLoading(true)` and clears
  `entries`/`members`/`recentlyUsed` and would flash an empty screen on every foreground return. Skip
  the first run so mount does not double-load.
- Pending-entry preservation: `loadEntries` currently replaces state with the server response, which
  drops optimistic `temp-*` entries that are still in the offline queue. Add
  `mergePendingEntries(serverEntries, currentEntries)` to
  `frontend/src/pages/ListDetailPage/listDetailUtils.ts`, keeping local entries flagged
  `is_pending_sync` whose id the server does not know yet, and use it in `loadEntries`. This also fixes
  the same loss on the existing SSE-refetch path.

Tests (written before the implementation):
- `frontend/src/context/EventSourceContext.test.tsx` — `resyncVersion` stays `0` on the first connect;
  increments once on a reconnect after a loss; increments on a hidden-to-visible transition;
  a reconnect plus a visibility change inside the dedupe window increments exactly once.
- `frontend/src/pages/ListDetailPage/listDetailUtils.test.ts` — `mergePendingEntries` keeps pending
  local entries, drops pending entries the server now returns, and preserves ordering.
- `frontend/src/pages/OverviewPage` and `ListDetailPage` tests — a `resyncVersion` bump refetches, and
  the detail page does not enter its full loading state while resyncing.

Files to change:
- `frontend/src/context/EventSourceContext.tsx`
- `frontend/src/context/EventSourceContext.test.tsx`
- `frontend/src/pages/OverviewPage/OverviewPage.tsx`
- `frontend/src/pages/ListDetailPage/ListDetailPage.tsx`
- `frontend/src/pages/ListDetailPage/useListDetailData.ts`
- `frontend/src/pages/ListDetailPage/listDetailUtils.ts`
- `frontend/src/pages/ListDetailPage/listDetailUtils.test.ts`
- page-level tests for overview and list detail (extend the existing files, or add them where the page
  has none)
- `README.md:273` — the overview/detail refetch description must cover reconnect and foreground resync
- Code comments on `requestResync` (why the first connect is excluded) and on `mergePendingEntries`

Acceptance criteria:
- A list changed by someone else while the page was backgrounded shows up after the page becomes
  visible again, with no manual reload.
- A reconnect immediately followed by a foreground return triggers exactly one resync.
- Entries still queued for sync stay visible with their pending state across a resync.
- A resync does not put the detail page into its full-screen loading state.

## Task T-003 — Reachability-based connectivity

Problem: `frontend/src/context/OfflineQueueContext.tsx:19`, `:133`, `:139` and `:149` trust
`navigator.onLine` alone. On mobile it stays `true` without usable connectivity and its `online` event
does not reliably fire after wake-up, so `drainQueue()` is never started.

Implementation:
- `frontend/src/api/connectivity.ts`: complete the module — `probeReachability`, `ensureFreshState`,
  `getIsOnline`, `subscribe`, rate limiting, in-flight de-duplication, `reportRequestOutcome`.
- `frontend/src/api/client.ts`: report `ok` / `network-error` outcomes from `sendJsonRequest` so a
  failed real request marks the state stale without an extra probe.
- `frontend/src/context/OfflineQueueContext.tsx`:
  - `isOffline` derives from `connectivity.getIsOnline()` via `subscribe`, not from `navigator.onLine`.
  - Lifecycle triggers `online`, `offline`, `visibilitychange`, `pageshow` and `focus` each call
    `ensureFreshState()` and drain when the resolved state is online. `pageshow` matters because iOS
    restores a backgrounded page from the back/forward cache without firing `visibilitychange`.
  - The `OFFLINE_QUEUE_CHANGED_EVENT` handler uses the same derived state.
- `frontend/src/components/OfflineBanner/OfflineBanner.tsx` keeps its current shape; only the meaning of
  `isOffline` changes. Verify the existing wording still fits and adjust the i18n strings in
  `frontend/src/locales/{en,de}/translation.json` only if it does not.

Tests (written before the implementation):
- `frontend/src/api/connectivity.test.ts` — probe success and failure map to online/offline; repeated
  `ensureFreshState()` calls inside `REACHABILITY_PROBE_MIN_INTERVAL_MS` issue one probe; concurrent
  calls share one in-flight probe; a probe exceeding `REACHABILITY_PROBE_TIMEOUT_MS` counts as offline;
  `reportStreamState("open")` marks online without a probe.
- `frontend/src/context/OfflineQueueContext.test.tsx` — `navigator.onLine === true` with a failing probe
  reports offline and keeps queueing; `navigator.onLine === false` with a succeeding probe reports
  online and drains; `pageshow` and `focus` trigger a drain; a burst of wake-up triggers produces one
  probe per rate-limit window.

Files to change:
- `frontend/src/api/connectivity.ts`
- `frontend/src/api/connectivity.test.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/client.test.ts`
- `frontend/src/context/OfflineQueueContext.tsx`
- `frontend/src/context/OfflineQueueContext.test.tsx`
- `frontend/src/components/OfflineBanner/OfflineBanner.test.tsx` (only if the derived state changes the
  rendered output)
- `frontend/src/locales/en/translation.json`, `frontend/src/locales/de/translation.json` (only if the
  banner wording must change)
- `README.md:282` — offline support now detects connectivity by reachability probe, not `navigator.onLine`
- Code comments on the derivation rule and on why `navigator.onLine === false` alone is not trusted

Acceptance criteria:
- `navigator.onLine === true` plus a failing probe reports offline and keeps queueing.
- `navigator.onLine === false` plus a succeeding probe reports online and drains the queue.
- Repeated wake-ups in quick succession issue at most one probe per `REACHABILITY_PROBE_MIN_INTERVAL_MS`.
- An open SSE stream reports online without issuing a probe.

## Task T-004 — Request timeouts and queue retry

Problem: a network error or 5xx during the drain sets `syncError` and stops with no retry
(`frontend/src/context/OfflineQueueContext.tsx:98`). A first attempt that fails right after wake-up,
before connectivity is back, leaves the queue untouched until the user happens to act. Neither the drain
`fetch` (`:58`) nor `sendJsonRequest` (`frontend/src/api/client.ts:54`) has a timeout, so a hung request
blocks the queue indefinitely through `isSyncingRef`.

Implementation:
- `frontend/src/api/client.ts`: attach `createTimeoutSignal(REQUEST_TIMEOUT_MS)` to every `fetch`, and
  always cancel the timer in a `finally`. Extend `isNetworkError` (`:32`) to classify an abort —
  `DOMException` with name `AbortError` or `TimeoutError` — as a network error, so a timed-out read falls
  back to cache and a timed-out write is queued instead of surfacing as a hard failure.
- `frontend/src/context/OfflineQueueContext.tsx`:
  - The drain `fetch` gets the same timeout signal.
  - Error classification: `4xx` is permanent and keeps today's behavior — set `syncError`, set
    `failedMutationId`, stop, offer discard. Network error, timeout and `5xx` are transient.
  - A transient failure schedules a retry after `min(QUEUE_RETRY_BASE_DELAY_MS * 2^attempt,
    QUEUE_RETRY_MAX_DELAY_MS)`; the attempt counter is per drain run and resets after a fully successful
    drain. The retry timer is cleared on unmount and cancelled when another trigger drains first.
  - `isSyncingRef` gains a `QUEUE_DRAIN_STALL_TIMEOUT_MS` release so a drain that never resolves cannot
    block later triggers; the released run must not double-apply its current mutation, so the guard
    release only allows a *new* run after the stalled request has been aborted.
  - Order and idempotency: mutations keep processing in `createdAt` order, a mutation is removed from
    IndexedDB only after its response was accepted, and the `temp-*` → real-id map is rebuilt from the
    remaining queue at the start of each run so a retry after a partial drain still resolves dependent
    mutations.
  - `syncError` is only surfaced to the user for permanent failures; a transient failure that is being
    retried must not render as a hard error banner.

Tests (written before the implementation):
- `frontend/src/api/client.test.ts` — a request exceeding `REQUEST_TIMEOUT_MS` falls back to the cached
  read; the same on a queueable write enqueues it; the timeout timer is cleared on a fast response.
- `frontend/src/context/OfflineQueueContext.test.tsx` — a `5xx` drain retries automatically with
  increasing delay under fake timers; a network error retries; a `4xx` does not retry and still offers
  discard; a drain interrupted mid-queue resumes with the remaining mutations in order and does not
  resend already-synced ones; a stalled drain releases the guard and a later trigger can drain; a
  transient failure under retry does not render the error banner.

Files to change:
- `frontend/src/api/client.ts`
- `frontend/src/api/client.test.ts`
- `frontend/src/api/connectionTimings.ts` (retry and stall constants, `createTimeoutSignal`)
- `frontend/src/context/OfflineQueueContext.tsx`
- `frontend/src/context/OfflineQueueContext.test.tsx`
- `frontend/src/components/OfflineBanner/OfflineBanner.tsx` (only if transient-vs-permanent changes what
  is rendered)
- `frontend/src/types.ts` (only if `OfflineQueueContextValue` needs a retry-state field for the banner)
- `README.md:282` — offline support now retries transient sync failures with backoff and times out
  requests
- Code comments on the error classification, the retry policy and the stall release

Acceptance criteria:
- A drain failing with a network error or `5xx` retries automatically with increasing delay and no user
  interaction.
- A `4xx` failure does not retry and still offers the discard action.
- A request exceeding the timeout is treated as offline: reads fall back to cache, writes are queued.
- A drain interrupted mid-queue resumes with the remaining mutations in their original order, and
  already-synced mutations are not resent.
- A stalled drain cannot block the queue past `QUEUE_DRAIN_STALL_TIMEOUT_MS`.

## Implementation Phases

### Phase 1 — T-001
Reconnect manager, heartbeat watchdog, named backend `ping`, connectivity state container.

### Phase 2 — T-002
`resyncVersion` with dedupe, page wiring on the light reload path, pending-entry merge.

### Phase 3 — T-003
Reachability probe, derived connectivity state, extended lifecycle triggers in the offline queue.

### Phase 4 — T-004
Request timeouts everywhere, transient-vs-permanent error classification, retry with backoff, stall
release.

## Constraints

- No WebSocket migration, no backend SSE replay buffer, no Background Sync API.
- Backend changes stay additive and backward compatible; the named `ping` heartbeat must not break a
  client that registers no `ping` listener.
- Every timing value is a named constant in `frontend/src/api/connectionTimings.ts` and injectable, so
  no test waits on real time. Tests use `vi.useFakeTimers()` and simulated `visibilitychange`,
  `pageshow`, `focus`, `online`, `offline`, `error` and timeout events. No `sleep`-based tests.
- Tests are written or updated before the implementation code for each changed behaviour.
- Documentation updates listed per task ship in the same commit as the behaviour change.
- Existing provider tests must keep rendering `EventSourceProvider` and `OfflineQueueProvider` in
  isolation; that is why connectivity is a plain module and not a third React context.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
- `npm run e2e` for T-002 and T-004 if a lifecycle scenario is expressible in Playwright; if it is not,
  state that in the handoff entry instead of adding a flaky test.

## Risks

- **StrictMode double-mount** (`frontend/src/main.tsx:15`) can create two connections or two timer sets
  if teardown is incomplete. Every timer and stream must be owned by the effect that created it and
  cleared in its cleanup.
- **Reconnect storms** after a server restart — mitigated by jitter and the delay cap; the attempt
  counter must only reset on a confirmed `onopen`, never on a scheduled attempt.
- **Resync thundering herd** — every client refetches on foreground return. Acceptable for this
  deployment size; the dedupe window keeps it to one request per view per wake-up.
- **Probe cost** — the probe is only issued on demand and rate-limited; no background interval.
- **Double-applied mutations** are the worst failure mode of the retry work. The removal-after-accepted
  ordering and the rebuilt id map are the guard, and the resume test is the required evidence.
