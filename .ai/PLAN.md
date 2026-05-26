# Plan

Status: **ready_for_implement**

Goal: Add explicit branch filters to the CI workflow so builds on `main` are reliable and release-please triggers correctly after a PR merge.

## Background

`ci.yml` uses `on: push:` and `on: pull_request:` without branch filters. This means:
- CI runs on every push to **every** branch — including feature branches that are already covered by the `pull_request` trigger (double runs).
- After a PR is merged, whether a `main` CI run actually appears in the Actions UI is ambiguous without an explicit `branches: [main]` filter on the `push` trigger.
- `release-please.yml` is chained to the CI workflow via `workflow_run` and only fires when CI completes successfully on `main`. If the CI run for the merge commit on `main` is missed or cancelled, release-please never runs.

## Scope

One file change only. No application code, no test, no translation changes.

**File:** `.github/workflows/ci.yml`

**Change:** Replace the bare `push:` and `pull_request:` triggers with branch-filtered equivalents.

Before:
```yaml
on:
  push:
  pull_request:
```

After:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### Effect

| Scenario | Before | After |
|----------|--------|-------|
| Push to `main` (PR merge) | Runs (ambiguously) | Runs (explicitly) |
| Push to feature branch | Runs (unnecessary) | Does **not** run |
| PR opened/updated against `main` | Runs | Runs |
| PR opened against other branch | Runs | Does **not** run |
| release-please trigger after merge | Unreliable | Reliable |

## Acceptance Criteria

1. `ci.yml` has `branches: [main]` on both `push` and `pull_request` triggers.
2. No other changes to the workflow file.
3. `npm run lint` passes locally (workflow YAML is not linted by the app suite — the implementer should visually verify the YAML is valid).

## Validation

```
npm run lint
```

(Full CI validation requires a GitHub push — local lint is sufficient for this change.)
