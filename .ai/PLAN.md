# PLAN — TypeScript Migration (chore/typescript)

Status: **ready**

## Goal

Convert the React 19 frontend from JSX/JS to TSX/TS. Build, lint, and all tests
must remain green throughout. No `any` without an explanatory comment. All
component props typed via `interface` or `type`.

## Key Decisions (agreed in roadmap refinement)

| Topic | Decision |
|---|---|
| Strictness | `"strict": true`, `"noUncheckedIndexedAccess": false` |
| Service worker | `src/sw/service-worker.js` stays `.js` |
| Domain types | Centralised in `src/types.ts` |
| `@xenova/transformers` | `// @ts-expect-error` + `unknown` at module boundary |

---

## T-001 — Toolchain Setup

### Objective
Install TypeScript, type packages, and ESLint TypeScript support. Create
`tsconfig.json`. Rename `vite.config.js` → `vite.config.ts` and update
`index.html`. Rename `src/test/setup.js` → `src/test/setup.ts`.

### New `tsconfig.json` (`frontend/tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false
  },
  "include": ["src", "vite.config.ts"],
  "exclude": ["src/sw/service-worker.js", "node_modules", "dist"]
}
```

### `frontend/package.json` additions (devDependencies)
- `typescript` — TypeScript compiler
- `@types/react` — React type definitions
- `@types/react-dom` — ReactDOM type definitions

### Root `package.json` additions (devDependencies)
- `typescript-eslint` — flat-config-compatible TS-ESLint bundle (includes parser
  and plugin)

### `eslint.config.js` changes
Add a new config block for `frontend/**/*.ts` and `frontend/**/*.tsx` that:
- Uses `typescript-eslint`'s parser (`tseslint.parser`)
- Spreads `tseslint.configs.recommended` rules
- Keeps existing `react`, `react-hooks`, and `react-refresh` rules
- Turns off `react/prop-types` (covered by TS) and `react/react-in-jsx-scope`
- Keeps the existing `frontend/**/*.js` / `*.jsx` block as-is (for the service
  worker and any remaining `.js` files)

### `frontend/src/vite-env.d.ts` — new file
Declare the `__APP_VERSION__` global injected by Vite's `define`:
```typescript
/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
```

### `vite.config.ts` changes
- Rename file from `.js` to `.ts`
- Update `test.setupFiles` to reference `./src/test/setup.ts`

### `index.html` change
Update `<script type="module" src="/src/main.jsx">` →
`<script type="module" src="/src/main.tsx">`

### `src/test/setup.js` → `src/test/setup.ts`
Rename only; no type changes needed (test setup usually has no typed exports).

### Files to change
- `frontend/package.json`
- `frontend/tsconfig.json` *(new)*
- `frontend/src/vite-env.d.ts` *(new)*
- `frontend/vite.config.ts` *(renamed from `.js`)*
- `frontend/index.html`
- `frontend/src/test/setup.ts` *(renamed from `.js`)*
- `package.json` *(root)*
- `eslint.config.js`

### Validation
```
cd frontend && npm install
npm run build        # must succeed
npm run lint         # must pass
npm test             # must pass
```

---

## T-002 — Shared Domain Types

### Objective
Create `src/types.ts` with all shared domain interfaces so later tasks can
import from a single location instead of redeclaring shapes.

### `src/types.ts` content

```typescript
// ── Grocery domain ───────────────────────────────────────────────────────────

export interface Entry {
  id: string;
  text: string;
  icon?: string | null;
  details?: string;
  status: "open" | "done";
  is_pending_sync?: boolean;
}

export interface List {
  id: string;
  name?: string;
  is_owner?: boolean;
}

export interface Member {
  id: string;
  email?: string;
  display_name?: string;
}

export interface User {
  id: string;
  display_name?: string;
  email?: string;
}

// ── App config ───────────────────────────────────────────────────────────────

export interface AppConfig {
  registrationEnabled: boolean;
}

// ── Offline queue ─────────────────────────────────────────────────────────────

export interface QueueMeta {
  resourceType?: string;
  tempId?: string;
}

export interface OfflineMutation {
  id: string;
  url: string;
  method: string;
  payload?: unknown;
  token: string;
  createdAt: string;
  queueMeta?: QueueMeta | null;
}

export interface OfflineQueueContextValue {
  isOffline: boolean;
  queuedCount: number;
  isSyncing: boolean;
  syncError: string;
  syncVersion: number;
}

// ── Autocomplete / suggestions ────────────────────────────────────────────────

export interface Suggestion {
  text: string;
  icon?: string | null;
  useCount?: number;
}

// ── Icon worker ───────────────────────────────────────────────────────────────

export interface TopMatch {
  iconName: string;
  score: number;
}

export interface IconMatchResult {
  iconName: string | null;
  score: number;
  topMatches: TopMatch[];
}

// ── Icon registry ─────────────────────────────────────────────────────────────

/** Minimum prop contract shared by every icon component in ICON_REGISTRY. */
export interface IconProps {
  size?: number;
  stroke?: number;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean | "true";
  "data-icon-name"?: string;
  "data-testid"?: string;
}
```

### Files to change
- `frontend/src/types.ts` *(new)*

### Validation
```
npm run build
npm run lint
```

---

## T-003 — Pure Modules

### Objective
Migrate utility, data, and service-worker-registration modules. No React, no
component imports.

### File-by-file notes

| Old path | New path | Notes |
|---|---|---|
| `src/app.constants.js` | `src/app.constants.ts` | Add `export const APP_TITLE: string` |
| `src/i18n.js` | `src/i18n.ts` | Infer or cast `i18next` return type; `skipLibCheck` covers any gaps |
| `src/utils/cosineSimilarity.js` | `src/utils/cosineSimilarity.ts` | Type params as `number[]`, return `number` |
| `src/data/iconDatabase.js` | `src/data/iconDatabase.ts` | Add `IconDbEntry` interface `{ label: string; icon: string; tags?: string[] }`, type `ICON_DB` as `readonly IconDbEntry[]` |
| `src/data/customIcons.js` | `src/data/customIcons.ts` | Each Custom* component: `React.FC<IconProps>` using `IconProps` from `src/types.ts` |
| `src/data/iconRegistry.js` | `src/data/iconRegistry.ts` | Type `ICON_REGISTRY` as `Readonly<Record<string, React.ComponentType<IconProps>>>`. Type `fromLucide` wrapper to accept `React.ComponentType<...>` and return `React.FC<IconProps>` |
| `src/sw/register.js` | `src/sw/register.ts` | Type `registerServiceWorker(): void` |

### Files to change
- `frontend/src/app.constants.ts`
- `frontend/src/i18n.ts`
- `frontend/src/utils/cosineSimilarity.ts`
- `frontend/src/data/iconDatabase.ts`
- `frontend/src/data/customIcons.ts`
- `frontend/src/data/iconRegistry.ts`
- `frontend/src/sw/register.ts`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-004 — API Layer

### Objective
Migrate all files in `src/api/` to TypeScript. Type request options and return
values. Import shared types from `src/types.ts`.

### File-by-file notes

**`client.ts`**
- Add `SendJsonRequestOptions` interface (token, method, payload, headers,
  cacheKey, offlineFallbackMessage, queueable, queueMeta)
- `sendJsonRequest(url: string, options?: SendJsonRequestOptions): Promise<unknown>`
- Helper functions typed with explicit return types

**`offlineStore.ts`**
- Import `OfflineMutation` from `src/types.ts`
- `enqueueOfflineMutation(mutation: OfflineMutation): Promise<void>`
- `listOfflineMutations(): Promise<OfflineMutation[]>`
- `readCachedResource(key: string): Promise<unknown>`
- `writeCachedResource(key: string, value: unknown): Promise<void>`
- `removeOfflineMutation(id: string): Promise<void>`
- `resetOfflineStateForTests(): Promise<void>`

**`auth.ts`**
- Import `User` from `src/types.ts`
- `loginUser(credentials: { email: string; password: string }): Promise<{ token: string; user?: User }>`
- `registerUser(payload: { email: string; password: string; display_name?: string }): Promise<unknown>`
- `fetchCurrentUser(token: string): Promise<User>`

**`config.ts`**
- Import `AppConfig` from `src/types.ts`
- `fetchAppConfig(): Promise<AppConfig>`

**`lists.ts`**
- Import `List` from `src/types.ts`
- `fetchLists(token: string): Promise<{ lists: List[] }>`
- `createList`, `renameList`, `deleteList` — typed accordingly

**`entries.ts`**
- Import `Entry` from `src/types.ts`
- `fetchEntries(listId: string, token: string): Promise<{ entries: Entry[] }>`
- `createEntry`, `updateEntry`, `deleteEntry` — typed accordingly

**`history.ts`**
- Import `Suggestion` from `src/types.ts`
- Type return as `{ items: Suggestion[] }` or similar (read file first)

**`suggestions.ts`**
- Import `Suggestion` from `src/types.ts`
- Type response shape with `offline?: boolean` and `suggestions: Suggestion[]`

**`sharing.ts`**
- Import `Member` from `src/types.ts`
- `fetchListMembers`, `shareListWithMember`, `revokeListMember` — typed

**`push.ts`**
- Type push subscription and response shapes (read file first)

### Files to change
- `frontend/src/api/auth.ts`
- `frontend/src/api/client.ts`
- `frontend/src/api/config.ts`
- `frontend/src/api/entries.ts`
- `frontend/src/api/history.ts`
- `frontend/src/api/lists.ts`
- `frontend/src/api/offlineStore.ts`
- `frontend/src/api/push.ts`
- `frontend/src/api/sharing.ts`
- `frontend/src/api/suggestions.ts`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-005 — Workers

### Objective
Migrate `src/workers/` to TypeScript. Handle `@xenova/transformers` boundary
with `// @ts-expect-error` (one comment per suppression, with reason).

### File-by-file notes

**`iconWorker.ts`**
- Add `// @ts-expect-error — @xenova/transformers has no bundled types` before
  the `import { pipeline }` line
- Type `matchIcon` return as `Promise<IconMatchResult>` (from `src/types.ts`)
- `self.addEventListener("message", ...)` — `self` is `DedicatedWorkerGlobalScope`
  (available via `lib: ["DOM"]`); cast if needed

**`iconWorkerClient.ts`**
- Import `IconMatchResult` from `src/types.ts`
- Type `pendingRequests` map:
  `Map<number, { resolve: (v: IconMatchResult) => void; reject: (e: Error) => void }>`
- `requestIconMatch(text: string): Promise<IconMatchResult>`
- `primeIconWorker(): void`, `getIconWorker(): Worker | null`
- Worker URL reference: `new Worker(new URL("./iconWorker.ts", import.meta.url), { type: "module" })`

### Files to change
- `frontend/src/workers/iconWorker.ts`
- `frontend/src/workers/iconWorkerClient.ts`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-006 — Hooks and Contexts

### Objective
Migrate all hooks to `.ts` and all context files to `.tsx`/`.ts`. Import domain
types from `src/types.ts`.

### Hooks (`src/hooks/`)

**`useLongPress.ts`**
```typescript
interface LongPressHandlers {
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onClick: (event: React.MouseEvent) => void;
}
interface LongPressResult {
  pressing: boolean;
  longPressHandlers: LongPressHandlers;
}
export function useLongPress(
  onLongPress: (() => void) | undefined,
  ms?: number
): LongPressResult
```

**`useAutocomplete.ts`**
- Import `Suggestion` from `src/types.ts`
- Returns `{ suggestions: Suggestion[]; loading: boolean }`

**`useIconSuggestion.ts`**
- Returns `{ iconName: string | null; topMatches: string[]; loading: boolean }`

**`useListEvents.ts`**
- `type SseEventType` literal union (same as in EventSourceContext)
- `handler: (data: Record<string, unknown>) => void`

**`useOfflineQueue.ts`**
- Import `OfflineQueueContextValue` from `src/types.ts`
- Return type: `OfflineQueueContextValue`

**`usePushNotifications.ts`**
- Type return shape explicitly (read file first)

### Contexts (`src/context/`)

**`appConfigState.ts`**
- Import `AppConfig` from `src/types.ts`
- `AppConfigContext: React.Context<AppConfig>`
- `defaultAppConfig: AppConfig`
- `useAppConfig(): AppConfig`

**`AppConfigContext.tsx`**
- `interface AppConfigProviderProps { children: React.ReactNode; loadConfig?: () => Promise<AppConfig> }`
- `interface StaticAppConfigProviderProps { children: React.ReactNode; registrationEnabled?: boolean }`

**`offlineQueueContextValue.ts`**
- Import `OfflineQueueContextValue` from `src/types.ts`
- `OfflineQueueContext: React.Context<OfflineQueueContextValue | null>`

**`OfflineQueueContext.tsx`**
- `interface OfflineQueueProviderProps { children: React.ReactNode }`
- `replaceTemporaryIds`: use overloads or `unknown` parameter narrowed with guards
- `extractCreatedId(resourceType: string | undefined, data: unknown): string`

**`AuthContext.tsx`**
- Import `User` from `src/types.ts`
- `interface AuthContextValue { token: string; user: User | null; login: (credentials: { email: string; password: string }) => Promise<{ token: string; user?: User }>; register: (payload: unknown) => Promise<unknown>; logout: () => void; setAuthToken: (token: string, user?: User | null) => void }`
- `AuthContext: React.Context<AuthContextValue | null>`

**`EventSourceContext.tsx`**
- `type SseEventType = "entry:created" | "entry:updated" | "entry:deleted" | "list:updated" | "list:deleted" | "member:added" | "member:removed"`
- `type SseHandler = (data: Record<string, unknown>) => void`
- `interface EventSourceContextValue { addEventListener: (type: SseEventType, handler: SseHandler) => () => void }`

### Files to change
- `frontend/src/hooks/useAutocomplete.ts`
- `frontend/src/hooks/useIconSuggestion.ts`
- `frontend/src/hooks/useListEvents.ts`
- `frontend/src/hooks/useLongPress.ts`
- `frontend/src/hooks/useOfflineQueue.ts`
- `frontend/src/hooks/usePushNotifications.ts`
- `frontend/src/context/AppConfigContext.tsx`
- `frontend/src/context/appConfigState.ts`
- `frontend/src/context/AuthContext.tsx`
- `frontend/src/context/EventSourceContext.tsx`
- `frontend/src/context/OfflineQueueContext.tsx`
- `frontend/src/context/offlineQueueContextValue.ts`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-007 — UI Primitive Components

### Objective
Migrate `src/components/ui/` from `.jsx` to `.tsx`. All props via `interface`.

### Key prop interfaces

**`Icon.tsx`**
- `interface IconProps { name: string; size?: number; color?: string; strokeWidth?: number }`
  (separate from the `IconProps` in `src/types.ts` which is for registry icons)

**`BottomSheet.tsx`**
- `interface BottomSheetProps { open: boolean; onClose: () => void; title: string; className?: string; children?: React.ReactNode }`

**`EmptyState.tsx`**, **`ErrorState.tsx`**, **`LoadingState.tsx`**, **`FAB.tsx`**, **`TopBar.tsx`**
- Read each file first; define minimal prop interfaces covering all used props

**`index.ts`** (was `.js`)
- Re-export all UI components; no runtime changes needed

### Files to change
- `frontend/src/components/ui/BottomSheet.tsx`
- `frontend/src/components/ui/EmptyState.tsx`
- `frontend/src/components/ui/ErrorState.tsx`
- `frontend/src/components/ui/FAB.tsx`
- `frontend/src/components/ui/Icon.tsx`
- `frontend/src/components/ui/LoadingState.tsx`
- `frontend/src/components/ui/TopBar.tsx`
- `frontend/src/components/ui/index.ts`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-008 — Feature Components

### Objective
Migrate all non-UI feature components in `src/components/` to `.tsx`. Import
domain types from `src/types.ts`. All callback props typed.

### Key prop interfaces (representative — implementer reads each file)

**`EntryTile.tsx`**
```typescript
import { Entry } from "../types";
interface EntryTileProps {
  entry: Entry;
  onEdit?: () => void;
  onToggle?: () => void;
}
```

**`AddItemSheet.tsx`**
```typescript
interface AddItemSheetProps {
  initialDetails?: string;
  initialIconName?: string | null;
  initialText?: string;
  listId?: string;
  mode?: "add" | "edit";
  open: boolean;
  onAdd?: (text: string, iconName: string | null, details: string) => Promise<boolean | void> | void;
  onClose?: () => void;
}
```

**`AutocompleteSuggestions.tsx`**
```typescript
import { Suggestion } from "../types";
interface AutocompleteSuggestionsProps {
  suggestions: Suggestion[];
  onSelect: (text: string, iconName: string | null) => void;
}
```

**`ProtectedRoute.tsx`**
```typescript
interface ProtectedRouteProps { children: React.ReactNode }
```

**`ListCardHome.tsx`**
```typescript
import { List } from "../types";
// read file to confirm exact prop shape
```

**`RecentlyUsedSection.tsx`**
```typescript
import { Suggestion } from "../types";
// read file to confirm exact prop shape
```

All remaining components (`InfoSheet`, `LanguageSwitcher`, `ListOptionsSheet`,
`NewListSheet`, `OfflineBanner`, `RenameListSheet`, `ShareListSheet`): read each
file first; define minimal prop interface from actual usage.

### Note on `inert` prop (`AddItemSheet.tsx`)
React 19 added `inert` to `HTMLAttributes`. Confirm `@types/react` version
supports it. If TypeScript errors on `inert`, cast:
```typescript
{...({ inert: showIconBrowser ? undefined : "" } as React.HTMLAttributes<HTMLDivElement>)}
```

### Files to change
- `frontend/src/components/AddItemSheet.tsx`
- `frontend/src/components/AutocompleteSuggestions.tsx`
- `frontend/src/components/EntryTile.tsx`
- `frontend/src/components/InfoSheet.tsx`
- `frontend/src/components/LanguageSwitcher.tsx`
- `frontend/src/components/ListCardHome.tsx`
- `frontend/src/components/ListOptionsSheet.tsx`
- `frontend/src/components/NewListSheet.tsx`
- `frontend/src/components/OfflineBanner.tsx`
- `frontend/src/components/ProtectedRoute.tsx`
- `frontend/src/components/RecentlyUsedSection.tsx`
- `frontend/src/components/RenameListSheet.tsx`
- `frontend/src/components/ShareListSheet.tsx`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-009 — Pages and Entry Points

### Objective
Migrate all page components to `.tsx`, state helpers to `.ts`, and the two
entry-point files (`App.tsx`, `main.tsx`). All local state typed explicitly.

### Key notes

**`recentlyUsedState.ts`**
- Import `Suggestion` from `src/types.ts`
- Type `filterRecentlyUsedItems` and `upsertRecentlyUsedItems` with `Suggestion[]`

**`ListDetailPage.tsx`** (most complex)
- Import `List`, `Entry`, `Member` from `src/types.ts`
- Type every `useState` explicitly:
  `const [list, setList] = useState<List | null>(null)`
  `const [entries, setEntries] = useState<Entry[]>([])`
  `const [members, setMembers] = useState<Member[]>([])`
- Avoid inferred `null` literals without union types

**`OverviewPage.tsx`**
- `useState<List[]>([])` for the lists array

**Auth pages** (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`,
`ResetPasswordPage`, `VerifyEmailPage`)
- Form state: `string`; error state: `string`

**`App.tsx`**
- No props; routes typed by react-router-dom

**`main.tsx`**
- `document.getElementById("root")!` — non-null assertion (element is guaranteed
  in `index.html`)

**`index.html`** (if not already updated in T-001)
- Confirm `src="/src/main.tsx"` in the module script tag

### Files to change
- `frontend/src/pages/ForgotPasswordPage.tsx`
- `frontend/src/pages/InviteAcceptPage.tsx`
- `frontend/src/pages/ListDetailPage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/OverviewPage.tsx`
- `frontend/src/pages/recentlyUsedState.ts`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/ResetPasswordPage.tsx`
- `frontend/src/pages/SearchPage.tsx`
- `frontend/src/pages/VerifyEmailPage.tsx`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`

### Validation
```
npm run build
npm run lint
npm test
```

---

## T-010 — Test Files

### Objective
Rename all `*.test.jsx` → `*.test.tsx` and `*.test.js` → `*.test.ts`. Fix
any TS errors in mocks, spies, and render helpers. Ensure Vitest types resolve.

### Notes
- Vitest ships its own types; no `@types/jest` needed.
- Add `"types": ["vitest/globals"]` to `tsconfig.json` **or** use explicit
  imports (`import { describe, it, expect, vi } from "vitest"`). Prefer explicit
  imports — add to `tsconfig.json` only if the test files rely on implicit globals.
- `vi.fn()` mocks: type as `ReturnType<typeof vi.fn>` or use the generic form
  `vi.fn<[ParamTypes], ReturnType>()` where needed.
- `@testing-library/react` `render` return is already typed; no extra types needed.

### Files to rename/migrate

| Old | New |
|---|---|
| `src/app.test.jsx` | `src/app.test.tsx` |
| `src/i18n.test.js` | `src/i18n.test.ts` |
| `src/vite-config.test.js` | `src/vite-config.test.ts` |
| `src/components/AddItemSheet.test.jsx` | `src/components/AddItemSheet.test.tsx` |
| `src/components/AutocompleteSuggestions.test.jsx` | `src/components/AutocompleteSuggestions.test.tsx` |
| `src/components/entry-tile.test.jsx` | `src/components/entry-tile.test.tsx` |
| `src/components/InfoSheet.test.jsx` | `src/components/InfoSheet.test.tsx` |
| `src/components/LanguageSwitcher.test.jsx` | `src/components/LanguageSwitcher.test.tsx` |
| `src/components/RecentlyUsedSection.test.jsx` | `src/components/RecentlyUsedSection.test.tsx` |
| `src/components/ShareListSheet.test.jsx` | `src/components/ShareListSheet.test.tsx` |
| `src/components/ui/ui.test.jsx` | `src/components/ui/ui.test.tsx` |
| `src/context/AppConfigContext.test.jsx` | `src/context/AppConfigContext.test.tsx` |
| `src/context/AuthContext.test.jsx` | `src/context/AuthContext.test.tsx` |
| `src/context/EventSourceContext.test.jsx` | `src/context/EventSourceContext.test.tsx` |
| `src/data/iconRegistry.test.js` | `src/data/iconRegistry.test.ts` |
| `src/hooks/useAutocomplete.test.js` | `src/hooks/useAutocomplete.test.ts` |
| `src/hooks/useIconSuggestion.test.js` | `src/hooks/useIconSuggestion.test.ts` |
| `src/hooks/useListEvents.test.js` | `src/hooks/useListEvents.test.ts` |
| `src/hooks/useLongPress.test.jsx` | `src/hooks/useLongPress.test.tsx` |
| `src/hooks/usePushNotifications.test.js` | `src/hooks/usePushNotifications.test.ts` |
| `src/pages/ListDetailPage.test.jsx` | `src/pages/ListDetailPage.test.tsx` |
| `src/pages/recentlyUsedState.test.js` | `src/pages/recentlyUsedState.test.ts` |
| `src/utils/cosineSimilarity.test.js` | `src/utils/cosineSimilarity.test.ts` |
| `src/workers/iconWorkerClient.test.js` | `src/workers/iconWorkerClient.test.ts` |

### Validation
```
npm run build
npm run lint
npm test        # all tests green
```

---

## Global Conventions for All Tasks

1. **No `any` without comment**: if `any` is unavoidable, add
   `// ts-ignore-reason: <explanation>` on the preceding line.
2. **`unknown` over `any`**: use `unknown` for generic API responses; narrow
   with type guards or casts only after checking.
3. **No functional changes**: this is a type-only migration. Do not alter
   business logic, restructure imports, or rename exports.
4. **Rename = delete old + create new**: delete the old `.js`/`.jsx` file and
   create the `.ts`/`.tsx` file so Vite does not pick up duplicates.
5. **Old `.js`/`.jsx` files must be deleted** — Vite resolves both and will
   throw a "duplicate module" error if both exist.
6. **`inert` prop note**: React 19 `@types/react` includes `inert` on
   `HTMLAttributes`. Confirm installed `@types/react` version ≥ 18.3+ or 19+
   before migrating `AddItemSheet`.
