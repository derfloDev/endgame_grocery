# ROADMAP

Goal: make the PWA survive mobile lifecycle events so a backgrounded tab reconnects and resynchronizes
by itself, and queued offline writes reach the server reliably without a manual reload.

Reported symptoms (mobile only, desktop unaffected):
- After the page sits in the background for a while, reopening it shows no live connection anymore and
  only a manual reload restores it, even though the device stayed online the whole time.
- Syncing writes created while offline does not always succeed.

## Priority 1

Objective: the shared SSE connection recovers on its own from every transient loss.

Decision: keep `EventSource` and add a reconnect manager (no WebSocket migration, no polling fallback).

- `EventSourceContext` no longer terminates permanently. Today `onerror` calls `cleanup()` once
  `readyState === CLOSED`, which closes the stream and leaves no path back except a token change or a
  full page reload (`frontend/src/context/EventSourceContext.tsx:98`).
- Reconnect uses exponential backoff with an upper bound and jitter, and resets the delay after a
  connection is confirmed healthy.
- A client-side heartbeat watchdog treats a stream with no traffic for a configured window as dead,
  discards it and reconnects. The backend already emits `:heartbeat` every 30 s
  (`backend/src/routes/events.js:47`) but nothing consumes it, so silently half-open mobile
  connections stay undetected.
- Returning to the foreground (`visibilitychange`) and regaining connectivity (`online`) each trigger
  an immediate reconnect attempt instead of waiting for the backoff timer.
- Logout and unmount still close the stream and cancel all pending timers; no reconnect loop may
  outlive the provider or run without a token.

Acceptance criteria:
- With no token, no connection and no timers are created.
- A closed or errored stream leads to a new connection attempt with increasing delay, bounded by the
  configured maximum.
- No traffic within the watchdog window closes the stream and reconnects, even when no `error` event
  was fired.
- `visibilitychange` to `visible` and the `online` event each reconnect immediately when the stream is
  not healthy, and do nothing when it is.
- Unmount and token removal leave no open stream and no scheduled timer.

## Priority 2

Objective: no stale data after the app returns to the foreground.

Decision: full resync of the active view after reconnect or foreground return. No backend event IDs and
no `Last-Event-ID` replay buffer in this cycle.

- Events emitted while the connection was down are unrecoverable today: `sseManager` writes no `id:`
  field (`backend/src/sseManager.js:54`) and nothing refetches list data on `visibilitychange`.
- A confirmed reconnect and a foreground return both trigger a reload of the data behind the current
  view (overview lists, or the active list's entries, members and recently used history).
- Resync is deduplicated so a reconnect plus a visibility change does not fire two parallel reloads,
  and in-flight optimistic or pending-sync state is not clobbered.

Acceptance criteria:
- A list changed by another user while the page was backgrounded is visible after the page becomes
  visible again, without a manual reload.
- A reconnect immediately followed by a foreground return triggers one resync, not two.
- Entries still queued for sync stay visible and keep their pending state across a resync.

## Priority 3

Objective: the online/offline state reflects real reachability.

Decision: reachability probe is the source of truth; `navigator.onLine` is only a hint.

- `navigator.onLine` is currently the only signal (`frontend/src/context/OfflineQueueContext.tsx:19`,
  `:133`, `:139`, `:149`). On mobile it stays `true` without usable connectivity and its `online` event
  does not reliably fire after wake-up, so `drainQueue()` is never started.
- Connectivity is derived from the SSE connection state plus a probe against the existing
  `GET /api/health` endpoint (`backend/src/app.js:63`) with a request timeout.
- The probe is only issued when a decision is actually needed (wake-up, `online` hint, failed request),
  never on a fixed background interval, and it is rate-limited.
- The offline banner and the queue drain trigger both read this derived state.

Acceptance criteria:
- With `navigator.onLine === true` but a failing probe, the app reports offline and keeps queueing.
- With `navigator.onLine === false` but a succeeding probe, the app reports online and drains the queue.
- Repeated wake-ups in quick succession do not produce more than one probe per rate-limit window.

## Priority 4

Objective: queued writes drain reliably instead of stalling until the next user interaction.

Decision: retry with backoff plus request timeouts. No Background Sync API in this cycle (unsupported
on iOS, and it would add a second code path for part of the users).

- A network error or 5xx during the drain currently sets `syncError` and stops with no retry
  (`frontend/src/context/OfflineQueueContext.tsx:98`). A first attempt that fails right after wake-up,
  before connectivity is back, leaves the queue untouched.
- Transient failures (network error, timeout, 5xx) are retried with exponential backoff; permanent
  failures (4xx) keep the existing behavior of surfacing the error with a discard action.
- Every request carries a timeout: the drain `fetch` (`OfflineQueueContext.tsx:58`) and
  `sendJsonRequest` (`frontend/src/api/client.ts:54`). A timed-out write must fall into the offline
  queue path rather than hang.
- The `isSyncing` guard can no longer block the queue indefinitely; a stuck drain is released so later
  triggers can run.
- Queue order and the temporary-ID remapping between dependent mutations stay intact across retries,
  and a mutation is never applied twice.

Acceptance criteria:
- A drain that fails with a network error or 5xx retries automatically with increasing delay, without
  further user interaction.
- A 4xx failure does not retry and still offers the discard action.
- A request that exceeds the timeout is treated as offline: reads fall back to cache, writes are
  queued.
- A drain interrupted mid-queue resumes with the remaining mutations in their original order, and
  already-synced mutations are not resent.

## Constraints

- No WebSocket migration, no backend SSE replay buffer, no Background Sync API in this cycle.
- Backend changes stay additive and backward compatible; existing SSE clients keep working.
- All timing values (backoff bounds, watchdog window, request timeouts, probe rate limit) are named
  constants, injectable in tests, so no test depends on real wall-clock delays.
- Tests must cover the lifecycle paths with fake timers and simulated `visibilitychange`, `online`,
  `offline`, error and timeout events. No `sleep`-based tests.
- Validation: `npm run lint`, `npm run build`, `npm test`. E2E (`npm run e2e`) where a lifecycle
  scenario is expressible in Playwright.

## Documentation scope

Behavior, interfaces and configuration change, so documentation updates are part of implementation
scope, not a follow-up:

- `README.md:273` — the overview/detail SSE refetch description must cover reconnect and
  foreground resync.
- `README.md:274` — the "one shared SSE connection while a JWT is present" description must cover
  reconnect, backoff and the heartbeat watchdog.
- `README.md:282` — the offline support description must cover reachability-based detection, retry with
  backoff, and request timeouts.
- Code comments on the reconnect manager, the watchdog, the reachability probe and the retry policy,
  explaining the mobile lifecycle reason for each timing constant.

## Out of scope

- Redesigning the offline data model or conflict resolution beyond the existing last-write-wins.
- Push notification behavior and the service worker update flow.
- Any change to the icon suggestion worker or list/entry feature scope.
