# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-10-15

#### Findings
1. **minor** — post-push CI evidence not yet available (`.github/workflows/ci.yml`, job `nginx-smoke-arm64`). The branch `fix/pipeline-timeout` is pushed only up to the cycle-start commit, there is no PR, and the changes are uncommitted, so the "job passes" and "rerun shows `[runtime 7/15] RUN npm ci --omit=dev` as `CACHED`" criteria cannot be checked locally. Not a required fix; it is the documented post-push verification point in PLAN.md. Check it on the PR after `commit_task`: the first run may miss the cache (branch-scoped cache), the rerun is the evidence.
2. **nit** — `readCiJob` in `backend/src/releaseWorkflow.test.js:15` uses a regex end-anchor `$(?![\s\S])` with the `m` flag. It is correct (verified: the final job extracts to end of file) but hard to read; no change required.

No blocker or major findings. No required fixes.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md` and `.ai/PLAN.md`; reviewed the working-tree diff of `ci.yml`, `releaseWorkflow.test.js` and `docs/DEVELOPMENT.md` against the T-001 acceptance criteria.
- `npm run lint`: PASS (0 errors; one pre-existing `AuthContext.tsx` Fast Refresh warning, unrelated).
- `npm run build`: PASS.
- `npm test`: PASS (985 frontend + 425 backend tests, 0 failures).
- `git diff --check`: clean (only the LF/CRLF working-copy warnings).
- Targeted run of `backend/src/releaseWorkflow.test.js`: 16/16 pass.
- Tests-first check: ran the new test file against the pre-change `ci.yml` (`git show HEAD:.github/workflows/ci.yml`) in a scratch copy. All 4 new `arm64 smoke job` tests fail there as expected. (A fifth failure, "provides the typecheck script", comes from the scratch copy lacking `package.json` and is not a real failure.)
- Parsed the changed `ci.yml` as YAML: the job has `timeout-minutes: 15`, the step order is checkout → setup-qemu → setup-buildx → build-push-action → "Check architecture and native bcrypt module" → smoke script, and the build-push-action inputs match the plan exactly (`context: .`, `platforms: linux/arm64`, `load: true`, `push: false`, `tags`, `cache-from`, `cache-to ...,mode=max`). Workflow `permissions` is still `contents: read` only.
- Confirmed the build-push-action SHA `c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7` is identical to `docker-publish.yml`.
- Confirmed the `ci.yml` diff is limited to the `nginx-smoke-arm64` comment, `timeout-minutes` and the replaced build step (three hunks); `docker-publish.yml`, `release-please.yml` and the `Dockerfile` are unchanged; the `nginx-smoke` (amd64) job is untouched.
- Confirmed the docs update in `docs/DEVELOPMENT.md` covers the cache, the lockfile/`package.json` re-run, the 15-minute limit and the rerun advice. The "arm64 variant" local commands are unchanged.
- Checked the `.github/workflows/ci.yml` comment: in English, explains the timeout, the cache scope with `mode=max` and the lockfile re-run.
##### Findings
- All acceptance criteria that can be checked locally are met. The diff matches the plan and contains no extra scope.
- Manual/E2E: a real `linux/arm64` image build with the GHA cache cannot run locally (it needs the Actions runtime cache token), so it is covered only by the YAML parse and structural tests above.
##### Risks
- The GHA cache and its token handling through `docker/build-push-action` v7 are only provable on a real runner. Mitigation: verify on the PR run and the rerun (`CACHED` for `npm ci --omit=dev`).
- First run on a new ref may miss the cache, so the build can still take about 3 minutes; the 15-minute timeout bounds a hang either way.
- A lockfile or `package.json` change re-runs the emulated install; only the timeout protects against a hang then (documented as a known limitation).

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
