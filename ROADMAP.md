# ROADMAP

Goal: add donation support and document the vibe-coded origin of this project.

## Priority 1 — README & Repo Donation Links

Objective: make it easy for visitors to support the project directly from the GitHub repo page.

- Add a "Buy Me a Coffee" badge and link to `README.md`.
- Add a GitHub Sponsors badge and link to `README.md`.
- Create `.github/FUNDING.yml` so GitHub shows the built-in "Sponsor" button on the repo page.
- Add a short "Built with" / vibe-coded section to `README.md` crediting aide/agentinit (https://github.com/riadshalaby/agentinit).

## Priority 2 — In-App Donation Link

Objective: let users support the project from inside the app under "Info & Settings".

- Add a "Buy Me a Coffee" image-link (`https://www.buymeacoffee.com/derflodev`) to `InfoSheet.jsx`.
- Style the link to fit the existing bottom-sheet layout.
- Update `InfoSheet.test.jsx` to assert the link is rendered.
