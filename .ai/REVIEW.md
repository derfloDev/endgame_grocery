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
