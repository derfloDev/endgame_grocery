# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-22

#### Findings
- No issues found. Implementation matches the plan exactly.

#### Verification
##### Steps
1. Read `frontend/vite.config.js` — confirmed `server.proxy` block is present and forwards `/api` to `http://localhost:4000`.
2. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unchanged from before this task).
3. Ran `npm run build` — success, all 54 modules transformed, PWA assets generated.
4. Ran `npm test` — 9 frontend tests passed, 23 backend tests passed (including `registers a user and returns 201`).

##### Findings
- All validation commands pass with no regressions.

##### Risks
- None. The change is a one-block Vite config addition with no logic impact on production builds.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-22

#### Findings
- No issues found. README content is accurate, complete, and matches the plan scope exactly.

#### Verification
##### Steps
1. Read `README.md` at project root — confirmed all plan-specified sections are present:
   - Prerequisites (Node.js 22.x, npm 10.x, Docker) ✅
   - Environment setup (`cp .env.example .env`, JWT_SECRET production note) ✅
   - Database (`docker compose up -d`, `npm run migrate`) ✅
   - Optional seed data (`npm run db:seed`) ✅
   - Development (`npm run dev`, both servers documented) ✅
   - Validation (`npm run lint`, `npm run build`, `npm test`) ✅
   - Available scripts table (all 6 root scripts listed) ✅
2. Confirmed `.env.example` exists at project root with `DATABASE_URL`, `JWT_SECRET`, and `PORT` — the `cp` step in the README is actionable.
3. Verified all 6 scripts in the README table (`dev`, `build`, `lint`, `test`, `migrate`, `db:seed`) are defined in root `package.json`.
4. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (no new issues).
5. Ran `npm run build` — success, 54 modules transformed.

##### Findings
- All validations pass. All plan scope items covered. No inaccuracies in the README.

##### Risks
- None. Only documentation was added; no source files were modified.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **ready_to_commit**

Reviewed: 2026-04-22

#### Findings

1. **nit** — `backend/src/db/migrations/1713895200000_create_core_tables.cjs` + `backend/src/db/migrations.test.js`: Migration file renamed from `.js` to `.cjs` and test updated accordingly. This is out of explicit plan scope (plan listed only `backend/package.json` and `README.md`), but is a necessary supporting change — without it, `node-pg-migrate` running under an ESM package (`"type": "module"`) would try to load `.js` migrations as ESM, breaking the `module.exports`-style exports. The change is correct and required for the fix to work end-to-end.

#### Verification
##### Steps
1. Read `backend/package.json` — confirmed migrate script is `node --env-file=../.env ../node_modules/node-pg-migrate/bin/node-pg-migrate.mjs up --migrations-dir src/db/migrations`. Uses correct `../` prefix to reach root `node_modules` from the `backend/` working directory. ✅
2. ESM binary path `../node_modules/node-pg-migrate/bin/node-pg-migrate.mjs` bypasses the Windows CMD wrapper. ✅
3. Read `README.md` step 4 — now reads "This command loads environment variables from the project-root `.env` file automatically…" — no manual export instruction present. ✅
4. Read `backend/src/db/migrations/1713895200000_create_core_tables.cjs` — valid CommonJS (`module.exports = { shorthands, up, down }`), exports `up` and `down` functions. ✅
5. Read `backend/src/db/migrations.test.js` — uses `pathToFileURL` to dynamically import the `.cjs` file; asserts both `up` and `down` are functions. ✅
6. Ran `npm run lint` — 0 errors, 1 pre-existing warning. ✅
7. Ran `npm run build` — success. ✅
8. Ran `npm test` — 9 frontend + 23 backend tests pass, including `exports up and down migration functions`. ✅

##### Findings
- All checks pass. The `.cjs` migration conversion is out of literal plan scope but is the correct supporting change for the fix to work end-to-end.

##### Risks
- Low. The `--env-file` flag requires Node ≥ 20.6.0; project targets Node 22.x per README, which satisfies this requirement.

#### Open Questions
- None.

#### Verdict
`PASS`
