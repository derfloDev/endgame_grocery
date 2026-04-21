# Plan

Status: **ready_for_implement**

Goal: Deliver a family-ready grocery list PWA with shared lists, user accounts, and full offline support — as defined in `ROADMAP.md`.

---

## Scope

- Full-stack monorepo: `/frontend` (React + Vite + PWA) and `/backend` (Node.js REST API)
- PostgreSQL database with migration tooling
- JWT-based authentication (register, login)
- List CRUD with shared-list support (full write access, share by email, revoke)
- Entry CRUD with fast input (Enter-refocus) and done-items-to-bottom UX
- Offline-first PWA: Service Worker asset cache + IndexedDB read cache + offline write queue

---

## Repository Structure

```
endgame_grocery/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── api/       # API client (fetch wrappers)
│   │   ├── components/
│   │   ├── context/   # AuthContext, OfflineQueueContext
│   │   ├── hooks/
│   │   ├── pages/     # LoginPage, RegisterPage, OverviewPage, ListDetailPage
│   │   ├── sw/        # Service Worker helpers
│   │   └── main.jsx
│   ├── public/
│   ├── index.html
│   └── vite.config.js
├── backend/           # Node.js REST API
│   ├── src/
│   │   ├── db/        # PostgreSQL client + migrations
│   │   ├── middleware/ # auth (JWT verify)
│   │   ├── routes/    # auth, lists, entries, sharing
│   │   └── index.js
│   └── package.json
├── package.json       # root workspace scripts
└── docker-compose.yml # local PostgreSQL
```

---

## Data Model (PostgreSQL)

```sql
users        (id UUID PK, email TEXT UNIQUE, password_hash TEXT, display_name TEXT, created_at TIMESTAMPTZ)
lists        (id UUID PK, name TEXT, owner_id UUID FK→users, created_at TIMESTAMPTZ)
list_members (list_id UUID FK→lists, user_id UUID FK→users, joined_at TIMESTAMPTZ, PRIMARY KEY(list_id, user_id))
entries      (id UUID PK, list_id UUID FK→lists, text TEXT, status TEXT CHECK('open','done'), created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
```

---

## API Surface

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account (email, password, display_name) |
| POST | `/api/auth/login` | Return JWT access token |

### Lists
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists` | All lists the current user owns or is a member of |
| POST | `/api/lists` | Create a new list |
| PATCH | `/api/lists/:id` | Rename a list (owner only) |
| DELETE | `/api/lists/:id` | Delete a list (owner only) |

### Entries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists/:id/entries` | All entries for a list |
| POST | `/api/lists/:id/entries` | Add an entry |
| PATCH | `/api/lists/:id/entries/:eid` | Update text or status |
| DELETE | `/api/lists/:id/entries/:eid` | Delete an entry |

### Sharing
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists/:id/members` | List all members (owner only) |
| POST | `/api/lists/:id/members` | Share list with a user by email |
| DELETE | `/api/lists/:id/members/:uid` | Revoke access (owner only) |

---

## Implementation Phases

### Phase 1 — T-001: Project Scaffold
- Initialise npm workspaces at repo root (`frontend`, `backend` packages)
- Frontend: `npm create vite@latest` with React template; add ESLint, Prettier, `vite-plugin-pwa` dependency (configure later in T-007)
- Backend: Express + `pg` + `dotenv` + `bcrypt` + `jsonwebtoken`; nodemon for dev
- `docker-compose.yml` with `postgres:16` service, named volume, env vars
- Root `package.json` scripts: `dev`, `build`, `lint`, `test`
- Shared `.env.example` with `DATABASE_URL`, `JWT_SECRET`, `PORT`
- Verify: `npm run build` and `npm run lint` pass on empty scaffold

### Phase 2 — T-002: Database Schema & Migrations
- Add `node-pg-migrate` to backend
- Write migrations for all four tables (`users`, `lists`, `list_members`, `entries`)
- Add `npm run migrate` script in backend
- Add `npm run db:seed` script with one demo user and one demo list for local dev
- Verify: migrations run cleanly on a fresh Docker PostgreSQL instance

### Phase 3 — T-003: Authentication
**Backend:**
- `POST /api/auth/register` — hash password with bcrypt (cost 12), insert user, return 201
- `POST /api/auth/login` — verify password, sign JWT (payload: `{ sub: userId }`), return token
- `src/middleware/auth.js` — verify JWT, attach `req.user`; return 401 on missing/invalid token

**Frontend:**
- `AuthContext` — stores JWT in `localStorage`, exposes `user`, `login()`, `logout()`, `register()`
- `LoginPage` and `RegisterPage` with form validation
- `ProtectedRoute` wrapper that redirects to `/login` when unauthenticated
- React Router v6 routes: `/login`, `/register`, `/` (overview), `/lists/:id`

### Phase 4 — T-004: List Management
**Backend:**
- `GET /api/lists` — join `lists` + `list_members`, return rows where `owner_id = me OR user_id = me`; include `is_owner` boolean
- `POST /api/lists` — insert list with `owner_id = req.user.sub`
- `PATCH /api/lists/:id` — update name; verify caller is owner, 403 otherwise
- `DELETE /api/lists/:id` — cascade-delete entries + members; verify caller is owner

**Frontend:**
- `OverviewPage` — fetches and displays all lists; shows shared-list indicator (e.g. people icon) for lists where `is_owner = false`
- Create list: inline input or modal, POST on Enter/submit
- Rename list: inline edit triggered by long-press or edit icon
- Delete list: confirmation dialog before DELETE call
- Navigate to `ListDetailPage` on list tap

### Phase 5 — T-005: Entry Management
**Backend:**
- `GET /api/lists/:id/entries` — verify caller is member or owner; return all entries ordered by `status ASC, created_at ASC` (open first)
- `POST /api/lists/:id/entries` — insert entry with `status = 'open'`
- `PATCH /api/lists/:id/entries/:eid` — update `text` and/or `status`; set `updated_at = NOW()`
- `DELETE /api/lists/:id/entries/:eid` — delete entry; verify caller is member or owner

**Frontend:**
- `ListDetailPage` — two sections: open entries (top), done entries (bottom, collapsible or always visible)
- Fast input: text field at top; pressing Enter submits entry and immediately refocuses the input
- Tap entry row → toggle status (open ↔ done); entry animates to correct section
- Swipe-to-delete or delete icon on entry row
- Inline text edit on double-tap or edit icon

### Phase 6 — T-006: List Sharing
**Backend:**
- `GET /api/lists/:id/members` — return all members with `display_name`, `email`, `joined_at`; owner-only
- `POST /api/lists/:id/members` — look up user by email; insert `list_members` row; 404 if email not found; 409 if already member; owner-only
- `DELETE /api/lists/:id/members/:uid` — remove member; owner cannot remove themselves; owner-only

**Frontend:**
- Share panel accessible from `ListDetailPage` header (e.g. share icon)
- Email input to add a member; inline error for unknown email / already member
- Member list with display_name; revoke button per member (owner only)
- Shared-list badge in `OverviewPage` (people icon, tooltip with owner name)

### Phase 7 — T-007: PWA & Offline Support
**Service Worker (vite-plugin-pwa / Workbox):**
- Precache app shell (JS bundles, CSS, icons)
- Runtime cache for API GET responses (stale-while-revalidate strategy)

**IndexedDB (via `idb` library):**
- Mirror `lists` and `entries` responses into IndexedDB on successful fetch
- On network failure, serve reads from IndexedDB cache

**Offline write queue:**
- When a write (POST/PATCH/DELETE) fails due to network error, enqueue operation in IndexedDB `offline_queue` store
- `OfflineQueueContext` listens to `window online` event; on reconnect, drain queue in order, then refresh data
- Visual indicator in UI when offline (e.g. banner "Offline – Änderungen werden synchronisiert")

**Manifest:**
- `manifest.webmanifest` with `name`, `short_name`, `icons` (192px, 512px), `theme_color`, `display: standalone`, `start_url`
- App is installable on Chrome (Android/Desktop) and Safari (iOS Add to Home Screen)

---

## Acceptance Criteria

- [ ] A new user can register and log in; JWT is stored and sent on all subsequent requests
- [ ] A logged-in user can create, rename, and delete their own lists
- [ ] A logged-in user can add, toggle, and delete entries in any list they have access to
- [ ] Pressing Enter after typing an entry immediately submits it and refocuses the input field
- [ ] Done entries appear in a separate section below open entries
- [ ] A list owner can share a list with another registered user by email; the recipient sees it in their overview
- [ ] A list owner can revoke a member's access
- [ ] Shared lists are visually distinguishable in the overview
- [ ] The app is fully usable without a network connection (reads served from IndexedDB)
- [ ] Write operations performed offline are queued and synced automatically when connectivity returns
- [ ] The app passes Lighthouse PWA audit (installable, Service Worker registered, manifest present)
- [ ] `npm run lint`, `npm run build`, and `npm test` all pass

---

## Validation Commands

```bash
npm run lint
npm run build
npm test
```
