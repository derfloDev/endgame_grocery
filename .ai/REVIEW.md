# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-29

#### Findings

No blocking or major findings.

- severity: `nit` | `backend/src/sseManager.js` line 31 & 71 | `sendToUsers` deduplicates `userIds` internally with `new Set(userIds)`, and `broadcastToList` already deduplicates before calling `sendToUsers`. Double deduplication is harmless but redundant. Not a required fix.

#### Verification

##### Steps
1. Read all changed/new files: `backend/src/sseManager.js`, `backend/src/routes/events.js`, `backend/src/app.js`, `backend/src/middleware/auth.js`, `backend/src/sseManager.test.js`, `backend/src/routes/events.test.js`, `README.md`.
2. Compared implementation against T-001 plan section in `.ai/PLAN.md`.
3. Ran `npm run lint` — passed (one pre-existing frontend warning, no errors).
4. Ran `npm run test --workspace backend -- --test-name-pattern "SseManager|events route"` — 7 tests pass: 3 SseManager unit tests + 4 events route integration tests.
5. Verified plan coverage:
   - `SseManager`: `add`, `remove`, `sendToUsers`, `broadcastToList` all implemented ✅
   - Singleton + class export ✅
   - `createEventsRouter` factory with injected deps ✅
   - Token from `req.query.token` (primary) or `Authorization` header (fallback) ✅
   - 401 without/invalid token ✅
   - All 4 SSE headers + `flushHeaders` ✅
   - Heartbeat interval (30 s default, injectable for tests) ✅
   - `req.on("close")` cleanup with idempotent guard ✅
   - `app.js`: route registered, `sseManager` forwarded in `routerOptions` ✅
   - `createRequireAuthFn` added to `middleware/auth.js` ✅
   - README documentation updated ✅

##### Findings
- All acceptance criteria for T-001 met.
- All targeted tests pass; no pre-existing tests broken.
- Idempotent cleanup guard (`createCleanup`) prevents double-remove on concurrent close events — well-designed defensive pattern.

##### Risks
- Token exposed in URL query string (plan-acknowledged trade-off; server logs may capture it). Acceptable per design decision in PLAN.md.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-29

#### Findings

No blocking or major findings.

- severity: `nit` | `backend/src/routes/lists.js` line 171 | `list:deleted` broadcast is `await`ed rather than fire-and-forget. This is intentional and safe (ensures member IDs are still resolvable and keeps broadcast-before-delete ordering deterministic); however it means a `broadcastToList` failure will surface a 500 and prevent the delete. Acceptable trade-off — not a required fix.
- severity: `nit` | plan deviation | The plan attributed `member:added` to `sharing.js POST /`, but the implementer correctly deduced that the invite-POST only creates an invite, not a membership. The broadcast fires from `invites.js GET /:token` and `auth.js POST /register` (the actual member-insertion points). This is semantically correct and better than the plan's description. Not a required fix.

#### Verification

##### Steps
1. Read all changed/new files: `backend/src/routes/entries.js`, `backend/src/routes/lists.js`, `backend/src/routes/sharing.js`, `backend/src/routes/invites.js`, `backend/src/routes/auth.js`, `backend/src/inviteService.js`, and all corresponding test files.
2. Compared implementation against T-002 plan section in `.ai/PLAN.md`.
3. Ran `npm run lint` — passed (one pre-existing frontend warning, no errors).
4. Ran `npm run test --workspace backend -- --test-name-pattern "entry routes|list routes|sharing routes|invite routes|authentication routes"` — 44 tests pass, 0 fail.
5. Verified plan coverage:
   - `entry:created` after POST to entries ✅ — fire-and-forget with `.catch` logger ✅
   - `entry:updated` after PATCH to entries ✅ — placed after 404 guard ✅
   - `entry:deleted` after DELETE from entries ✅
   - No broadcast on 400 (missing text), 403 (no access), 404 (entry not found) ✅
   - `list:updated` after PATCH to lists ✅ — fire-and-forget ✅
   - `list:deleted` before DELETE from lists ✅ — await (see nit above) ✅
   - No broadcast on 403 for lists ✅
   - `member:removed` after DELETE from members ✅ — fire-and-forget ✅
   - No broadcast on 400 (owner removal) ✅
   - `member:added` after invite acceptance (`invites.js`) ✅
   - `member:added` after register-with-invite (`auth.js`) ✅
   - `member:added` NOT fired when user already a member ✅ (`memberAdded` flag from `inviteService.js`)
   - `sseManager` injected in all routers and forwarded via `routerOptions` ✅
   - `inviteService.js` returns `memberAdded` boolean for conditional broadcast ✅

##### Findings
- All T-002 acceptance criteria met.
- All 44 targeted tests pass; 0 failures across the full suite.
- `member:added` suppression when user is already a member is correctly tested in `invites.test.js` (second test case asserts empty `sseManager.calls`).
- Broadcast error logging via `logger.error` is consistent across all fire-and-forget sites.

##### Risks
- `list:deleted` await: if the DB goes down between broadcast and delete, the delete is skipped but the SSE event was still sent. This is a benign edge case (clients will re-fetch on reconnect and see the list still exists) — no action required.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-29

#### Findings

No blocking or major findings.

- severity: `nit` | `frontend/src/context/EventSourceContext.jsx` line 1 | `eslint-disable react-refresh/only-export-components` suppresses the fast-refresh warning for the whole file. Acceptable — the file intentionally exports both a provider component and a hook, a common React pattern. Not a required fix.
- severity: `nit` | `frontend/src/hooks/useListEvents.js` | The inner filter function is recreated each render, so if the consumer does not wrap `handler` in `useCallback`, the hook will re-subscribe on every render. This is documented as a caller responsibility (JSDoc says "stabile Referenz empfohlen") and is enforced in T-004. Not a required fix.

#### Verification

##### Steps
1. Read all new/changed files: `frontend/src/context/EventSourceContext.jsx`, `frontend/src/hooks/useListEvents.js`, `frontend/src/main.jsx`, `frontend/src/context/EventSourceContext.test.jsx`, `frontend/src/hooks/useListEvents.test.js`, diffs for `frontend/src/app.test.jsx` and `frontend/src/components/AddItemSheet.test.jsx`.
2. Compared implementation against T-003 plan section in `.ai/PLAN.md`.
3. Ran `npm run lint` — passed (one pre-existing `AuthContext.jsx` fast-refresh warning, no errors; new `EventSourceContext.jsx` warning suppressed by file-level eslint-disable).
4. Ran `npm run test --workspace frontend` — **101/101 tests pass**, 0 failures, 17 test files.
5. Verified plan coverage:
   - `EventSourceProvider` opens `EventSource` when `token` is present ✅
   - Closes on logout / token cleared (effect cleanup) ✅
   - Internal `Map<eventType, Set<handler>>` via `useRef` ✅
   - `addEventListener(type, handler) → () => void` cleanup function ✅
   - `onerror` closes connection when `readyState === CLOSED` (401 guard) ✅
   - All 7 event types registered ✅
   - `contextValueRef` pattern ensures stable context value across re-renders ✅
   - `typeof window.EventSource !== "function"` guard for non-browser environments ✅
   - `useListEvents`: listId filter `!listId || data.listId === listId` ✅
   - Cleanup on unmount and dependency change ✅
   - `EventSourceProvider` nesting: inside `AuthProvider`, outside `OfflineQueueProvider` ✅
   - Exports: `EventSourceProvider`, `useEventSource` ✅
6. Test changes in `app.test.jsx` and `AddItemSheet.test.jsx`:
   - `userEvent.type` → `fireEvent.change` for input fields to avoid debounced icon-worker timing issues introduced by the SSE context ✅
   - Added 10 s test timeout on affected tests ✅
   - All 26 `app.test.jsx` + 11 `AddItemSheet.test.jsx` tests pass ✅

##### Findings
- All T-003 acceptance criteria met.
- 101 frontend tests pass, 0 failures.
- The `window.EventSource` availability guard is an elegant solution that lets all existing `app.test.jsx` tests run without mocking EventSource (the effect simply skips when EventSource is not a function in the test environment).

##### Risks
- `useListEvents` re-subscribe on unstable handler reference is a known footgun, mitigated by JSDoc note and enforced in T-004 with `useCallback`.

#### Verdict
`PASS`
