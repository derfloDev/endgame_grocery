# Plan

Status: **ready**

Goal: Fix the Release Please CI failure, gate releases on CI success, and eliminate all deprecated-action warnings.

## Root Cause

### Problem 1 — Release Please crash
Commits on `main` contain `Release-As: chore/dockerize` and `Release-As: fix/registration` footers (branch names instead of valid semver versions). Because no git tag exists, release-please scans all commits from the beginning of history and crashes:

```
release-please failed: unable to parse version string: chore/dockerize
```

### Problem 2 — No CI gate before release
`ci.yml` and `release-please.yml` both trigger independently on `push` to `main`. A failing CI run does not block release-please from tagging a new version and publishing a Docker image.

### Problem 3 — Deprecated GitHub Actions (deadline: 2 June 2026)
All workflows reference actions that bundle Node.js 20 as their runtime. GitHub will force Node.js 24 by default on 2 June 2026, breaking these actions. Additionally, `google-github-actions/release-please-action` has been deprecated in favour of `googleapis/release-please-action`.

---

## Scope

### T-001 — Fix Release Please bootstrap

**Fix strategy:**
1. Tag `v0.1.0` on current `main` HEAD (`83d6da1`) → cutoff point so release-please only considers commits _after_ this tag and never reads the broken historical footers.
2. Add `.release-please-manifest.json` to the repo root → explicit version bootstrap (`0.1.0`) so release-please does not need to derive the version from commit history.

**Files to create:**
- `.release-please-manifest.json` — version manifest consumed by release-please, content: `{"." : "0.1.0"}`

**Shell commands the implementer must run (in order):**
```bash
git tag v0.1.0 83d6da1
git push origin v0.1.0
```

**Acceptance criteria:**
- `.release-please-manifest.json` exists at repo root with content `{"." : "0.1.0"}`
- Tag `v0.1.0` pushed to GitHub and visible via `gh api repos/derfloDev/endgame_grocery/tags`
- Release Please workflow passes (green) on the next push to `main` after this branch is merged

---

### T-002 — Gate release on CI success

**Fix strategy (Option A — `workflow_run` trigger):**

Change `release-please.yml` so it no longer triggers on `push` but instead on `workflow_run` completion of the `CI` workflow on the `main` branch. Add an `if` condition so the release-please job only executes when CI concluded with `success`.

**Files to change:**
- `.github/workflows/release-please.yml`

**Exact changes:**

Replace the `on` trigger:
```yaml
# Before
on:
  push:
    branches:
      - main

# After
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

Add `if` condition to the `release-please` job:
```yaml
jobs:
  release-please:
    runs-on: ubuntu-latest
    if: github.event.workflow_run.conclusion == 'success'
```

The `docker-publish` job already gates on `release-please` via `needs`, so no further changes are required there.

**Acceptance criteria:**
- `release-please.yml` trigger is `workflow_run` (not `push`)
- `release-please` job has `if: github.event.workflow_run.conclusion == 'success'`
- A push to `main` where CI fails does NOT trigger a new release or Docker image build
- A push to `main` where CI passes DOES trigger release-please as before

---

### T-003 — Update deprecated GitHub Actions

**Fix strategy:**
Update all action references in both workflow files to their latest Node.js 24-compatible versions. Replace the deprecated `google-github-actions/release-please-action` with `googleapis/release-please-action`.

**Files to change:**
- `.github/workflows/ci.yml`
- `.github/workflows/release-please.yml`

**Version changes:**

| File | Old | New |
|------|-----|-----|
| `ci.yml` | `actions/checkout@v4` | `actions/checkout@v6` |
| `ci.yml` | `actions/setup-node@v4` | `actions/setup-node@v6` |
| `ci.yml` | `actions/upload-artifact@v4` | `actions/upload-artifact@v7` |
| `release-please.yml` | `google-github-actions/release-please-action@v4` | `googleapis/release-please-action@v5` |
| `release-please.yml` | `actions/checkout@v4` | `actions/checkout@v6` |
| `release-please.yml` | `docker/login-action@v3` | `docker/login-action@v4` |
| `release-please.yml` | `docker/metadata-action@v5` | `docker/metadata-action@v6` |
| `release-please.yml` | `docker/build-push-action@v5` | `docker/build-push-action@v7` |

Note: T-002 and T-003 both modify `release-please.yml`. The implementer applies all changes to that file in a single edit.

**Acceptance criteria:**
- No Node.js 20 deprecation warnings in any GitHub Actions run
- No `google-github-actions/release-please-action is deprecated` warning
- All CI jobs (`lint-and-build`, `unit-test`, `e2e`) continue to pass
- Release Please workflow continues to function correctly

---

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
- After merging to `main`: confirm all GitHub Actions runs are green with no deprecation warnings
