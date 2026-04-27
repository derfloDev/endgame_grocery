# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-002 — InfoSheet: Settings Button & Info Bottom Sheet

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings

- **nit** — `frontend/src/index.css` — `.info-sheet-meta` border uses a hardcoded `rgba(255, 255, 255, 0.08)` instead of a `var(--border)` token as planned. Correct deviation: `--border` is not defined anywhere in this project; the literal is safe for the dark theme. Not required to fix.
- **nit** — `frontend/src/components/InfoSheet.jsx` line 13-15 — `handleLogout` calls `onClose()` before `logout()` (plan specified the reverse). The inverted order is an improvement (closes the sheet before the auth state transition fires); no behaviour regression. Not required to fix.

#### Verification

##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to establish acceptance criteria.
2. Inspected `git diff HEAD` and `git status` to identify all staged and unstaged changes across: `InfoSheet.jsx`, `InfoSheet.test.jsx`, `OverviewPage.jsx`, `Icon.jsx`, `index.css`, `vite.config.js`, `vite-config.test.js`, `app.test.jsx`.
3. Verified `settings` gear SVG added to `Icon.jsx` matching the plan spec exactly.
4. Verified `vite.config.js` reads root `package.json` and defines `__APP_VERSION__` at build time.
5. Verified `InfoSheet.jsx` uses `getAppVersion()` helper that reads `globalThis.__APP_VERSION__` first (test env) then falls through to the build-time define, with `"0.0.0"` safe fallback.
6. Verified `BottomSheet` is re-exported from the `./ui` barrel (`frontend/src/components/ui/index.js` line 8).
7. Verified `OverviewPage.jsx` replaces the logout icon button with a `settings` icon button (`aria-label="Settings"`), adds `showInfo` state, and mounts `<InfoSheet>`.
8. Verified `app.test.jsx` integration test covers: Settings button click → dialog visible → version row → GPL link → logout flow.
9. Ran `npm run lint` → **0 errors** (1 pre-existing unrelated warning).
10. Ran `npm test` (backend) → **30/30 pass**.
11. Ran `npm run test --workspace frontend` → **50/50 pass** (9 test files, including all 4 InfoSheet unit tests).
12. Ran `npm run build` → **success**.

##### Findings
- All six acceptance criteria satisfied.
- 4 dedicated InfoSheet unit tests cover: open render, closed render, logout + close interaction, backdrop close without logout.
- 1 new vite-config test validates version injection.
- Integration test in `app.test.jsx` covers the full E2E flow through the new settings → info sheet → logout path.

##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-001 — Add GNU GPL v3 license

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-27

#### Findings
- No blockers. One pre-existing lint warning in `frontend/src/context/AuthContext.jsx` (line 77) unrelated to this task — `react-refresh/only-export-components` — not introduced by this change.

#### Verification
##### Steps
1. Read `.ai/PLAN.md` and `.ai/TASKS.md` to establish acceptance criteria.
2. Inspected `git diff HEAD` and `git diff --cached` to review all staged and unstaged changes: `LICENSE`, `package.json`, `README.md`, `backend/src/license.test.js`.
3. Verified `LICENSE` is 674 lines, starts with the canonical GPL v3 header, and contains the `END OF TERMS AND CONDITIONS` sentinel.
4. Verified `package.json` has `"license": "GPL-3.0-or-later"` inserted after `"version"`.
5. Verified `README.md` badge block includes the GPL v3 shield badge wrapped in an `<a href="./LICENSE">` link.
6. Verified `README.md` ends with `## License` section referencing GNU GPL v3.0 and linking to `./LICENSE`.
7. Ran `npm run test --workspace backend -- src/license.test.js` → **3/3 pass**.
8. Ran `npm run lint` → **0 errors** (1 pre-existing warning, unrelated).
9. Ran `npm run build` → **success**.
10. Ran `npm test` → **30/30 pass**.
##### Findings
- All acceptance criteria met. LICENSE text is the unmodified GPL v3 canonical text.
- Bonus: implementer added `backend/src/license.test.js` with three tests covering all three acceptance criteria — adds test coverage beyond the plan's minimum.
##### Risks
- None.

#### Open Questions
- None.

#### Verdict
`PASS`
