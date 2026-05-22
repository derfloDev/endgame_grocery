# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-22

#### Findings

- **nit** — `InfoSheet.tsx` line 164: The Logout section uses `{t("settings.logOut")}` as the `info-sheet-section-label` text and the button text. The section label and button carry the same string ("Log out"), creating minor visual redundancy. Not a correctness issue; every section having a label satisfies AC #2.

#### Verification

##### Steps
1. Read all changed files against the plan: `InfoSheet.tsx`, `InfoSheet.module.css`, `InfoSheet.test.tsx`, `en/translation.json`, `de/translation.json`.
2. Ran `npm run lint` — clean (1 pre-existing Fast Refresh warning in `AuthContext.tsx`, 0 errors).
3. Ran `npm run build` — clean (1 pre-existing Vite chunk-size warning, 0 errors).
4. Ran `npm run test -w @endgame-grocery/frontend -- InfoSheet` — 13/13 pass.
5. Ran `npm run test -w @endgame-grocery/frontend` — 421/422 pass; 1 failure in `app.test.tsx > adds and edits entry details from the list detail sheet` (timeout after 20 000 ms).
6. Confirmed `app.test.tsx` failure is pre-existing by stashing implementation changes and re-running — same test fails on the baseline commit `75f7c22`.
7. Ran `npm test` (backend suite) — 164/164 pass.
8. Verified section order in JSX: Language (first, no top border) → Account → API Key → Logout → Meta (Version) → Meta (License) → Donate.
9. Verified clipboard try/catch in `handleCopyApiKey` (lines 83–89).
10. Verified new i18n keys: `settings.account` = "Account" / "Konto".
11. Verified CSS: `.info-sheet-section` has `border-top`; `.info-sheet-section--first` removes it; `.info-sheet-section-label` with `::before`/`::after` flex lines present.
12. Verified two new tests: `"renders the language switcher before the user identity block"` and `"keeps the copy action usable when clipboard write fails"`.

##### Findings
- All acceptance criteria satisfied.
- Pre-existing `app.test.tsx` timeout is unrelated to this change (confirmed on baseline).

##### Risks
- None introduced by this change.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-22

#### Findings

- **nit** — `InfoSheet.module.css` line 5–7: The plan specifies `padding-top: var(--space-4)` on `.info-sheet-section--footer`, but the implementation omits it because the base `.info-sheet-section` class already provides it via `padding: var(--space-4) 0 1rem`. The rendered result is identical. Not a correctness issue.

#### Verification

##### Steps
1. Read all changed files against the plan: `InfoSheet.tsx`, `InfoSheet.module.css`, `InfoSheet.test.tsx`.
2. Confirmed `border-top` removed from `.info-sheet-section` (line 1–3 in CSS) — no double divider.
3. Confirmed `.info-sheet-section--first` rule fully removed from CSS.
4. Confirmed `.info-sheet-section--footer` added with `border-top` only.
5. Confirmed `.info-sheet-meta` updated: no standalone `border-top`, added `padding-bottom: var(--space-2)`.
6. Confirmed Language section JSX (line 109) no longer carries `info-sheet-section--first` class.
7. Confirmed Logout section JSX (lines 163–168) contains only the danger button — no section-label div present.
8. Confirmed Version + License + Donate grouped inside one `info-sheet-section--footer` wrapper (lines 169–190).
9. New test `"renders logout text only on the logout button"` (lines 86–91) asserts `getAllByText("Log out")` returns exactly 1 element.
10. Ran `npm run lint` — clean (1 pre-existing Fast Refresh warning, 0 errors).
11. Ran `npm run build` — clean (pre-existing chunk-size warning, 0 errors).
12. Ran `npm run test -w @endgame-grocery/frontend -- InfoSheet` — 14/14 pass.
13. Ran `npm test` (full frontend + backend) — 423/423 frontend, 164/164 backend pass.

##### Findings
- All acceptance criteria satisfied.
- Full frontend suite passes (423/423); flaky `app.test.tsx` timeout did not recur this run.

##### Risks
- None introduced by this change.

#### Open Questions
- None.

#### Verdict
`PASS`
