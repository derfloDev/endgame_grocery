# ROADMAP

Goal: make the project documentation easy to navigate by separating what the app does, how to set it up, and how to develop it.

## Priority 1

Objective: restructure `README.md` into three clearly separated areas, with features first.

- `README.md` opens with the features (user-facing, concise), followed by a short quick start and links to the detailed docs.
- Setup documentation (installing, configuring, running, and operating the app) lives in `docs/SETUP.md`.
- Development documentation (local dev environment, tests, CI/CD, architecture and implementation notes) lives in `docs/DEVELOPMENT.md`.
- No existing technical fact is lost: detailed content moves, it is not deleted or rewritten.
- Behavior of the app and the code does not change; only documentation and code comments that point at README sections are updated.
