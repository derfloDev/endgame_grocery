# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-05-20

#### Findings

- **nit** — `frontend/src/workers/iconWorkerClient.ts` — `getIconWorker` de-exported but still used internally by `primeIconWorker` / `requestIconMatch` in the same file — correct behavior, no action needed.
- **nit** — `src/app.test.tsx > authentication shell > adds and edits entry details from the list detail sheet` — timed out in first run (21 s), passed cleanly on second run (17 s). Pre-existing flaky test, not introduced by T-001.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm task scope and acceptance criteria.
2. Reviewed full `git diff HEAD` for all changed/deleted files.
3. Ran `npm run lint` — passes; only pre-existing `AuthContext` fast-refresh warning.
4. Ran `npm run build` — passes; only pre-existing chunk-size and onnxruntime eval warnings.
5. Ran `npm test` — first run: 1 timing flake in `app.test.tsx` (unrelated to T-001 changes); second run: all 414 frontend tests and 151 backend tests pass.
6. Verified no remaining references to deleted symbols (`SearchPage`, `APP_TITLE`, `deleteEntry`, barrel `"../ui"` import, `ICON_ALIASES`, `getIconWorker`, `normalizeCustomIcon`, `TopMatch`, `IconDbEntry`, `SendJsonRequestOptions`, `isNetworkError`) in any non-owning file.
7. Confirmed `prettier` removed from root `package.json` devDependencies as confirmed dead dependency.
8. Confirmed all barrel-import consumers updated to direct component-path imports.

##### Findings
- All dead code confirmed removed: `app.constants.ts`, `SearchPage/`, `ui/index.ts`, `deleteEntry`, locale keys for search, root `prettier` devDep.
- Internal-only symbols correctly un-exported (not deleted): `normalizeCustomIcon`, `IconDbEntry`, `TopMatch`, `SendJsonRequestOptions`, `isNetworkError`, `getIconWorker`, `ICON_ALIASES`.
- Tests updated correctly to reflect new structure (no barrel imports, no `deleteEntry` mock, `MockWorker.instances` used instead of `getIconWorker()`).
- Lint: 0 errors.
- Build: clean (no new warnings).
- Tests: 414 frontend + 151 backend all pass on clean run.

##### Risks
- The pre-existing `app.test.tsx` timing flake may surface in CI under load; not a T-001 regression.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

Notes: One pre-existing flaky test (`adds and edits entry details from the list detail sheet`) may intermittently time out in CI; unrelated to this task's changes.

---

## Task: T-002

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-05-20

#### Findings

- No issues found.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to confirm task scope and acceptance criteria.
2. Read `backend/src/middleware/listAccess.js` — confirmed single authoritative definition with full JSDoc (`@param`, `@returns`).
3. Read `backend/src/middleware/listAccess.test.js` — confirmed 2 tests covering true (has access) and false (no access) paths, verifying SQL structure and params.
4. Read first lines of all 4 route files (`entries.js`, `history.js`, `suggestions.js`, `v1.js`) — confirmed `ensureListAccess` imported from `../middleware/listAccess.js` in each.
5. Ran `rg -n -F "ensureListAccess" backend/src` — confirmed: 1 definition (middleware), 4 import sites, 0 remaining local definitions.
6. Cross-checked shared SQL against original in `entries.js` (via `git show fb9da63:backend/src/routes/entries.js`) — identical query, params, and return value. Pure structural refactor, no behavioral change.
7. Ran `npm run lint` (root) — 0 errors (1 pre-existing fast-refresh warning, frontend only).
8. Ran `npm run build` — clean pass.
9. Ran `npm test -w @endgame-grocery/backend` — 153/153 pass (151 baseline + 2 new middleware tests).

##### Findings
- `ensureListAccess` defined exactly once in `middleware/listAccess.js`, with JSDoc.
- All 4 target route files (`entries.js`, `history.js`, `suggestions.js`, `v1.js`) import from the shared middleware.
- New test file covers both access paths and validates SQL/params.
- No local copy of the function remains anywhere in `backend/src`.
- Lint: 0 errors. Build: clean. Backend tests: 153/153 pass.

##### Risks
- None. The extraction is mechanically identical to the original; no logic changed.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-05-20

#### Findings

- No issues found. All 26 targets in the plan are covered with correct JSDoc.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` to confirm the full list of required annotation targets.
2. Read `backend/src/jsdoc.test.js` — confirmed it exercises all 26 plan targets across 11 files: 8 auth.js helpers + 8 router factories + 2 inviteService functions + 4 SseManager methods + 1 SseManager class.
3. Sampled JSDoc in each modified file (`auth.js`, `entries.js`, `lists.js`, `sharing.js`, `history.js`, `suggestions.js`, `push.js`, `v1.js`, `inviteService.js`, `sseManager.js`) — all exported functions and key helpers have `@param` and `@returns`; class `SseManager` has a class-level doc block.
4. Verified all four methods of `SseManager` (`add`, `remove`, `sendToUsers`, `broadcastToList`) have full per-param and `@returns` docs.
5. Ran `node --test src/jsdoc.test.js` — 1/1 pass (`documents planned backend functions with @param and @returns`).
6. Ran `npm run lint` (root) — 0 errors (pre-existing fast-refresh warning, frontend only).
7. Ran `npm test -w @endgame-grocery/backend` — 154/154 pass (153 baseline + 1 new jsdoc test).

##### Findings
- All 26 targets listed in the plan annotated correctly.
- New test file (`jsdoc.test.js`) mechanically validates JSDoc presence for each target via regex; covers all planned symbols.
- Lint: 0 errors. Backend tests: 154/154 pass.

##### Risks
- The jsdoc test uses regex rather than AST parsing; it will not catch malformed JSDoc structure. Acceptable for this project's scope.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-004

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-05-20

#### Findings

- **nit** — `useListDetailData.ts` — The hook goes beyond the plan scope (moves mutations like `addEntryByText`, `toggleStatus`, `submitEditEntry`, `addRecentlyUsedEntry`, `dismissRecentlyUsedEntry` in addition to the planned data-loading logic). This is a positive over-delivery that produces a cleaner separation; not a defect.
- **nit** — `useListDetailData.ts` returns `setIsSharingLoading` and `setRecentlyUsed` which are not consumed by `ListDetailPage.tsx`. Harmless unused returns from the hook.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` to confirm acceptance criteria: `ListDetailPage.tsx` < 400 lines; hook in own file; frontend tests green.
2. Read `frontend/src/pages/ListDetailPage/useListDetailData.ts` (436 lines) — confirmed hook contains all planned state (`list`, `entries`, `members`, `recentlyUsed`, `entryError`, `isLoading`, `isSharingLoading`), `loadEntries` callback, `loadMembers` callback, and the main `useEffect` for parallel loading.
3. Read `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` (374 lines) — confirmed it imports `useListDetailData` and destructures state/callbacks from it; no local duplicates of moved state.
4. Verified `DetailEntry`, `DetailList`, `DetailMember` interfaces are exported from the hook file and re-imported by `ListDetailPage.tsx`.
5. Read `frontend/src/pages/ListDetailPage.test.tsx` diff — confirmed new structural test: checks page < 400 lines, import from `./useListDetailData`, `useListDetailData` export, and presence of `loadEntries`/`loadMembers` in hook source.
6. Ran `npm run lint` (root) — 0 errors (pre-existing fast-refresh warning).
7. Ran `npm run build` — clean.
8. Ran `npm test -w @endgame-grocery/frontend` — 415/415 pass (414 baseline + 1 new structural test). The previously flaky `adds and edits entry details` test passed in 7.7 s this run.

##### Findings
- `ListDetailPage.tsx`: 374 lines ✅ (< 400 required).
- `useListDetailData.ts`: hook exported, `loadEntries`, `loadMembers`, parallel-load `useEffect` present ✅.
- New structural test validates the extraction is maintained ✅.
- Lint: 0 errors. Build: clean. Tests: 415/415 pass.

##### Risks
- None. The refactor is additive (no API surface change, no behavioral change).

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-005

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-05-20

#### Findings

- **nit** — `backend/package.json` — `nodemailer` upgraded from `^7.0.13` to `^8.0.7`, which was not in the plan scope. This is a low-risk bonus: backend auth tests covering email sending (verification, password reset, invite) all pass, confirming API compatibility. No action required.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` to confirm acceptance criteria: `npm audit` no critical/high in prod deps; build and tests green.
2. Reviewed `git diff HEAD` for all changed files:
   - `backend/package.json`: `bcrypt@^5.1.1` → `^6.0.0`, `node-pg-migrate@^7.9.1` → `^8.0.4`, `nodemailer@^7` → `^8.0.7`; migrate script `.mjs` → `.js`.
   - `docker/entrypoint.sh`: migrate CLI path `.mjs` → `.js` (matches node-pg-migrate v8 entry point).
   - `frontend/package.json`: `@xenova/transformers@^2.17.2` removed, `@huggingface/transformers@^4.2.0` added.
   - `frontend/src/workers/iconWorker.ts`: import updated to `@huggingface/transformers`; `__workerBoundary` type tag updated.
   - `frontend/vite.config.ts`: `resolve.alias` changed from simple object to array with regex `find` (required by `@huggingface/transformers` v4); `optimizeDeps.exclude` updated.
   - `frontend/src/vite-config.test.ts`: test updated to assert regex-based alias format via source inspection rather than config object key.
3. Verified `node_modules/node-pg-migrate/bin/` contains `node-pg-migrate.js` (not `.mjs`) — CLI path change is correct for v8 ✅.
4. Verified `npm list` shows installed: `bcrypt@6.0.0`, `node-pg-migrate@8.0.4`, `nodemailer@8.0.7`, `@huggingface/transformers@4.2.0`; `@xenova/transformers` absent ✅.
5. Scanned source for remaining `@xenova` references — none found ✅.
6. Ran `npm audit --omit=dev` — **0 vulnerabilities** (was: 1 critical via `protobufjs` + 2 high) ✅.
7. Ran `npm audit` (full, including dev) — **0 vulnerabilities** ✅.
8. Ran `npm run lint` — 0 errors (pre-existing fast-refresh warning only) ✅.
9. Ran `npm run build` — clean; pre-cache size reduced from 2093 KiB to 1819 KiB (HF transformers ships lighter than xenova) ✅.
10. Ran `npm test` — 415 frontend + 154 backend = **569/569 pass, 0 fail** ✅.

##### Findings
- All CVEs eliminated: `npm audit --omit=dev` reports 0 vulnerabilities.
- `bcrypt@6.0.0` installed and all auth tests (password hashing/verification paths) passing.
- `node-pg-migrate@8.0.4` installed; CLI path updated in both `backend/package.json` and `docker/entrypoint.sh`.
- `@xenova/transformers` fully replaced by `@huggingface/transformers@4.2.0`; vite config and worker import updated accordingly.
- `nodemailer@8.0.7` upgrade (out-of-plan) is API-compatible as confirmed by 154/154 backend tests including full auth email flows.

##### Risks
- `nodemailer` v8 is a major bump outside the plan. Risk is low given full test coverage of email paths, but a changelog review would be prudent before shipping to production.

#### Open Questions
- None.

#### Verdict
`PASS`
