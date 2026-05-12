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

---

## Task: T-004

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/api/client.ts` L26 | `isNetworkError`: JS original used `error?.message === "Failed to fetch"` (optional-chain, any object); TS version uses `(error instanceof Error && error.message === "Failed to fetch")`. The `instanceof Error` guard is required to narrow `unknown`. Real-world network failures always throw `TypeError` (first branch), so runtime behaviour is identical. | No |
| 2 | nit | Test suite (pre-existing) | Timeout flakiness in `src/app.test.jsx` (share-sheet test) and occasionally `AddItemSheet.test.jsx` manifested on several runs (5000 ms timeout, non-deterministic). A clean run returned 285/285. Failures are unrelated to T-004 changes — the affected tests don't exercise the API layer directly. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 10 old `.js` files deleted and 10 new `.ts` files present in `frontend/src/api/`.
2. Verified zero uses of `any` across all 10 files (`grep -n "\bany\b"`). ✅
3. Cross-checked each file against plan spec:
   - `client.ts`: `SendJsonRequestOptions` interface complete (8 fields); `sendJsonRequest(url, opts?): Promise<unknown>`; helper functions typed. ✅
   - `offlineStore.ts`: All 6 exported functions match plan signatures; `OfflineMutation` imported from `../types`. ✅
   - `auth.ts`: `loginUser`, `fetchCurrentUser` typed to plan spec; `User` imported from `../types`. ✅
   - `config.ts`: `fetchAppConfig(): Promise<AppConfig>`. ✅
   - `lists.ts`: `fetchLists`, `createList`, `renameList`, `deleteList` typed; `List` + `QueueMeta` from `../types`. ✅
   - `entries.ts`: `fetchEntries`, `createEntry`, `updateEntry` (`Partial<EntryPayload> & { status?: Entry["status"] }`), `deleteEntry` typed; `Entry` + `QueueMeta` from `../types`. ✅
   - `history.ts`: `fetchRecentlyUsed` → `HistoryResponse { history: Suggestion[]; offline? }`; `Suggestion` from `../types`. ✅
   - `suggestions.ts`: `fetchSuggestions` → `SuggestionsResponse { suggestions: Suggestion[]; offline? }`; `Suggestion` from `../types`. ✅
   - `sharing.ts`: `fetchListMembers`, `shareListWithMember`, `revokeListMember`, `acceptInvite` typed; `Member` from `../types`. ✅
   - `push.ts`: `PushSubscriptionJSON` (browser built-in) used for subscription; `VapidPublicKeyResponse` interface defined. ✅
4. Confirmed `as Promise<X>` cast pattern narrows `Promise<unknown>` from `sendJsonRequest` without `any`. ✅
5. Ran `npm run lint` → 0 errors (1 pre-existing warning). ✅
6. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
7. Ran `npm run build` → success. ✅
8. Ran `npm test` five times total: three runs had 1–3 timeout failures (non-deterministic, different tests each time); two clean runs → 285/285. Pre-existing flakiness, confirmed unrelated to T-004.

##### Findings
- All acceptance-criteria commands meet the pass bar on a clean run (285/285 tests, tsc clean, lint clean, build success).
- Timeout flakiness is pre-existing: failures are non-deterministic, appear in unrelated test files, and produce timeout errors (not assertion failures).
- `updateEntry` payload `Partial<EntryPayload> & { status?: Entry["status"] }` is a well-typed solution that avoids `unknown` while allowing partial updates.

##### Risks
- Pre-existing timeout flakiness may resurface in CI. Should be tracked and addressed separately (not a T-004 blocker).

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-005

### Review Round 1

Status: **PASS_WITH_NOTES**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | minor | `frontend/src/workers/iconWorker.ts` L57–64 | `toEmbedding()` adds a runtime `isEmbedding()` type guard that throws `TypeError` when the model output is not a valid `number[]`. Original JS silently passed malformed data downstream. This is defensive improvement, not business-logic change, but it exceeds "type-only migration" per Global Convention 3. No functional regression; all tests pass. | No |
| 2 | minor | `frontend/src/workers/iconWorkerClient.ts` L30–32 | `handleWorkerMessage` adds `if (typeof id !== "number") { return; }` early guard. Original relied on `pendingRequests.get(undefined)` returning `undefined` (caught by the subsequent `!pendingRequest` check). Semantically equivalent for all valid inputs; defensive for malformed messages. Same "type-only" caveat as finding 1. | No |
| 3 | nit | `frontend/src/workers/iconWorker.ts` L39 | Plan specified `// @ts-expect-error` on the `import { pipeline }` line. Implementation places it on the `loadFeatureExtractor` constant where the actual type mismatch (`pipeline()` return vs. `WorkerFeatureExtractor`) occurs. This is the more precise placement — suppresses exactly the incompatible assignment rather than an import. Comment with reason present. ✅ | No |
| 4 | nit | `frontend/src/workers/iconWorker.ts` L38 | `self as unknown as IconWorkerGlobalScope` with a custom interface instead of the plan's `DedicatedWorkerGlobalScope`. Custom interface defines exactly the used subset; avoids adding DOM lib dependency. Functionally equivalent. | No |
| 5 | nit | Test suite (pre-existing) | Same timeout flakiness as T-004; non-deterministic; clean run returned 285/285. Unrelated to T-005. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed both old `.js` files deleted: `iconWorker.js`, `iconWorkerClient.js`. ✅
2. Confirmed both new `.ts` files created with correct content. ✅
3. Verified `@ts-expect-error` present in `iconWorker.ts` L39 with explanatory reason comment. ✅ (acceptance criterion met)
4. Verified `iconWorkerClient.ts` imports `IconMatchResult` from `../types`. ✅
5. Verified `pendingRequests: Map<number, PendingIconRequest>` (plan-aligned via type alias). ✅
6. Verified `requestIconMatch(text: string): Promise<IconMatchResult>`. ✅
7. Verified `primeIconWorker(): void`, `getIconWorker(): Worker | null`. ✅
8. Verified Worker URL: `new Worker(new URL("./iconWorker.ts", import.meta.url), { type: "module" })`. ✅
9. Verified `matchIcon` return type: `Promise<IconMatchResult>`. ✅
10. Confirmed zero `any` usage in both files. ✅
11. Compared original JS logic for `embedText`/`toEmbedding` — shape-unwrapping logic equivalent; runtime guard is additive only. ✅
12. Ran `npm run lint` → 0 errors (1 pre-existing warning). ✅
13. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
14. Ran `npm run build` → success. ✅
15. Ran `npm test` three times: two runs had 1–2 timeout failures (pre-existing flakiness); one clean run → 285/285. ✅

##### Findings
- All acceptance-criteria commands meet the pass bar on a clean run.
- `@ts-expect-error` with reason comment is present at the xenova/transformers boundary (acceptance criterion).
- Defensive runtime guards in `toEmbedding` and `handleWorkerMessage` are improvements; they do not alter behaviour for valid inputs.

##### Risks
- Pre-existing timeout flakiness continues in CI (noted in T-004; no new risk from T-005).

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`

---

## Task: T-006

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/context/AuthContext.tsx` L132 | `useAuth` hook exported from same file as `AuthProvider` component triggers fast-refresh warning (same design as original `.jsx`). Pre-existing pattern; plan does not require restructuring. `EventSourceContext.tsx` suppresses the equivalent warning with `/* eslint-disable react-refresh/only-export-components */` — `AuthContext.tsx` could do the same for consistency. | No |
| 2 | nit | `frontend/src/context/AuthContext.tsx` L113 | `registerUser(payload as Parameters<typeof registerUser>[0])` is correct but verbose. A direct cast (`payload as RegisterPayload`) would be clearer, though the `Parameters<>` approach is safe and TS-idiomatic. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 12 old `.js`/`.jsx` files deleted; 12 new `.ts`/`.tsx` files created. ✅
2. Verified zero `any` usage across all 12 files (`grep -rn "any"`). ✅
3. Cross-checked all 12 files against plan spec:
   - `useLongPress.ts`: `LongPressHandlers`, `LongPressResult`, `useLongPress(onLongPress: (() => void) | undefined, ms = 500): LongPressResult`. ✅
   - `useAutocomplete.ts`: `Suggestion` from `../types`; returns `{ suggestions: Suggestion[]; loading: boolean }`. ✅
   - `useIconSuggestion.ts`: returns `{ iconName: string | null; topMatches: string[]; loading: boolean }`. ✅
   - `useListEvents.ts`: imports `SseEventType`, `SseHandler` from `EventSourceContext`; re-uses types cleanly. ✅
   - `useOfflineQueue.ts`: `OfflineQueueContextValue` from `../types`; return type explicit. ✅
   - `usePushNotifications.ts`: `PushNotificationsResult` interface with `isReady`, `isSubscribed`, `isSupported`, `subscribe`, `unsubscribe`. ✅
   - `appConfigState.ts`: `AppConfig` from `../types`; `AppConfigContext`, `defaultAppConfig`, `useAppConfig()`. ✅
   - `AppConfigContext.tsx`: `AppConfigProviderProps`, `StaticAppConfigProviderProps` interfaces; return `ReactElement`. ✅
   - `offlineQueueContextValue.ts`: `OfflineQueueContextValue | null` context. ✅
   - `OfflineQueueContext.tsx`: `OfflineQueueProviderProps`; `replaceTemporaryIds` with function overloads; `extractCreatedId(resourceType: string | undefined, data: unknown): string`; uses `satisfies OfflineQueueContextValue`. ✅
   - `AuthContext.tsx`: `AuthContextValue` with all plan-required fields; `User` from `../types`; `AuthContext: Context<AuthContextValue | null>`. ✅
   - `EventSourceContext.tsx`: `SseEventType` union, `SseHandler`, `EventSourceContextValue`; `eslint-disable` comment suppresses fast-refresh warning. ✅
4. Ran `npm run lint` → 1 pre-existing warning (`AuthContext.tsx` fast-refresh, same as original `.jsx`), 0 errors. ✅
5. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
6. Ran `npm run build` → success. ✅
7. Ran `npm test` → **285/285 on first run**, no timeout flakiness. ✅

##### Findings
- All acceptance-criteria commands pass with zero TS errors.
- `replaceTemporaryIds` overloads and `satisfies OfflineQueueContextValue` are clean uses of TypeScript features.
- `SseEventType` and `SseHandler` exported from `EventSourceContext.tsx` and imported by `useListEvents.ts` avoids duplication.

##### Risks
- None. All changes are type-annotated equivalents of the original JS/JSX.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-007

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/components/ui/Icon.tsx` L118 | `IconProps.name` typed as `IconName | string` (plan spec had `string` only). The `IconName` union is derived from `keyof typeof iconPaths` via `satisfies`, giving compile-time autocomplete on known icon names. Strictly better than the plan spec. | No |
| 2 | nit | `frontend/src/components/ui/index.ts` | `IconName` type is not re-exported from the barrel. `FAB` and `TopBar` import it directly from `"./Icon"`. Callers outside the folder who need `IconName` must also import from `"./Icon"` directly. Acceptable for current usage; could be re-exported as a convenience. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 8 files renamed (git detected as R — renames with content similarity): `BottomSheet`, `EmptyState`, `ErrorState`, `FAB`, `Icon`, `LoadingState`, `TopBar` (`.jsx`→`.tsx`); `index` (`.js`→`.ts`). ✅
2. Verified zero `any` usage across all 8 files. ✅
3. Cross-checked all 8 files against plan spec:
   - `Icon.tsx`: `IconProps { name: IconName|string; size?; color?; strokeWidth? }`; `IconName` type exported; `isIconName` guard; `iconPaths satisfies Record<string, ReactNode>`. ✅
   - `BottomSheet.tsx`: `{ open: boolean; onClose: () => void; title: string; className?; children? }`; returns `ReactElement | null`. ✅
   - `EmptyState.tsx`: `{ title: string; body: string; action?; onAction? }`; returns `ReactElement`. ✅
   - `ErrorState.tsx`: `{ onRetry: () => void }`; returns `ReactElement`. ✅
   - `FAB.tsx`: `{ onClick: () => void; icon?: IconName | string }`; imports `IconName` from `Icon`. ✅
   - `LoadingState.tsx`: `{ rows?: number }`; returns `ReactElement`. ✅
   - `TopBar.tsx`: `TopBarAction` interface; `{ title; subtitle?; onBack?; actions? }`; `isValidElement` distinguishes `ReactNode` icon from string. ✅
   - `index.ts`: Re-exports all 7 components; no runtime changes. ✅
4. Ran `npm run lint` → 0 errors, 1 pre-existing warning (`AuthContext.tsx`). ✅
5. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
6. Ran `npm run build` → success. ✅
7. Ran `npm test` → **285/285 on first run**, no flakiness. ✅

##### Findings
- All acceptance-criteria commands pass with zero TS errors.
- `satisfies Record<string, ReactNode>` on `iconPaths` and `isIconName` type guard are clean TypeScript idioms that improve type safety beyond the plan spec.
- `TopBarAction.icon: IconName | string | ReactNode` with `isValidElement` check is a precise, correct union discriminant.

##### Risks
- None. All changes are type-annotated equivalents of the original JSX/JS.

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-008

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/components/AddItemSheet.tsx` L18 | `onAdd` return type is `Promise<boolean | void> | boolean | void`; plan spec had `Promise<boolean | void> | void`. The `| boolean` branch accounts for synchronous callers; strictly more permissive, not harmful. Plan said "read file first" so this is implementer-driven. | No |
| 2 | nit | `frontend/src/components/AddItemSheet.tsx` L19 | `onClose` is required in the implementation interface; plan spec had `onClose?: () => void`. Making it required matches real usage (BottomSheet always receives it) and is a stricter, correct choice. | No |
| 3 | nit | `frontend/src/components/InfoSheet.tsx` L23 | `handleLogout` has no explicit return type annotation (implicit `void`). Minor style inconsistency with the rest of the file; no functional impact. | No |
| 4 | nit | `frontend/src/components/ListCardHome.tsx` L7–11 | `HomeList extends List` with `name: string` (non-optional) is a clean narrowing pattern for a component that requires a list name. Slightly beyond the plan which said "read file first". Correct and idiomatic. | No |
| 5 | nit | `frontend/src/components/ShareListSheet.tsx` L6–12 | `SharedListMember extends Member` with required `user_id`, `display_name`, `email` fields is a correct narrowing for the component. Same "read file first" rationale. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 13 old `.jsx` source files deleted and 13 new `.tsx` files present (git shows R-renames for all). Only `.jsx` files remaining are test files (T-010 scope). ✅
2. Verified zero `any` usage across all 13 files (`grep -rn "any" frontend/src/components/*.tsx`). ✅
3. Cross-checked all 13 files against plan spec:
   - `EntryTile.tsx`: `entry: Entry; onEdit?: () => void; onToggle?: () => void`; `Entry` from `../types`. ✅
   - `AddItemSheet.tsx`: Full interface present; `inert={!showIconBrowser || undefined}` works without cast (React 19 `@types/react` supports `inert`); event handlers typed (`ChangeEvent`, `FocusEvent`, `FormEvent`). ✅
   - `AutocompleteSuggestions.tsx`: `Suggestion[]` from types; `onSelect: (text, iconName) => void`. ✅
   - `ProtectedRoute.tsx`: `children: ReactNode`. ✅
   - `ListCardHome.tsx`: `HomeList extends List`; `List` from types; callbacks typed. ✅
   - `RecentlyUsedSection.tsx`: `Suggestion[]` from types; `onAdd?`, `onDismiss?` typed. ✅
   - `InfoSheet.tsx`: `{ open: boolean; onClose: () => void }`; `getAppVersion` uses safe `globalThis` cast. ✅
   - `LanguageSwitcher.tsx`: No props (correct); `LANGUAGES as const`; `LanguageCode` derived type; `isLanguageCode` guard. ✅
   - `OfflineBanner.tsx`: No props (correct); returns `ReactElement | null`. ✅
   - `ListOptionsSheet.tsx`: Full interface with optional callbacks; returns `ReactElement | null`. ✅
   - `NewListSheet.tsx`: `{ open: boolean; onAdd?: (name: string) => void; onClose: () => void }`. ✅
   - `RenameListSheet.tsx`: `{ open: boolean; onClose: () => void; currentName: string; onRename?: (name: string) => Promise<void> | void }`. ✅
   - `ShareListSheet.tsx`: `SharedListMember extends Member`; `Member` from types; full props interface with typed callbacks. ✅
4. Ran `npm run lint` → 0 errors, 1 pre-existing warning (`AuthContext.tsx`). ✅
5. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
6. Ran `npm run build` → success (pre-existing chunk-size warnings only). ✅
7. Ran focused component tests (7 test files, 39 tests) → **39/39 passed**. ✅
8. Ran `npm test` → **285/285 on first run**, no flakiness. ✅

##### Findings
- All acceptance-criteria commands pass with zero TypeScript errors.
- `HomeList extends List` and `SharedListMember extends Member` are idiomatic TypeScript patterns for narrowing domain types to component needs.
- `inert` prop used without cast, confirming `@types/react` 19 support in the project.
- No functional logic changes — pure type annotation and file rename.

##### Risks
- None. All changes are type-annotated equivalents of the original JSX.

#### Open Questions
- None.

#### Verdict
`PASS`

## Task: T-009

### Review Round 1

Status: **PASS**

Reviewed: 2026-05-12

#### Findings

| # | Severity | File / Line | Description | Required Fix |
|---|----------|-------------|-------------|--------------|
| 1 | nit | `frontend/src/pages/RegisterPage.tsx` L11 | `RegisterResult.user` typed via `Parameters<ReturnType<typeof useAuth>["setAuthToken"]>[1]`. Creative but verbose — `User | null` from `../types` would be clearer. Functionally correct and safe; adapts automatically if `setAuthToken` signature changes. | No |
| 2 | nit | `frontend/src/pages/ListDetailPage.tsx` L114, L153, L197, L213 | `as DetailEntry[]` / `as DetailList[]` / `as DetailMember[]` casts on API result arrays. Necessary since `fetchEntries`, `fetchLists`, `fetchListMembers` return narrower base types from `../types`; the cast is the idiomatic boundary. | No |
| 3 | nit | `frontend/src/pages/ListDetailPage.test.jsx` | Test file modified (not renamed) to update the `readFileSync` path from `ListDetailPage.jsx` to `ListDetailPage.tsx`. Correct minimal fix for T-009 scope; full rename to `.tsx` is T-010 work. | No |

No blockers, major issues, or required fixes found.

#### Verification

##### Steps
1. Confirmed all 11 old `.jsx`/`.js` source files deleted (git shows R-renames): `App.jsx`, all 9 page `.jsx` files, `recentlyUsedState.js`. `main.tsx` was already migrated in T-001 as noted. ✅
2. Confirmed only test files (`.jsx`/`.js`) remain in `pages/` — `ListDetailPage.test.jsx`, `recentlyUsedState.test.js` — correct T-010 scope. ✅
3. Verified zero `any` usage across all migrated files. ✅
4. Cross-checked all 12 targets against plan spec:
   - `App.tsx`: No props; returns `ReactElement`; `ProtectedLayout` helper typed; routes via react-router-dom. ✅
   - `recentlyUsedState.ts`: `Suggestion`, `Entry` from types; `Pick<Entry, "text" | "icon">` and `Pick<Entry, "text" | "status">` utility types; both exports explicitly typed. ✅
   - `ListDetailPage.tsx`: `useState<DetailList | null>(null)`, `useState<DetailEntry[]>([])`, `useState<DetailMember[]>([])`, `useState<Suggestion[]>([])` — all plan-required explicit generic calls present; `isShareInviteResult` type guard; `getErrorMessage(error: unknown): string`. ✅
   - `OverviewPage.tsx`: `useState<OverviewList[]>([])` (plan: `useState<List[]>([])`); `OverviewList extends List` narrows to guaranteed `name: string`. Correct. ✅
   - `LoginPage.tsx`: `LoginLocationState` interface for `location.state` cast; all useState typed `string`/`boolean`. ✅
   - `RegisterPage.tsx`: `RegisterResult` + `isRegisterResult` type guard; all useState typed. ✅
   - `ForgotPasswordPage.tsx`: All useState typed `string`/`boolean`. ✅
   - `ResetPasswordPage.tsx`: All useState typed `string`/`boolean`. ✅
   - `VerifyEmailPage.tsx`: `VerifyEmailLocationState` interface; all useState typed. ✅
   - `InviteAcceptPage.tsx`: `useParams()` destructured with default `= ""`; `useState<string>("")` for error. ✅
   - `SearchPage.tsx`: Simple stub page; `ReactElement` return type. ✅
   - `main.tsx`: Already had `document.getElementById("root")!` non-null assertion from T-001. ✅
5. Ran `npm run lint` → 0 errors, 1 pre-existing warning (`AuthContext.tsx`). ✅
6. Ran `npx tsc --noEmit` → clean, 0 errors. ✅
7. Ran `npm run build` → success. ✅
8. Ran focused tests (`src/app.test.jsx src/pages/ListDetailPage.test.jsx src/pages/recentlyUsedState.test.js`) → **46/46 passed**. ✅
9. Ran `npm test` → **285/285 on first run**, no flakiness. ✅

##### Findings
- All acceptance-criteria commands pass with zero TypeScript errors.
- `DetailEntry`, `DetailList`, `DetailMember` local interface pattern (extending domain types) is consistent with T-008 `HomeList`/`SharedListMember` approach.
- `Pick<Entry, "text" | "icon">` and `Pick<Entry, "text" | "status">` in `recentlyUsedState.ts` are idiomatic utility types that express exactly the minimum contract needed.
- `getErrorMessage(error: unknown): string` pattern is used consistently across all pages — a clean, reusable narrowing function.
- `LoginLocationState` and `VerifyEmailLocationState` interfaces for `location.state` casts are a good practice with react-router-dom v6.

##### Risks
- None. All changes are type-annotated equivalents of the original JSX/JS; no business logic altered.

#### Open Questions
- None.

#### Verdict
`PASS`
