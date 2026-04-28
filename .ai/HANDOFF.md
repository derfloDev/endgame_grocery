# HANDOFF

Append-only role handoff log. Each role adds one entry when its step is complete.

## Entry Template

Each entry uses this exact structure. Omit fields marked as role-specific when they do not apply.

---

### T-006 — implement — 2026-04-28T17:39:39Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-006 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `fix(ci): trigger Docker publish from GitHub releases` |
| Next Role | none |

---

### T-006 — implement — 2026-04-28T17:34:36Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Split Docker publishing out of the Release Please workflow into a dedicated release-triggered workflow, added an automated regression test for the workflow contract, and updated the CI/CD documentation to match the new publish path. |
| Files Changed | `.ai/TASKS.md`, `.github/workflows/docker-publish.yml`, `.github/workflows/release-please.yml`, `README.md`, `backend/src/releaseWorkflow.test.js` |
| Validation | `npm run test --workspace backend -- src/releaseWorkflow.test.js` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS |
| Commit | `fix(ci): trigger Docker publish from GitHub releases` |
| Next Role | review |

---

### T-005 — implement — 2026-04-28T17:26:31Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-005 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `feat(notifications): add shared list push alerts` |
| Next Role | none |

---

### T-005 — implement — 2026-04-28T17:19:45Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Added shared-list push notifications with Web Push subscription endpoints, queued batching and cooldown delivery, a custom injectManifest service worker, list-level opt-in UI, and documentation for the new VAPID configuration. |
| Files Changed | `.ai/TASKS.md`, `.env.example`, `README.md`, `backend/package.json`, `backend/src/app.js`, `backend/src/db/migrations.test.js`, `backend/src/db/migrations/1713920400000_add_push_tables.cjs`, `backend/src/entries.test.js`, `backend/src/env.js`, `backend/src/env.test.js`, `backend/src/push.test.js`, `backend/src/pushWorker.test.js`, `backend/src/routes/entries.js`, `backend/src/routes/push.js`, `backend/src/workers/pushWorker.js`, `docker-compose.example.yml`, `docker-compose.yml`, `frontend/src/api/push.js`, `frontend/src/app.test.jsx`, `frontend/src/hooks/usePushNotifications.js`, `frontend/src/hooks/usePushNotifications.test.js`, `frontend/src/pages/ListDetailPage.jsx`, `frontend/src/sw/service-worker.js`, `frontend/src/vite-config.test.js`, `frontend/vite.config.js`, `package-lock.json` |
| Validation | `npm run test --workspace backend -- src/env.test.js src/db/migrations.test.js src/entries.test.js src/push.test.js src/pushWorker.test.js` PASS; `npm run test --workspace frontend -- src/app.test.jsx src/hooks/usePushNotifications.test.js src/vite-config.test.js` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS |
| Commit | `feat(notifications): add shared list push alerts` |
| Next Role | review |

---

### T-005 — review — 2026-04-28T18:05:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-005 push notifications: all plan deliverables present, all 6 acceptance criteria met, 76 backend tests pass (+7 new) and 93 frontend tests pass (+6 new); npm run build succeeds with injectManifest producing dist/service-worker.js; two nits (cleanup function not stored, setVapidDetails called per tick) — no blocking findings. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-006 — review — 2026-04-28T18:15:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-006 Docker publish pipeline fix: docker-publish.yml created with correct `on: release: types: [published]` trigger and all required action steps; release-please.yml stripped of docker-publish job and outputs block; 2 new release workflow tests pass; lint, build, and full test suite clean. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS |
| Blocking Findings | none |
| Next Role | implement |

---

### <TASK_ID> — <ROLE> — <YYYY-MM-DDTHH:MM:SSZ>

| Field | Value |
|-------|-------|
| Agent | claude \| codex |
| Summary | One-sentence description of work done |
| Files Changed | Comma-separated list of changed files |
| Validation | Commands run and outcomes (implement only) |
| Commit | `<hash> <conventional commit message>` (implement only) |
| Verdict | PASS \| PASS_WITH_NOTES \| FAIL (review only) |
| Blocking Findings | Numbered list or "none" (review only) |
| Next Role | plan \| implement \| review \| none |

---

### T-001..T-005 — plan — 2026-04-28T00:00:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Planned all five notifications/mail modules: mail infrastructure (T-001), e-mail verification (T-002), password reset (T-003), list-sharing invitations (T-004), push notifications (T-005); wrote PLAN.md and TASKS.md; all tasks set to ready_for_implement. |
| Files Changed | `ROADMAP.md`, `.ai/PLAN.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Next Role | implement |

---

### T-001 — implement — 2026-04-28T14:11:52Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Added the backend SMTP mailer foundation, expanded environment/config documentation, and covered the new config + template rendering contract with tests. |
| Files Changed | `.ai/TASKS.md`, `.env.example`, `README.md`, `backend/package.json`, `backend/src/env.js`, `backend/src/env.test.js`, `backend/src/mail/mailer.js`, `backend/src/mail/mailer.test.js`, `backend/src/mail/templates/base.hbs`, `docker-compose.example.yml`, `docker-compose.yml`, `package-lock.json` |
| Validation | `npm run test --workspace backend -- src/env.test.js src/mail/mailer.test.js` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS on rerun after one transient frontend timeout in `src/app.test.jsx` |
| Commit | `feat(mail): add SMTP mailer infrastructure` |
| Next Role | review |

---

### T-001 — review — 2026-04-28T14:22:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-001 mail infrastructure: all plan deliverables present, all 7 SMTP/URL env fields confirmed, lint clean, 130 tests pass; one nit on comment placement in docker-compose.yml — no blocking findings. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-002 — implement — 2026-04-28T15:11:22Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Added email verification end-to-end across auth routes, schema migration, mail templates, public verification UI, and documentation so new accounts must verify before login. |
| Files Changed | `.ai/TASKS.md`, `README.md`, `backend/src/auth.test.js`, `backend/src/db/migrations.test.js`, `backend/src/db/migrations/1713909600000_add_email_verification.cjs`, `backend/src/mail/templates/verification.hbs`, `backend/src/routes/auth.js`, `frontend/src/App.jsx`, `frontend/src/api/auth.js`, `frontend/src/app.test.jsx`, `frontend/src/context/AuthContext.jsx`, `frontend/src/pages/RegisterPage.jsx`, `frontend/src/pages/VerifyEmailPage.jsx` |
| Validation | `npm run test --workspace backend -- src/auth.test.js src/db/migrations.test.js` PASS; `npm run test --workspace frontend -- src/app.test.jsx` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS |
| Commit | `feat(auth): require email verification before login` |
| Next Role | review |

---

### T-002 — review — 2026-04-28T15:22:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-002 email verification: all plan deliverables present, all acceptance criteria met, 6 new backend tests + 3 new frontend tests pass; one minor finding (non-transactional register handler) — no blocking findings. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-007 — plan — 2026-04-28T18:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Diagnosed `npm run migrate` failure: `pending_push_jobs.items` column uses `DEFAULT ARRAY[]` which PostgreSQL rejects without a type annotation; fix is to change the default to `'[]'::jsonb` in the migration file. |
| Files Changed | `.ai/PLAN.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Next Role | implement |

---

### T-006 — plan — 2026-04-28T14:30:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Diagnosed missing v0.4.0 Docker image: release-please v17.6.0 creates the GitHub Release on PR-open rather than PR-merge, causing `release_created` to always be false on merge; planned T-006 to split docker-publish into a dedicated workflow triggered by `on: release: types: [published]`. |
| Files Changed | `.ai/PLAN.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Next Role | implement |

---

### T-001 — implement — 2026-04-28T14:16:57Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-001 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `feat(mail): add SMTP mailer infrastructure` |
| Next Role | none |

---

### T-002 — implement — 2026-04-28T15:18:08Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-002 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `feat(auth): require email verification before login` |
| Next Role | none |

---

### T-004 — review — 2026-04-28T15:50:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-004 list-sharing invitations: all plan deliverables present, all 7 acceptance criteria met, 7 new backend tests + 2 new frontend tests pass; no findings — clean PASS. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS |
| Blocking Findings | none |
| Next Role | implement |

---

### T-003 — review — 2026-04-28T15:35:00Z

| Field | Value |
|-------|-------|
| Agent | claude |
| Summary | Reviewed T-003 password reset: all plan deliverables present, all acceptance criteria met, 5 new backend tests + 3 new frontend tests pass; one nit on ForgotPasswordPage showing errors on network faults instead of always-success notice — no blocking findings. |
| Files Changed | `.ai/REVIEW.md`, `.ai/TASKS.md`, `.ai/HANDOFF.md` |
| Verdict | PASS_WITH_NOTES |
| Blocking Findings | none |
| Next Role | implement |

---

### T-003 — implement — 2026-04-28T15:24:44Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Added password reset end-to-end across auth routes, schema migration, mail templates, public forgot/reset UI, and documentation so verified users can request and apply one-time reset links. |
| Files Changed | `.ai/TASKS.md`, `README.md`, `backend/src/auth.test.js`, `backend/src/db/migrations.test.js`, `backend/src/db/migrations/1713913200000_add_password_reset_tokens.cjs`, `backend/src/mail/templates/password-reset.hbs`, `backend/src/routes/auth.js`, `frontend/src/App.jsx`, `frontend/src/api/auth.js`, `frontend/src/app.test.jsx`, `frontend/src/pages/ForgotPasswordPage.jsx`, `frontend/src/pages/LoginPage.jsx`, `frontend/src/pages/ResetPasswordPage.jsx` |
| Validation | `npm run test --workspace backend -- src/auth.test.js src/db/migrations.test.js` PASS; `npm run test --workspace frontend -- src/app.test.jsx` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS |
| Commit | `feat(auth): add password reset flow` |
| Next Role | review |

---

### T-003 — implement — 2026-04-28T15:35:59Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-003 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `feat(auth): add password reset flow` |
| Next Role | none |

---

### T-004 — implement — 2026-04-28T16:57:37Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Replaced direct list-member adds with invite-based sharing, added invite acceptance and invite-backed signup, wired the new public invite page into the auth flow, and documented the updated sharing behavior. |
| Files Changed | `.ai/TASKS.md`, `README.md`, `backend/src/app.js`, `backend/src/auth.test.js`, `backend/src/db/migrations.test.js`, `backend/src/db/migrations/1713916800000_add_list_invites.cjs`, `backend/src/inviteService.js`, `backend/src/invites.test.js`, `backend/src/mail/templates/invite-existing.hbs`, `backend/src/mail/templates/invite-new.hbs`, `backend/src/mail/templates/revocation.hbs`, `backend/src/routes/auth.js`, `backend/src/routes/invites.js`, `backend/src/routes/sharing.js`, `backend/src/sharing.test.js`, `frontend/src/App.jsx`, `frontend/src/api/sharing.js`, `frontend/src/app.test.jsx`, `frontend/src/components/ShareListSheet.jsx`, `frontend/src/pages/InviteAcceptPage.jsx`, `frontend/src/pages/ListDetailPage.jsx`, `frontend/src/pages/LoginPage.jsx`, `frontend/src/pages/RegisterPage.jsx` |
| Validation | `npm run test --workspace backend -- src/auth.test.js src/sharing.test.js src/invites.test.js src/db/migrations.test.js` PASS; `npm run test --workspace frontend -- src/app.test.jsx` PASS; `npm run lint` PASS (existing frontend warning in `frontend/src/context/AuthContext.jsx`); `npm run build` PASS (existing Vite warning about `onnxruntime-web` eval usage); `npm test` PASS |
| Commit | `feat(sharing): add invite-based list sharing flow` |
| Next Role | review |

---

### T-004 — implement — 2026-04-28T17:02:53Z

| Field | Value |
|-------|-------|
| Agent | codex |
| Summary | Advanced T-004 from approved review to committed state and marked the task done on the board. |
| Files Changed | `.ai/HANDOFF.md`, `.ai/TASKS.md` |
| Validation | Reused reviewed validation from the approved `next_task` implementation; no additional commands run during `commit_task`. |
| Commit | `feat(sharing): add invite-based list sharing flow` |
| Next Role | none |

---
