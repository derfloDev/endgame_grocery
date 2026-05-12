# TASKS

Use this board to coordinate handoff between planner, implementer, and reviewer.

Status values:
- `in_planning`
- `ready_for_implement`
- `in_implementation`
- `ready_for_review`
- `in_review`
- `ready_to_commit`
- `changes_requested`
- `done`

Command expectations:
- planner moves tasks into `in_planning` and `ready_for_implement`
- implementer moves tasks into `in_implementation`, `ready_for_review`, and `done`, and resumes work from `changes_requested` and `ready_to_commit`
- reviewer moves tasks into `in_review`, `ready_to_commit`, or `changes_requested`
- `status_cycle` should report deterministic task status, current owner role, and next recommended action based on this board

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | Toolchain setup: `tsconfig.json`, `typescript` + `@types/*` deps, `typescript-eslint` in root, ESLint TS block, `vite.config.ts`, `vite-env.d.ts`, `index.html` script src, `src/test/setup.ts` | done | `npm run build`, `npm run lint`, `npm test` all pass with zero TS errors after install | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm test` pass | none |
| T-002 | Shared domain types: create `src/types.ts` with `Entry`, `List`, `Member`, `User`, `AppConfig`, `OfflineMutation`, `QueueMeta`, `OfflineQueueContextValue`, `Suggestion`, `TopMatch`, `IconMatchResult`, `IconProps` | done | `src/types.ts` exists; all interfaces present; build passes | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm test` pass | none |
| T-003 | Pure modules: migrate `app.constants`, `i18n`, `utils/cosineSimilarity`, `data/iconDatabase`, `data/customIcons`, `data/iconRegistry`, `sw/register` to `.ts` | done | All files renamed; old `.js` files deleted; build + lint + tests pass | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm test` pass | none |
| T-004 | API layer: migrate all 10 files in `src/api/` to `.ts`; type request options and return values against `src/types.ts` | done | All `.js` API files deleted; typed signatures present; build + lint + tests pass | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm test` pass | none |
| T-005 | Workers: migrate `iconWorker` and `iconWorkerClient` to `.ts`; use `@ts-expect-error` at `@xenova/transformers` boundary | done | Old `.js` worker files deleted; `@ts-expect-error` with reason comment present; build + lint + tests pass | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm run test --workspace frontend -- src/workers/iconWorkerClient.test.js`, `npm test` pass | none |
| T-006 | Hooks and contexts: migrate 6 hooks to `.ts` and 6 context files to `.tsx`/`.ts`; all typed against `src/types.ts` | done | Old `.js`/`.jsx` files deleted; all hooks/contexts have explicit return types; build + lint + tests pass | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm run test --workspace frontend -- src/hooks/useAutocomplete.test.js src/hooks/useIconSuggestion.test.js src/hooks/useListEvents.test.js src/hooks/useLongPress.test.jsx src/hooks/usePushNotifications.test.js src/context/AppConfigContext.test.jsx src/context/AuthContext.test.jsx src/context/EventSourceContext.test.jsx`, `npm test` pass | none |
| T-007 | UI primitive components: migrate `components/ui/` (7 `.jsx` + 1 `.js`) to `.tsx`/`.ts`; all props via `interface` | done | Old `.jsx`/`.js` deleted; every exported component has a typed props interface; build + lint + tests pass | `npm run lint`, `npx tsc -p frontend/tsconfig.json --noEmit`, `npm run build`, `npm run test --workspace frontend -- src/components/ui/ui.test.jsx`, `npm test` pass | none |
| T-008 | Feature components: migrate 13 components in `src/components/` to `.tsx`; all props typed, domain types from `src/types.ts` | ready_for_implement | Old `.jsx` files deleted; every component has props interface; build + lint + tests pass | n/a | implement |
| T-009 | Pages and entry points: migrate 9 pages + `recentlyUsedState` to `.tsx`/`.ts`; migrate `App.tsx`, `main.tsx` | ready_for_implement | Old `.jsx`/`.js` files deleted; all `useState` calls explicitly typed; `document.getElementById` non-null asserted; build + lint + tests pass | n/a | implement |
| T-010 | Test files: rename 24 test files from `.jsx`/`.js` to `.tsx`/`.ts`; fix TS errors in mocks and helpers | ready_for_implement | Old test files deleted; `npm test` green with zero TS errors | n/a | implement |
