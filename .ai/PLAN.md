# Plan

Status: **ready_for_implement**

Updated: 2026-10-12T06:20:59Z

Goal: restore notification opt-in in the installed Android PWA at `https://endgame-grocery.derflo.dev`.

User decision: option 1 — correct the confirmed cause, show understandable localized errors, and support retry without a page reload.

## T-001 — Restore notification opt-in and recovery

Owner role: `implement`. One task covers diagnosis, the correction, error/retry behavior, regression coverage and documentation so the fix can be reviewed together.

### Evidence and limits

- Android installations through Chrome and Brave show the same error after selecting "Benachrichtigung aktivieren"; reload does not help.
- `frontend/src/hooks/usePushNotifications.ts` requests permission and then races `navigator.serviceWorker.ready` against an eight-second timeout. The timeout message identifies a missing active registration, not the underlying cause.
- The hook's `isReady` currently means a VAPID key is present. Its initialization effect also depends on the key that it updates; inspect cancellation across that rerender when adding registration/subscription state.
- `frontend/src/sw/register.ts` invokes `useRegisterSW({ immediate: true })` through `UpdateBanner`, without exposing registration failure to the notification flow.
- The custom worker precaches the shell and handles push/click events. A registration, evaluation or precache-install failure could prevent activation; none has been confirmed.
- Public HTTP probes from the planner environment failed during TLS setup. This does not prove a production certificate fault. Whether the deployment uses Cloudflare Access remains unknown.
- Existing E2E configuration uses the Vite development server. A successful mocked hook test or dev-worker run cannot establish that the production worker installs.

### Scope and acceptance criteria

1. Record the failing worker lifecycle stage and evidence before choosing the cause-specific correction. For the deployed route and worker, distinguish missing registration, rejected registration, evaluation failure, failed installation/precache, and delayed activation. A timeout increase alone is not a correction.
2. With supported APIs, valid VAPID configuration and granted permission, opening a shared list and enabling notifications obtains an active worker, creates or reuses the browser subscription, persists it through the existing API, and shows the subscribed state.
3. Registration failure and activation timeout settle within a bounded wait and produce understandable messages in English and German. Do not advise a reload as the sole recovery step or display raw browser exception text to the user.
4. After a recoverable failure is removed, selecting the notification action again can retry registration/initialization and subscription successfully in the same page session. A persistent hosting/access failure still produces truthful feedback.
5. While an attempt is pending, prevent duplicate subscription attempts. Clear pending state on every outcome and clear obsolete push feedback after recovery.
6. Preserve the permission request's connection to the user's click; do not request permission automatically during background recovery. Denied permission must not cause repeated prompts. Distinguish unsupported push capability, absent VAPID configuration and worker failure.
7. Preserve shared-list toggle visibility, existing subscription detection, unsubscribe behavior, push delivery/click navigation, offline shell behavior and the current update flow.
8. Add tests before implementation for every changed behavior and the confirmed cause. Verify production worker registration, installation and activation in a real browser with a clean context; document Android Chrome/Brave results separately.
9. Update the affected README instructions and lifecycle/error comments in the same task. Record unavailable device/deployment checks as verification gaps rather than passing results.

### Files to change

Core files:

- `frontend/src/sw/register.ts` — expose observed registration state/failure and retry through the existing Vite PWA registration path; document ownership and recovery semantics in English comments.
- `frontend/src/sw/register.test.ts` (new) — cover registration success, error propagation, retry and cleanup; keep the update hook contract covered.
- `frontend/src/hooks/usePushNotifications.ts` and `frontend/src/hooks/usePushNotifications.test.ts` — consume lifecycle state, bound waits, manage subscription initialization/retry and expose stable failure outcomes.
- `frontend/src/pages/ListDetailPage/ListDetailPage.tsx` — show localized push feedback, manage the pending action and permit another attempt after a failure.
- `frontend/src/app.test.tsx` — exercise the real shared-list notification action, error display and recovery; update existing readiness assertions deliberately for the selected behavior.
- `frontend/src/locales/en/translation.json` and `frontend/src/locales/de/translation.json` — notification progress/failure/retry strings.
- `e2e/push-notifications.spec.js` (new) and `playwright.pwa.config.js` (new) — isolated production-preview browser checks with real service workers and deterministic API fixtures; keep the existing development E2E suite intact.
- `README.md` — explicitly update the PWA/push prerequisites, retry behavior, diagnosis steps, exact production browser-check command, and confirmed deployment requirements.
- `.ai/TASKS.md` and `.ai/HANDOFF.md` — implementation/review handoff and validation evidence.

Change only when diagnosis or the chosen integration requires it:

- `frontend/src/sw/service-worker.js`, `frontend/src/sw/service-worker.test.js`, `frontend/vite.config.ts`, `frontend/src/vite-config.test.ts` — a demonstrated worker evaluation, precache or build/configuration defect, with corresponding comments and README updates.
- `frontend/src/components/UpdateBanner/UpdateBanner.tsx` and its test — registration integration only; preserve update actions and dismissal behavior.
- `frontend/src/pages/ListDetailPage/ListDetailPage.module.css` and `frontend/src/pages/ListDetailPage.test.tsx` — if feedback layout changes.
- `frontend/src/pages/ListDetailPage/listDetailErrors.ts` and its test, or `frontend/src/api/errors.ts` and its test — only if reusing the existing error translation pipeline; preserve API error handling.
- `docker/nginx.conf`, `docker/security-headers.conf`, `backend/src/nginxCaching.test.js`, `docker/smoke-nginx.sh` — only for a demonstrated origin-serving defect; include explicit README deployment/security documentation updates. Do not loosen security headers speculatively.

Any small lifecycle helper introduced during implementation must have a documented responsibility and targeted tests. Explicitly stage each new file with `git add <new-file>`; do not commit during `next_task`.

### Implementation sequence

1. Re-read the roadmap, board and plan; move T-001 to `in_implementation`. Stay on the current branch and preserve unrelated changes, including the pre-existing `.ai/config.json` modification.
2. Diagnose read-only: inspect the actual worker response, redirects, MIME type, scope, CSP and cache headers; inspect registration errors and installing/active/redundant states in the browser. Inspect precache request failures and the built worker's dependencies. Do not output cookies, tokens or login redirect query strings.
3. Reproduce against the production build using Vite preview on loopback; use the production image when evidence points to Nginx headers/serving. Obtain deployment evidence when accessible. If Cloudflare Access is present, check the actual bypass rules and protected dependencies before proposing changes.
4. Record the confirmed cause in the handoff. Write a failing regression for it and tests for registration errors, timeout, same-page recovery, existing subscription restoration, unmount/StrictMode cleanup, permission denial, unsupported PushManager and duplicate-click protection before changing implementation code.
5. Extend the existing registration adapter so the update flow and notification flow observe the same registration lifecycle. Reuse the plugin registration facility for retries; do not create an independent hard-coded registration path, unregister workers or delete user caches as blanket recovery.
6. Correct the demonstrated cause in the narrowest affected layer. If the cause is external hosting/access configuration, prepare precise documented remediation; do not change live access policies from this task. If the deployment cannot be diagnosed and the issue cannot be reproduced locally, complete the independent error/retry work, record the missing evidence and return for clarification/replanning before claiming the root cause is fixed.
7. Integrate push initialization and recovery. Distinguish configuration loading, worker availability and an attempt in progress instead of using the VAPID key as proof that a worker exists. Keep the action usable for deliberate retry after a worker error. Clean up timers/listeners and prevent stale async results after unmount or token/support changes.
8. Add localized feedback using the existing notification action as the retry entry point. Keep push errors separate from unrelated list errors or preserve their structured codes through the existing translation path. Explain permission denial/settings without retrying permission prompts automatically.
9. Update the README and affected English comments alongside the behavior/configuration changes. Include prerequisites, the exact worker URL, how to identify registration versus install failures, retry expectations, and access-policy guidance only when confirmed.
10. Run targeted checks, then the broad validations below. Run the production browser regression and exploratory checks; document deployment/device verification limits. Set T-001 to `ready_for_review` and append the implementation handoff with the final Conventional Commit message in its `Commit` field. Do not commit.

### Validation

During implementation, run `npm run lint` after every code change. Write/update tests first and verify the relevant failing scenario before the correction.

Targeted unit checks:

- `npm run test --workspace frontend -- src/sw/register.test.ts src/hooks/usePushNotifications.test.ts src/app.test.tsx src/components/UpdateBanner/UpdateBanner.test.tsx`
- Run worker/configuration, error translation and Nginx tests when their corresponding files change.

Before review:

- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`
- `npx playwright test --config playwright.pwa.config.js`

The new PWA config starts `npm exec --workspace frontend -- vite preview --host 127.0.0.1 --port 4173 --strictPort` after the build, with reuse disabled and its base URL set to `http://127.0.0.1:4173`. Serve API fixtures in the browser tests so these lifecycle checks do not require PostgreSQL. Do not use the development worker as a substitute for this production check.

Production browser assertions:

- Use clean browser contexts, a real installed/active worker and a shared-list fixture; fail on registration errors, failed precache responses or activation timeout.
- Verify offline shell/list reads after online cache population.
- Exercise registration/installation failure followed by removal of the fault and recovery without page navigation, leaving the actual lifecycle real rather than replacing `navigator.serviceWorker.ready` with a mock.
- Use deterministic PushManager/notification stubs only for subscription UI/API assertions if the local browser cannot reach a real push service. Label those checks; they are not proof of real delivery.
- Check repeat clicks and error dismissal/recovery, permission-denied behavior, and the update banner's existing tests.
- On installed Android Chrome and Brave at the reported deployment, verify opt-in, reload/subscription restoration, notification delivery from another member and click navigation when device/deployment access is available. Record browser/version and outcomes; desktop emulation does not satisfy this device check.

If Nginx configuration changes, additionally build a local image and run `bash docker/smoke-nginx.sh <local-image-tag>` using the existing README instructions. Report environment limitations and failed checks explicitly.

### Handoff and commit guidance

Suggested subject: `fix(push): restore notification opt-in with clear errors and retry`.

The implementer must finalize the subject/body from the actual delivered change, put it in the implementation HANDOFF entry, and include no `Co-Authored-By` trailer. Required validations must pass before a later authorized commit. This planner performs no code edits or commits; review and commit follow the repository workflow. A PR to main remains required for user-reviewed changes and uses `aide pr`.
