# Plan

Status: **ready_for_implement**

Goal: Create a root `README.md` that documents the full local development setup so developers can get the project running without trial and error.

## Background

There is currently no `README.md`. The missing local setup documentation caused a silent runtime failure: `DATABASE_URL` was never set, `getPool()` returned `null`, and registration threw "Database connection is not configured." A clear setup guide prevents this class of problem.

## Scope

Create `README.md` at the project root covering:

1. **Prerequisites** — Node.js, Docker / Docker Compose
2. **Environment setup** — copy `.env.example` → `.env`, note `JWT_SECRET` must be changed for production
3. **Database** — `docker-compose up -d` to start PostgreSQL, `npm run migrate` to run migrations
4. **Optional seed data** — `npm run db:seed`
5. **Development** — `npm run dev` (starts frontend + backend concurrently)
6. **Validation** — `npm run lint`, `npm run build`, `npm test`
7. **Available npm scripts** — table listing all root-level scripts

## Acceptance Criteria

1. `README.md` exists at the project root.
2. Following only the README steps, a developer can run `npm run dev` and reach a working registration page.
3. `npm run lint` passes (README is not linted, but no other files are touched that could break it).
4. `npm run build` passes.

## Implementation Phases

### Phase 1 — Write README.md

**File**: `README.md` (new, project root)

Sections (in order):
- Project title + one-line description
- Prerequisites
- Local setup (env → database → migrate → dev)
- Available scripts table
- Tech stack summary (React frontend, Node/Express backend, PostgreSQL)

No source files are modified.

## Validation

- `npm run lint`
- `npm run build`
