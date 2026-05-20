# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-05-20

#### Findings

| # | Severity | Location | Description | Required Fix |
|---|----------|----------|-------------|--------------|
| 1 | minor | `backend/src/routes/entries.js:206` | PATCH with a non-existent `entryId` and `status=done` triggers the eviction DELETE before the UPDATE returns 404, permanently removing a done entry on an invalid request. Plan acknowledges non-atomic design as acceptable for this use case. | No — accepted trade-off per plan |
| 2 | minor | `backend/src/entries.test.js` | No dedicated test explicitly named for AC2 ("POST at exactly 999 open entries → 201"); boundary is only covered implicitly via updated existing "creates an entry" tests that happen to return `cnt: "999"`. | No — implicitly covered |
| 3 | nit | `backend/src/routes/entries.js` | Concurrent POST requests could each see `count < 1000` and both insert, transiently exceeding the cap. Plan accepts this non-atomic behaviour. | No — accepted trade-off per plan |

#### Verification

##### Steps
1. Read `.ai/PLAN.md` — verified all acceptance criteria, implementation guidance, and test table.
2. Read `backend/src/routes/entries.js` — confirmed constants `MAX_OPEN_ENTRIES_PER_LIST = 1000` and `MAX_DONE_ENTRIES_PER_LIST = 200`, POST COUNT guard, PATCH evict-before-update logic, all matching the plan exactly.
3. Read `backend/src/entries.test.js` — confirmed 2 new dedicated tests (`rejects entry creation when the list already has 1000 open entries`, `evicts the oldest done entry before marking another entry done at the done-entry limit`) plus correct updates to all existing POST tests to account for the new COUNT query step.
4. Ran `node --test src/entries.test.js` (16 tests): **16 pass, 0 fail**.
5. Ran `npm run lint`: **0 errors**, 1 pre-existing frontend Fast Refresh warning (unchanged from baseline).
6. Ran `npm run build`: **pass**, pre-existing chunk size and eval warnings only.
7. Reviewed `git diff HEAD -- README.md`: confirmed a single sentence added documenting the 1 000 open-entry cap and 200 done-entry auto-eviction behaviour.

##### Findings
- All 6 acceptance criteria from the plan are satisfied:
  - AC1 ✅ POST at 1 001st open entry → 422, no INSERT (test `rejects entry creation…`, callCount = 2).
  - AC2 ✅ POST at 1 000th open entry → 201 (existing tests updated with `cnt: "999"`, INSERT proceeds).
  - AC3 ✅ PATCH→done at 200 done entries → oldest evicted then updated (test `evicts the oldest done entry…`).
  - AC4 ✅ PATCH→done at <200 done entries → no evict (test `writes autocomplete history when an entry is marked done`, callCount = 4).
  - AC5 ✅ PATCH non-status or status=open fields → no COUNT query called (existing icon/text-only tests with 2-query assertions).
  - AC6 ✅ All 16 existing + new tests pass.
- Documentation updated in `README.md` per AGENTS.md documentation rules.
- Named constants used instead of magic numbers.

##### Risks
- Low: The non-atomic evict+update could theoretically delete a done entry on a 404 PATCH. Acknowledged and accepted per plan.
- Low: Concurrent POSTs near the limit could briefly exceed 1 000 open entries. Accepted per plan.

#### Verdict
`PASS`
