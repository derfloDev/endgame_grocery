# ROADMAP

Goal: Migrate the React 19 frontend from JSX/JS to TypeScript (TSX/TS).

## Priority 1 — TypeScript Migration

Objective: Convert all frontend source files from `.jsx`/`.js` to `.tsx`/`.ts`, introduce
strict typing, and keep the build and all tests green throughout.

### Scope

- ~80 source files across `api/`, `data/`, `utils/`, `workers/`, `hooks/`, `context/`,
  `components/ui/`, `components/`, `pages/`, and the entry points (`App.jsx`, `main.jsx`).
- `vite.config.js` → `vite.config.ts`.
- Test files (`.test.jsx` / `.test.js`) migrated to `.test.tsx` / `.test.ts`.
- `src/sw/service-worker.js` **stays as `.js`** (Workbox / VitePWA injectManifest boundary).
- `src/sw/register.js` → `register.ts`.

### Constraints & Decisions

| Topic | Decision |
|---|---|
| TypeScript strictness | `"strict": true` + `"noUncheckedIndexedAccess": false` |
| Service worker | Remains `.js`; `tsconfig.json` excludes `src/sw/service-worker.js` |
| Domain types | Central `src/types.ts` for `Entry`, `List`, `User`, `Member`, etc. |
| `@xenova/transformers` | `// @ts-expect-error` / `unknown` casts at module boundary; no custom declaration file |
| Props | `interface` or `type` for every component's props; no untyped `any` props |
| React 19 | Use typed `use()` hook and action props where already present in code |

### Acceptance Criteria

- `npm run build` succeeds with zero TypeScript errors.
- `npm run lint` passes (with TypeScript-aware ESLint rules active).
- `npm test` passes without regressions.
- No `any` type appears without an explicit `// ts-ignore-reason:` comment explaining why.
- All component props are typed via `interface` or `type`.
- `src/types.ts` contains the shared domain interfaces (`Entry`, `List`, `User`, `Member`).

### Migration Order (bottom-up)

1. Toolchain: `tsconfig.json`, install `typescript` + `@types/*`, update `vite.config.ts`, ESLint TS plugin.
2. Shared types: `src/types.ts` (domain interfaces).
3. Pure utilities and data: `utils/`, `data/`, `src/app.constants.js`, `src/i18n.js`.
4. API layer: `api/*.js` → `api/*.ts`.
5. Workers: `workers/*.js` → `workers/*.ts` (with `@ts-expect-error` at `@xenova/transformers` boundary).
6. Hooks: `hooks/*.js` → `hooks/*.ts`.
7. Contexts: `context/*.jsx` / `context/*.js` → `.tsx` / `.ts`.
8. UI primitive components: `components/ui/*.jsx` → `.tsx`.
9. Feature components: `components/*.jsx` → `.tsx`.
10. Pages: `pages/*.jsx` → `.tsx`, `pages/*.js` → `.ts`.
11. Entry points: `App.jsx` → `App.tsx`, `main.jsx` → `main.tsx`, `vite.config.js` → `vite.config.ts`.
12. Test files: `*.test.jsx` / `*.test.js` → `*.test.tsx` / `*.test.ts`.
