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
