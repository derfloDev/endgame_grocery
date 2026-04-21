# ROADMAP

Goal: Deliver a family-ready grocery list PWA with shared lists, user accounts, and full offline support.

## Tech Stack

- **Frontend:** React + Vite, vite-plugin-pwa (Service Worker, installable)
- **Backend:** Node.js (REST API)
- **Database:** PostgreSQL
- **Auth:** JWT-based (username/password)

## Data Model

- **User:** id, email, password_hash, display_name, created_at
- **List:** id, name, owner_id, created_at
- **ListMember:** list_id, user_id, joined_at (shared access)
- **Entry:** id, list_id, text, status (open | done), created_at, updated_at

## Priority 1 — Project Foundation & Authentication

Objective: Set up the full project scaffold and enable user registration and login.

- React + Vite frontend with PWA manifest and Service Worker baseline
- Node.js backend with PostgreSQL connection and database migrations
- User registration (email + password) and login endpoints
- JWT-based session management (access token)
- Protected route handling in the frontend
- Password hashing (bcrypt)

## Priority 2 — List Management

Objective: Users can create, rename, and delete their own lists; lists appear in a central overview.

- Main view: overview of all lists the user owns or has access to
- Create a new list (name input)
- Rename an existing list
- Delete a list (with confirmation)
- List detail view: shows all entries for a selected list

## Priority 3 — Entry Management

Objective: Users can manage items inside a list with fast input and clear status visualisation.

- Add entries to a list via text input; pressing Enter submits and immediately refocuses the input field for the next entry (NFA-30)
- Toggle entry status between open and done by tapping/clicking
- Done entries automatically move to a separate "Erledigt" section at the bottom of the list
- Edit entry text inline
- Delete an entry from the list

## Priority 4 — List Sharing

Objective: A list owner can share any list with other registered family members.

- Share a list with another user by their email address
- Shared users see the list in their own overview (alongside their own lists)
- All members (owner + shared users) have full read/write access to the list
- List owner can revoke access for individual members
- Shared lists are visually distinguishable from own lists in the overview (e.g. a shared icon)

## Priority 5 — PWA & Offline Support

Objective: The app works fully without an internet connection (NFA-20).

- Service Worker caches the app shell and static assets
- Offline-first reads: lists and entries are readable without network
- Write operations while offline are queued and synced when connectivity is restored
- App is installable on mobile and desktop (Web App Manifest)

---

## Out of Scope (V2)

These features are intentionally excluded from the MVP to keep scope focused:

- **Mengen & Einheiten:** e.g. "3x Milch" quantity fields on entries
- **Kategorien:** automatic sorting by supermarket aisle (Obst, Kühlregal, Drogerie)
- **Drag & Drop:** manual reordering of entries by the user
- **Push Notifications:** notify family members of list changes in real time
