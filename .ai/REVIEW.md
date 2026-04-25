# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

No blockers or majors. One nit noted.

| # | Severity | Location | Description | Required fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `.release-please-manifest.json` | File ends with a trailing newline after the JSON content — this is harmless and conventional for text files but could be trimmed for strict JSON tooling. | No |

#### Verification

##### Steps
1. Read `.ai/PLAN.md` — confirmed plan calls for `.release-please-manifest.json` with `{"." : "0.1.0"}` and tag `v0.1.0` on commit `83d6da1`.
2. Verified `.release-please-manifest.json` exists at repo root with content `{"." : "0.1.0"}` — matches plan exactly.
3. Ran `git tag --list "v0.1.0"` — tag `v0.1.0` confirmed locally.
4. Ran `git ls-remote --tags origin v0.1.0` — confirmed `v0.1.0` resolves to `83d6da1af73cf2533b9ff6653debc3edc1855e21` on `origin`, matching the plan's target commit.
5. Ran `git show v0.1.0 --no-patch` — tag points to merge commit `83d6da1` (matches plan).
6. Reviewed `git diff HEAD` — only files changed are `.release-please-manifest.json` and `README.md`, matching HANDOFF entry.
7. Inspected `README.md` changes — bootstrap sentence accurately documents the manifest + tag strategy; no inaccuracies.
8. Ran `npm run lint` — 0 errors; 1 pre-existing warning in `frontend/src/context/AuthContext.jsx:77` (unrelated to T-001).
9. Ran `npm run build` — clean build for both frontend and backend.
10. Ran `npm test` — 25/25 tests pass, 0 failures.
11. Reviewed `.github/workflows/release-please.yml` — still uses `google-github-actions/release-please-action@v4` with `release-type: node`. With `v0.1.0` tag on `83d6da1`, release-please will only scan commits after that tag, eliminating the bad `Release-As: chore/dockerize` and `Release-As: fix/registration` footers that caused the crash. The manifest file provides additional version tracking. This aligns with the plan's fix strategy.

##### Findings
- All acceptance criteria met:
  - ✅ `.release-please-manifest.json` present with `{"." : "0.1.0"}`
  - ✅ Tag `v0.1.0` visible on remote `origin` at commit `83d6da1` (correct cutoff per plan)
  - ✅ Lint, build, and tests all pass
  - ⏳ "Release Please CI passes on next `main` push" — cannot be verified until branch is merged; prerequisites are correctly in place

##### Risks
- Low: The `release-please-action@v4` in simple mode (`release-type: node`) uses git tags as the version cutoff; the manifest file may not be read in this mode but does not cause any harm. The tag is the critical element of the fix, and it is correctly positioned. T-003 will update the action version which may affect manifest behaviour, but that is within T-003 scope.

#### Open Questions
- None.

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

No blockers, majors, or minors. One nit noted.

| # | Severity | Location | Description | Required fix |
|---|----------|----------|-------------|--------------|
| 1 | nit | `release-please.yml` line 19 | Implementation uses `if: ${{ github.event.workflow_run.conclusion == 'success' }}` with expression delimiters; plan shows bare `if: github.event.workflow_run.conclusion == 'success'`. Both are valid in GitHub Actions — the `${{ }}` form is actually the preferred style for `if` conditions. | No |

#### Verification

##### Steps
1. Re-read `.ai/PLAN.md` — confirmed exact `on:` block and `if:` condition expected.
2. Read `.github/workflows/release-please.yml` — trigger replaced from `push` → `workflow_run`; workflows matches `["CI"]`; types `[completed]`; branches `[main]`; `if` guard added to `release-please` job. All match plan.
3. Verified `.github/workflows/ci.yml` `name:` field is `CI` — exact string match with `workflows: ["CI"]` in the trigger; no mismatch.
4. Confirmed `docker-publish` job unchanged — it already gates on `needs: release-please` with its own `if` on `release_created`; plan states no further changes required there.
5. Reviewed `git diff HEAD` — only files changed are `.github/workflows/release-please.yml` and `README.md`, matching HANDOFF entry.
6. Inspected `README.md` changes — sentence correctly describes the `CI` gate, accurate and clear.
7. Ran `npm run lint` — 0 errors; 1 pre-existing unrelated warning.
8. Ran `npm run build` — clean build.
9. Ran `npm test` — 25/25 pass, 0 failures.

##### Findings
- All acceptance criteria met:
  - ✅ `release-please.yml` trigger is `workflow_run` (not `push`)
  - ✅ `release-please` job has `if` guarding on `conclusion == 'success'`
  - ✅ CI workflow name `CI` matches the trigger reference exactly
  - ✅ `docker-publish` remains gated via `needs` — no spurious publish path possible
  - ✅ README documents the CI gate
  - ✅ Lint, build, and tests pass
  - ⏳ "Failing CI run on `main` does not trigger release or Docker image" — cannot be live-tested without a PR merge; the logic is verified structurally above

##### Risks
- Low: `workflow_run` events fire for any branch matching `[main]` in the filter, but the `branches` key on `workflow_run` correctly restricts the triggering workflow's source branch to `main`. No cross-branch contamination risk.
- Low: If the `CI` workflow is renamed in the future, the `workflow_run` trigger will silently stop firing. This is an operational note, not a current defect.

#### Open Questions
- None.

#### Verdict
`PASS`
