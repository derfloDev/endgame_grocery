# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **complete**

Reviewed: 2026-10-14

#### Findings
1. **nit** — `docs/SETUP.md:73`, `docs/SETUP.md:143` — The moved headings "7. Generate VAPID keys…" and "8. Verify the setup" keep their original step numbers, but steps 1–6 now live in `docs/DEVELOPMENT.md`. This is intentional under the plan's "keep original heading text" rule. Not a required fix. Consider dropping the numbers in a follow-up.
2. **nit** — `docs/SETUP.md` ("Verify the live PWA rollout") — Still says detailed checks "remain in ROADMAP.md", which is now a different document. The plan says to keep this verbatim and flag it. Not a required fix. Flag to the user for a follow-up.
3. **nit** — `docs/SETUP.md` ("Production nginx behavior") — The hashed `/assets/*` sentence is still repeated twice. This is verbatim pre-existing duplication that the plan asked to flag, not fix. Not a required fix.
4. **nit** — `README.md:16` — The README adds one tagline sentence ("Plan, share and tick off groceries together…") beyond the plan's literal outline. The implementer disclosed it. It is harmless and consistent with the Features section. Not a required fix.

No blocker or major findings. No required fixes.

#### Verification
##### Steps
- Re-read `.ai/TASKS.md`, `.ai/PLAN.md`, `.ai/HANDOFF.md` and `.ai/REVIEW.md`. Set T-001 to `in_review`.
- Reviewed the working tree with `git status`, `git diff --stat` and file reads. `README.md` is 70 lines (limit about 120). `docs/SETUP.md` is 339 lines and `docs/DEVELOPMENT.md` is 407 lines. Both are staged as new files.
- Wrote an independent throwaway lossless script in the scratchpad (not the implementer's):
  - Compared every non-empty, non-heading line of `git show HEAD:README.md` against the union of the three new files.
  - Result: **0 missing lines**, and no line occurs fewer times than in the original (0 count-short lines).
  - Only the headings "Screenshots" and "Feature Overview" are absent. The plan replaces them with Features and "Behavior and API reference".
- Link check over all three files: relative file links, `src` images (`endgame_grocery_logo.png`, `assets/demo_*.png`, `../LICENSE`, `../.env.example`, `../docker/nginx.conf`, `../docker-compose.example.yml`) and in-page and cross-doc anchors. Result: **0 broken**.
- Checked the README structure: Features is the first section after the title. The Quick start matches `docker-compose.example.yml` (it exists, exposes port `80:80` and uses `change-me` placeholders). The badge block and the `## License` paragraph are unchanged, and `backend/src/license.test.js` is unmodified.
- Fact-checked the README feature bullets against the original README text: invites by email, typo-tolerant autocomplete, recently used, local icon suggestion, push batching, offline queue, EN/DE, Home Assistant API key, `/api/docs/`, rate limiting and security headers. All are supported.
- Reviewed the diff of the four code comments (`docker/security-headers.conf`, `backend/src/containerHardening.test.js`, `backend/src/sseTickets.js`, `frontend/vite.config.ts`). Each is a comment-only change pointing to a real section: CSP and `blob:` in Security hardening, the "run one backend instance" statement in Push notifications, and the stale-worker and Access text in Cloudflare and reverse proxy. A repo-wide search finds no remaining "see README" in code.
- Ran `npm run lint`: exit 0 with 1 pre-existing react-refresh warning and 0 errors. Ran `npm run build`: success. Ran `npm test`: frontend 62 files and 914 tests passed, backend 421 tests passed with 0 failures, including the 2 license tests.
- Manual check: confirmed the "Reading note" lines in `docs/SETUP.md` and the "Verify the installation" lead-in link to the real targets in `docs/DEVELOPMENT.md`. The location-dependent wording ("below" and "above") is otherwise untouched, as planned.
##### Findings
- All acceptance criteria are met: README is under 120 lines with Features first plus a quick start, nothing was lost, links and images resolve, the license test is unchanged and passing, only the four planned comments changed in code, and lint, build and tests are green.
- The implementer's handoff claims (0 missing lines, 0 broken links, 914 and 421 tests) were reproduced independently.
##### Risks
- External deep links to old README anchors (for example `#cloudflare-access-public-pwa-resources`) will break, because those sections moved to other files. This is inherent in the split. Headings were kept to make remapping easy. Check for external references (issues, wiki) if any exist.
- `ROADMAP.md` and `.ai/*` are also modified in the working tree. This is expected planning and workflow bookkeeping. Commit them together under `commit_task`.
- Git reports an LF to CRLF conversion warning (autocrlf) for the changed files. This is pre-existing behavior and not a defect.

#### Open Questions
- None.

#### Verdict
`PASS_WITH_NOTES`
