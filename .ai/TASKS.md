# TASKS

Use this board to coordinate handoff between planner, implementer, and reviewer.

Status values:
- `in_planning`
- `ready_for_implement`
- `in_implementation`
- `ready_for_review`
- `in_review`
- `ready_to_commit`
- `changes_requested`
- `done`

Command expectations:
- planner moves tasks into `in_planning` and `ready_for_implement`
- implementer moves tasks into `in_implementation`, `ready_for_review`, and `done`, and resumes work from `changes_requested` and `ready_to_commit`
- reviewer moves tasks into `in_review`, `ready_to_commit`, or `changes_requested`
- `status_cycle` should report deterministic task status, current owner role, and next recommended action based on this board

| Task ID | Scope | Status | Acceptance Criteria | Evidence | Next Role |
| --- | --- | --- | --- | --- | --- |
| T-001 | Mail + package infrastructure: install nodemailer + handlebars, create mailer module, base Handlebars template, extend env.js with SMTP + APP_BASE_URL, document env vars in docker-compose.yml | done | `getConfig()` returns all 7 new SMTP/URL fields; `mailer.send()` resolves against a real SMTP server; docker-compose.yml contains all 7 env var names as comments; `npm run lint` passes | `npm run lint`, `npm run build`, `npm test`, targeted backend env+mailer tests passed | none |
| T-002 | E-mail verification: DB migration (email_verified column + email_verification_tokens table), update register/login endpoints, add verify-email + resend endpoints, verification.hbs template, VerifyEmailPage, update RegisterPage + AuthContext + App routes | done | New registration sends verification mail and returns no JWT; login with unverified account returns 403; valid token issues JWT and sets email_verified=true; expired/invalid token returns 400; existing DB users remain verified after migration | `npm run lint`, `npm run build`, `npm test`, targeted backend auth+migration tests, targeted frontend app auth tests passed | none |
| T-003 | Password reset: DB migration (password_reset_tokens table), forgot-password + reset-password endpoints, password-reset.hbs template, ForgotPasswordPage + ResetPasswordPage, LoginPage forgot-password link, App routes | done | Forgot-password for unknown email returns 200 with no mail sent; reset link expires after 60 min; used token rejected with 400; successful reset allows login with new password | `npm run lint`, `npm run build`, `npm test`, targeted backend auth+migration tests, targeted frontend app auth tests passed | none |
| T-004 | List sharing via invitation: DB migration (list_invites table), replace direct-add with invite flow in sharing route, add revocation mail to DELETE, new invites route, register invite_token in register endpoint, 3 mail templates, InviteAcceptPage, update RegisterPage + LoginPage + ShareListSheet + App routes | done | POST /members creates invite row and sends mail instead of adding member; existing user clicks invite link → added to list; new user registers via invite → email_verified=true + JWT + auto-added to list; invite expires after 7 days; duplicate invite resets token; revocation sends mail; ShareListSheet shows "invitation sent" | `npm run test --workspace backend -- src/auth.test.js src/sharing.test.js src/invites.test.js src/db/migrations.test.js`, `npm run test --workspace frontend -- src/app.test.jsx`, `npm run lint`, `npm run build`, `npm test` | none |
| T-005 | Push notifications: install web-push, DB migration (push_subscriptions + pending_push_jobs + push_cooldowns), push route, push worker with setInterval + batching + cooldown, hook entries POST, VAPID env vars, switch vite PWA to injectManifest + custom SW, usePushNotifications hook, push API module, push opt-in toggle on ListDetailPage | done | Subscribe/unsubscribe endpoints persist rows; single entry → push within ≤10 min; 3 entries in 5-min window → one batched notification; actor excluded; 15-min cooldown suppresses second notification; toggle only on shared lists; npm run build passes | `npm run test --workspace backend -- src/env.test.js src/db/migrations.test.js src/entries.test.js src/push.test.js src/pushWorker.test.js`, `npm run test --workspace frontend -- src/app.test.jsx src/hooks/usePushNotifications.test.js src/vite-config.test.js`, `npm run lint`, `npm run build`, `npm test` | none |
| T-006 | Fix Docker publish pipeline: split docker-publish out of release-please.yml into a dedicated docker-publish.yml triggered by `on: release: types: [published]`; remove docker-publish job from release-please.yml | ready_for_implement | Merging a future release PR causes a Docker image to be built and pushed to GHCR without manual intervention; release-please.yml no longer contains docker-publish job; docker-publish.yml exists and triggers on release published event | n/a | implement |
