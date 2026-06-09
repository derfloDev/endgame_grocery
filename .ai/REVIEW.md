# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-06-09

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `backend/src/routes/lists.js:238` | When the list does not exist in DB, the code still executes the DELETE query unnecessarily (the `!list` early-exit only fires after the DELETE). A simple `if (!list) { res.status(404)...; return; }` after the SELECT would skip the extra round-trip. Functionally correct as-is. | No |

No blockers or majors found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` T-001 scope and acceptance criteria.
2. Inspected `git diff HEAD` for all three changed files.
3. Ran `node --test backend/src/lists.test.js` — 11/11 pass (3 new tests added for success, owner-403, non-member-404).
4. Ran `npm run lint` — 0 errors (1 pre-existing unrelated warning in `AuthContext.tsx`).
5. Ran `npm run build` — success.
6. Ran `npm test` (full suite) — 174/174 pass.
7. Verified `/:id/leave` is registered before `/:id` (lines 209 vs 273) — correct Express ordering.
8. Confirmed mailer `await` pattern is identical to the existing `sharing.js` `sendRevocationEmail` pattern — consistent with codebase convention.
9. Verified `member-left.hbs` uses `{{> base ...}}` partial — consistent with other templates.
10. Confirmed `mailer` is properly injected as a dependency with a default `createMailer({ config })` fallback.

##### Findings
- All acceptance criteria met: 204/403/404 responses, SSE broadcast, owner email notification, tests.
- Route ordering is safe — `/:id/leave` is registered before `/:id`.
- Mailer failure behaviour (500 after successful DB delete) is consistent with the existing `sharing.js` pattern and is an accepted project convention.

##### Risks
- Low. The nit about the unnecessary DELETE query when the list is absent has negligible performance impact in normal operation.

#### Verdict
`PASS`
