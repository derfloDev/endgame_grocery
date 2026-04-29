# Plan

Status: **ready_for_implement**

Goal: Fix the CI/CD pipeline so that a Release Please release triggers the Docker Publish workflow.

## Background

GitHub Actions does not allow workflows triggered by `GITHUB_TOKEN` to fire downstream workflow events. Release Please was using the default `GITHUB_TOKEN`, so the `release: published` event it emitted was silently ignored and the Docker Publish workflow never ran.

The fix is to supply a fine-grained PAT (`RELEASE_PLEASE_TOKEN`) to the Release Please action. Releases created with a PAT are treated as real user events and correctly fire the `release: published` trigger.

## Scope

- `.github/workflows/release-please.yml` — add `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}` to the `googleapis/release-please-action` step.

No other files change. `docker-publish.yml` and `ci.yml` remain untouched.

## Acceptance Criteria

- After the next merge to `main` that CI passes on, Release Please creates (or updates) its PR using the PAT.
- When that PR is merged and Release Please publishes the GitHub Release, the Docker Publish workflow is triggered and builds/pushes the image to `ghcr.io/derfloDev/endgame-grocery`.

## Implementation Phases

### Phase 1 — Patch release-please.yml
- In `.github/workflows/release-please.yml`, add `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}` under the `with:` block of the `googleapis/release-please-action@v5` step.

## Validation

- `npm run lint` — no code change, expected pass
- Verify the YAML is syntactically valid (can be done with `npx js-yaml .github/workflows/release-please.yml` or equivalent)
