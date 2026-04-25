# ROADMAP

Goal: Fix the failing Release Please CI workflow on GitHub Actions.

## Priority 1

Objective: Restore a green CI pipeline on every push to `main`.

- Release Please runs without crashing on existing commit history.
- A `.release-please-manifest.json` is present at the repo root to bootstrap the version state.
- A `v0.1.0` git tag exists on `main` as the release baseline, ensuring release-please never scans the broken `Release-As:` footers in older commits.
- All three CI jobs (`lint-and-build`, `unit-test`, `e2e`) continue to pass.
