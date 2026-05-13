# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File | Description | Required Fix |
|---|----------|------|-------------|--------------|
| 1 | nit | `frontend/src/styles/shared.css:43` | `.eg-btn` added to the button base selector group — not present in original `index.css` and not listed in the plan. Harmless alias, but it's out of scope for T-001. | No |
| 2 | nit | `frontend/src/styles/tokens.css` (new file) | `tokens.css` was created to hold CSS custom properties extracted from `index.css`. This file is not mentioned in the plan (T-001 scope is `shared.css` + `auth.module.css` only). The extraction is beneficial and forward-compatible with T-005, but it is an unplanned addition. `index.css` now imports it first and the `:root` block was stripped of variable declarations. | No |

No blockers or major findings.

#### Verification

##### Steps
- Read `frontend/src/styles/shared.css`, `auth.module.css`, `tokens.css`, and `frontend/src/index.css`.
- Cross-checked all planned classes from `.ai/PLAN.md` CSS class inventory against `shared.css` and `auth.module.css`.
- Verified `index.css` contains `@import "./styles/tokens.css"`, `@import "./styles/shared.css"`, and `@import "./styles/auth.module.css"` at the top.
- Confirmed no TSX files were modified (scope check via git diff — clean).
- Ran `npm run lint` → 0 errors, 1 pre-existing warning (`AuthContext.tsx` Fast Refresh).
- Ran `npm run build` → clean build, pre-existing chunk size warning only.
- Ran `npm test` → 106/106 pass, 0 fail.

##### Findings
- All `eg-*` and shared utility classes from the plan are present in `shared.css`. ✓
- All `auth-*` classes (`.auth-layout`, `.auth-card`, `.auth-brand`, `.auth-logo`, `.auth-brand-title`, `.auth-brand-sub`, `.auth-form`, `.compact-form`) plus descendant rules (`.auth-card h1`, `.auth-card > p`) and the responsive `@media (max-width: 640px) .auth-card` block are present in `auth.module.css`. ✓
- `index.css` correctly imports both new files and the additional `tokens.css`. ✓
- No component TSX changes. ✓
- `shared.test.ts` added with per-class existence assertions covering all planned shared and auth classes.

##### Risks
- `auth.module.css` is both globally imported in `index.css` (plain CSS) and will later be consumed as a CSS Module by TSX pages (T-004). Vite will inject the file twice in production builds — once as global CSS and once as a scoped module chunk. This is expected to be resolved during T-004 (removing the `@import` from `index.css` once all auth pages use the module). No action needed in T-001.
- `tokens.css` is now imported before `shared.css` in `index.css`. If any later task adds a `tokens.css` with conflicting variable names, the load order is already established.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
