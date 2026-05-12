# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/tsconfig.json` | `"allowJs": true` was added but is not in the plan spec. It is a pragmatic necessity — without it `tsc --noEmit` would error on every remaining `.js` file during the staged migration. No code harm; keep it. | No |
| 2 | minor | `frontend/src/main.tsx` | `main.tsx` was migrated (and `main.jsx` deleted) as part of T-001 to satisfy the `index.html` entry-point change. The plan assigns this file to T-009. When T-009 is implemented, the executor must skip the `main.jsx → main.tsx` rename (already done) and focus on any remaining typing gaps. A note should be added to TASKS.md or surfaced at T-009 hand-off. | No (inform T-009 implementer) |

No blockers or major issues found.

#### Verification

##### Steps
1. Examined all changed files via `git diff HEAD`.
2. Confirmed old `.js` / `.jsx` files deleted: `frontend/vite.config.js`, `frontend/src/main.jsx`, `frontend/src/test/setup.js`.
3. Confirmed new files created: `frontend/tsconfig.json`, `frontend/src/vite-env.d.ts`, `frontend/vite.config.ts`, `frontend/src/test/setup.ts`, `frontend/src/main.tsx`.
4. Confirmed `frontend/src/vite-config.test.js` updated to reference `vite.config.ts` (line 7).
5. Confirmed `frontend/index.html` updated: `main.jsx` → `main.tsx`.
6. Confirmed ESLint config extended with `typescript-eslint` block covering `frontend/**/*.ts` and `frontend/**/*.tsx`.
7. Confirmed `typescript-eslint` added to root `package.json` devDependencies.
8. Confirmed `typescript`, `@types/react`, `@types/react-dom` added to `frontend/package.json` devDependencies.
9. Ran `npm run lint` → 1 pre-existing warning in `AuthContext.jsx` (unrelated to T-001), 0 errors. ✅
10. Ran `npx tsc --noEmit` from `frontend/` → clean, 0 errors. ✅
11. Ran `npm run build` → success (pre-existing chunk-size warning only). ✅
12. Ran `npm test` → 285 tests passed across 24 test files, 0 failures. ✅

##### Findings
- All acceptance-criteria commands pass with zero TypeScript errors.
- The lint warning (`AuthContext.jsx` fast-refresh) is pre-existing and unrelated to T-001.
- `main.tsx` uses the correct non-null assertion (`document.getElementById("root")!`) as specified in the T-009 plan.

##### Risks
- `"allowJs": true` means `.js` files are silently included in the TS compilation graph. As tasks T-002 through T-010 delete old `.js` files and replace them with `.ts`, this flag becomes unnecessary. It should be removed in the final cleanup or in T-010 once all `.js` source files are gone. Low risk for now.
- T-009 implementer must be aware that `main.tsx` and deletion of `main.jsx` are already done; double-migration attempt would be a no-op but could cause confusion.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/types.ts` | Plan specified decorative section headers (`// ── Grocery domain ─────...`); actual file uses plain `// Grocery domain` comments. Functionally identical; style preference only. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Read `frontend/src/types.ts` in full.
2. Cross-checked all 12 required interfaces against the plan spec (`T-002` in `.ai/PLAN.md`): `Entry`, `List`, `Member`, `User`, `AppConfig`, `QueueMeta`, `OfflineMutation`, `OfflineQueueContextValue`, `Suggestion`, `TopMatch`, `IconMatchResult`, `IconProps` — all present.
3. Verified each interface field name, type, and optionality against the plan — all match exactly.
4. Confirmed `grep -c "^export interface"` returns 12 — no extra or missing interfaces.
5. Confirmed file contains only type definitions — no runtime code introduced.
6. Ran `npm run lint` → 0 errors (1 pre-existing unrelated warning). ✅
7. Ran `npx tsc --noEmit` from `frontend/` → clean, 0 errors. ✅
8. Ran `npm run build` → success. ✅
9. Ran `npm test` → 285 tests passed, 0 failures. ✅

##### Findings
- All acceptance-criteria commands pass with zero TypeScript errors.
- `types.ts` is a pure type-declaration file; no functional changes introduced.

##### Risks
- None. The file adds only type exports; no tree-shaking or runtime impact.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/vite-env.d.ts` | Two reference directives added (`vite-plugin-pwa/client`, `vite-plugin-svgr/client`) beyond T-001's original file. Not in T-003 plan scope, but required for `tsc --noEmit` to resolve `.svg?react` imports in `customIcons.ts`. Correct and necessary. | No |
| 2 | nit | `frontend/src/data/customIcons.ts` L65–86 | Uses `CustomIconProps = IconProps & { color?: string }` rather than the plan's `React.FC<IconProps>`. Strictly more accurate — custom icons genuinely accept a `color` prop — so this is an improvement, not a deviation. | No |
| 3 | nit | `frontend/src/data/iconRegistry.ts` L216–231 | `fromLucide` returns `FC<RegistryIconProps>` (same `color` extension pattern) rather than the plan's `React.FC<IconProps>`. Same rationale as finding 2. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 7 old `.js` files deleted: `app.constants.js`, `i18n.js`, `utils/cosineSimilarity.js`, `data/iconDatabase.js`, `data/customIcons.js`, `data/iconRegistry.js`, `sw/register.js`.
2. Confirmed all 7 new `.ts` files created with correct content.
3. Verified `app.constants.ts`: `APP_TITLE: string` exported. ✅
4. Verified `i18n.ts`: typed `language: string` callback params; `default i18next` exported. ✅
5. Verified `cosineSimilarity.ts`: `vecA: number[], vecB: number[]): number`. ✅
6. Verified `iconDatabase.ts`: `IconDbEntry` interface and `ICON_DB: readonly IconDbEntry[]`. ✅
7. Verified `customIcons.ts`: imports `IconProps` from `../types`; `normalizeCustomIcon` returns `FC<CustomIconProps>` (superset of plan's `FC<IconProps>`). ✅
8. Verified `iconRegistry.ts`: `ICON_REGISTRY: Readonly<Record<string, ComponentType<IconProps>>>` (plan-aligned); `fromLucide` uses `LucideIcon` type from lucide-react. ✅
9. Verified `sw/register.ts`: `registerServiceWorker(): void`. ✅
10. Confirmed `vite-env.d.ts` additions are required for SVGR/PWA type resolution.
11. Ran `npm run lint` → 0 errors (1 pre-existing unrelated warning). ✅
12. Ran `npx tsc --noEmit` from `frontend/` → clean, 0 errors. ✅
13. Ran `npm run build` → success. ✅
14. Ran `npm test` → 285 tests passed, 0 failures. ✅

##### Findings
- All acceptance-criteria commands pass with zero TypeScript errors.
- No functional logic changes — pure type annotation and file rename.
- `vite-env.d.ts` amendment is a correct, minimal fix for SVGR type resolution.

##### Risks
- None. All changes are type-only; runtime behaviour is unchanged.

#### Open Questions
- None.

#### Verdict
`PASS`
