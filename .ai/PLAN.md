# Plan

Status: **ready_for_implement**

Updated: 2026-10-12T10:53:37Z

Goal: keep Android PWA notification installation reliable after deployments and restore Cloudflare Access with required static PWA files publicly accessible.

User decisions: required PWA files may be public; explain their paths, exposure and Cloudflare configuration in README. The user invoked start_plan after confirming Android recovery following a Cloudflare cache purge. No further approach decision is pending.

Privacy constraint: never record personal deployment domains or URLs in repository files, including README, roadmap, plans, reviews and handoffs. Use relative resource paths and reserved example domains such as grocery.example.com. Actual deployment targets belong only in session context or external account settings, not repository artifacts. This applies to both tasks and future evidence entries.

## Evidence and boundaries

- The normal deployed /service-worker.js was a Cloudflare HIT from 23 September, with public, max-age=31536000, immutable. Four referenced build assets returned 404, including the user's reported /assets/translation-CFgQw2PM.js.
- A unique query returned the worker from 12 October; all 38 manifest entries (35 unique URLs) returned 200. Clean Chromium contexts reproduced the normal worker becoming redundant and the current worker activating. The user then purged the Cloudflare cache and confirmed Android recovery.
- Authentication had been temporarily disabled. Permanent cache rules and restored-Access operation are not yet verified.
- docker/nginx.conf already specifies no-cache for the worker, shell and SPA fallback. Existing origin tests/smoke checks cover those headers. A fresh edge response nevertheless had max-age=14400; distinguish deployed origin configuration from Cloudflare TTL overrides.
- No Cloudflare infrastructure-as-code configuration was found. Use the existing dashboard/account setup through an available authorized connection or administrator; do not introduce an infrastructure toolchain.
- T-001 is completed historical work. Preserve its registration, retry, permission, update and offline behavior. This confirmed deployment failure does not justify speculative client cache-busting, worker unregistration, cache deletion or timeout changes.

Two tasks keep repository preparation and actual live verification separately reviewable. Both are owned by implement. Execute T-002 first, then T-003 after T-002 is reviewed and committed. Preserve T-001 handoffs and the historical cycle-close entry.

## T-002 — Document PWA Cloudflare setup and cover stale-worker recovery

Owner role: implement.

### Acceptance criteria

1. README explains the confirmed failure: an obsolete cached worker references removed chunks, Workbox rejects installation with bad-precaching-response/404, and clearing the stale edge response restored Android opt-in. Distinguish this from Access redirects and connectivity failures.
2. README provides exact hostname/path-scoped static Access exceptions, separate edge/browser cache instructions, targeted purge steps and verification commands. A repository/image deployment does not update the Cloudflare account.
3. Explain that selected static assets and the app shell are anonymously retrievable. API/private data, remaining application routes and application authorization remain protected. Do not prescribe a root/domain-wide Bypass.
4. Add a deterministic production-browser regression where an obsolete worker manifest references a retired JavaScript chunk returning 404 while page assets are current. Assert real redundant installation, localized installation feedback and no subscription persistence. Removing the simulated stale response permits activation and opt-in through existing retry without page navigation.
5. Derive the obsolete-manifest fixture from the production build; do not hard-code actual deployed chunk hashes or rely on the production site. Preserve all existing redirect, precache, offline, denied-permission and duplicate-attempt assertions. Lifecycle APIs remain real; existing push transport stubs remain explicitly labeled.
6. Documentation distinguishes measured deployment evidence, simulated checks and user-reported Android recovery. It does not claim live rules or restored-Access/device delivery checks have passed.

### Files to change

- README.md — explicitly update notification diagnosis, Cloudflare Access, caching/deployment instructions, production test coverage and verification steps. Replace the blanket statement that the manifest needs no exception with the selected public-static policy; manifest-link credentials do not prove every worker install request succeeds.
- e2e/push-notifications.spec.js — add obsolete-worker/retired-JS fault injection and real-lifecycle recovery assertions; document fixture responsibilities and limits in English comments.
- frontend/vite.config.ts — update existing Access/precache comments if needed to match the documented policy; preserve executable PWA options.
- ROADMAP.md, .ai/TASKS.md, .ai/HANDOFF.md — record preparation, checks and outstanding live rollout.

Conditional files, only if demonstrated discrepancies require them:

- playwright.pwa.config.js — harness integration only if necessary; update corresponding README commands.
- docker/nginx.conf, backend/src/nginxCaching.test.js, docker/smoke-nginx.sh — only for a proven repository origin-serving defect. Tests must precede implementation, with README and English comments updated in the same task. Preserve CSP and API protection.

No new product UI, runtime dependency or subscription behavior is required. Explicitly stage any necessary new file with git add <new-file>.

### Required README content

Cross-check every current production worker/precache resource against this public path table:

| Access exception on grocery.example.com (replace outside repository artifacts) | Purpose and caching |
| --- | --- |
| /service-worker.js | Actual worker entry, JavaScript 200 without login redirect; edge bypass and browser respects origin no-cache |
| /index.html | Public precached app shell; edge bypass and browser respects no-cache |
| /assets/* | Generated content-hashed JS/CSS/static assets, including lazy assets; explain this prefix exposure and retain immutable caching for hashed files |
| /fonts/* | Self-hosted precache fonts; retain origin's short cache lifetime |
| /icon-192.png and /icon-512.png | Installation/notification icons; retain short cache lifetime |
| /manifest.webmanifest | Public install manifest and precache resource; retain short cache lifetime |

Document specific self-hosted Access application paths using a reusable **Bypass / Include Everyone** policy, with the protected hostname application covering all other routes. Explain more-specific path precedence and inspect overlapping applications. No /api/* exception or hostname-wide Bypass. Future worker imports/resources outside this list require explicit inspection; current Workbox is bundled, so no speculative /workbox-*.js exception is needed.

Provide this host/path expression for the worker/shell cache rule:

    (http.host eq "grocery.example.com" and http.request.uri.path in {"/service-worker.js" "/index.html"})

The hostname above is a reserved example. Substitute the actual hostname only in the Cloudflare account, never in committed or uncommitted repository files.

Select **Cache eligibility: Bypass cache**. Separately ensure Browser Cache TTL respects origin no-cache. Explain conflicts with Cache Everything, edge/browser TTL, response-header and Worker overrides; edge bypass alone does not establish correct browser headers. Preserve no-cache for SPA HTML and immutable caching only for hashed assets. Access Bypass and cache Bypass are distinct settings.

After correcting rules, purge the normal worker URL and only other cache keys shown to be stale. Avoid a global purge or zone-wide security changes. Explain that an edge purge does not erase browser HTTP cache or service-worker CacheStorage. A diagnostic query can identify a stale response but is not an application registration fix. Subsequent deployments should use the current normal worker without manual purging.

Document GET/body checks for status, redirect origin, MIME type, Cache-Control, CF-Cache-Status, Age, content/hash and manifest coverage. MISS alone is not proof of bypass; bypass can report DYNAMIC. Include safe curl examples and a normal browser user agent if diagnostic clients encounter Cloudflare 1010. Never print cookies, tokens or full Access redirect query strings.

### Implementation sequence

1. Re-read roadmap/board/plan; move T-002 to in_implementation. Stay on the current branch and preserve unrelated changes.
2. Inspect the build's worker/manifest, existing proxy tests and origin assertions. Verify public-path coverage and any imports. Do not alter correct origin code merely because the edge supplied different headers.
3. Write new stale-worker scenario assertions before implementing its proxy fixture. Safely alter/add one manifest JS resource to represent a retired chunk and serve a real 404 for that path. Assert manifest discovery succeeds; do not silently skip when build layout changes.
4. Implement the minimal test fault injection. Check failed path/status, real redundant state, unchanged page session, activation after removal of the stale response and subscription saved only after recovery. Preserve all existing assertions. If valid recovery exposes an application defect, record it for replanning instead of inventing a client fix.
5. Update README and affected English comments together. Include Access/static exposure, separate caches, incident diagnosis, purge instructions and final live checks. Use timestamped incident evidence rather than treating ephemeral hashes as configuration.
6. Run targeted and broad checks. Set T-002 to ready_for_review; append the implementation handoff with the final Conventional Commit message in Commit. Do not commit during next_task.

### Validation

Run npm run lint after every code/test/comment change.

- Targeted: npm run build, then npx playwright test --config playwright.pwa.config.js -g "stale" (name the scenario accordingly).
- Origin contract: node --test backend/src/nginxCaching.test.js.
- If executable Vite configuration changes: npm run test --workspace frontend -- src/vite-config.test.ts.
- Before review: npm run lint; npm run typecheck; npm run build; npm test; npx playwright test --config playwright.pwa.config.js; git diff --check.
- Verify the origin image when Docker is available: docker build -t endgame-grocery:pwa-smoke .; bash docker/smoke-nginx.sh endgame-grocery:pwa-smoke. Mandatory if origin-serving configuration changes. Record missing Docker/Bash explicitly; Vite preview is not proof of Nginx headers.

Suggested commit: docs(pwa): explain Cloudflare setup for reliable notification opt-in.
Finalize its body from the delivered public-static/cache guidance and stale-worker regression.

## T-003 — Apply and verify durable live PWA Access/cache configuration

Owner role: implement. Dependency: T-002 reviewed and committed.

This task owns external rollout and evidence. T-002 completion or a one-time cache purge does not complete T-003.

### Acceptance criteria

1. Effective origin/Cloudflare rules retain no-cache for worker/shell and prevent stale edge/browser TTL overrides. Normal worker requests match the deployed build; repeated responses and effective rules establish bypass, not a single MISS/query request.
2. Restore Access for the protected application with only documented static exceptions. Anonymous GET checks retrieve every worker/precache resource with valid content and no login redirect/HTML. API/private data and remaining application routes stay gated; application authorization remains enforced.
3. The normal worker installs/activates in a clean real browser without failed precache requests. Verify the existing installed-app/update path when accessible, and worker/asset consistency after the next real deployment without a manual purge. If no subsequent build is available, leave that acceptance check pending rather than deploying arbitrary changes.
4. Installed Android Chrome opt-in is confirmed with Access restored and permanent cache rules active. Record browser/version when available; separately record reload restoration, real delivery and click-navigation outcomes. Do not infer them from activation. Record Brave results or verification gaps separately.
5. README/workflow artifacts state actual applied rules, outcomes and outstanding checks. Missing required cache/Access/Android evidence prevents ready_for_review; do not close external acceptance with PASS_WITH_NOTES based only on repository tests.

### Files/configuration to change

- Cloudflare account configuration for this hostname — specific static Access applications/policy, edge bypass, effective browser TTL and conflicting overrides. Record non-secret rules and timestamps; credentials stay outside artifacts.
- README.md — explicit deployment verification updates with confirmed effective configuration and operational corrections. Local tests do not configure Cloudflare.
- ROADMAP.md, .ai/TASKS.md, .ai/HANDOFF.md — rollout/device evidence; preserve historical entries.
- Conditional: docker/nginx.conf, backend/src/nginxCaching.test.js, docker/smoke-nginx.sh plus README/comments only if origin inspection proves a repository-serving defect. Correct a stale deployed image/config using existing rules instead of changing correct source.

### Execution sequence

1. Re-read roadmap/board/plan; confirm T-002 done; move T-003 to in_implementation. Inspect current state because the user may already have applied rules. Preserve working Android behavior.
2. Inspect effective deployed origin/image and Cloudflare rules. Compare worker content/headers and manifest coverage. Resolve the measured four-hour browser TTL and prior immutable worker response at the layer setting them.
3. Apply the documented narrow rules through an authorized account connection, or give exact prepared settings to the administrator if account access is unavailable. The static-public preference is already approved; do not ask it again. Account access/administrator execution is an external prerequisite, not evidence of completed rollout.
4. Purge only stale relevant edge entries if needed after correction. Restore protected Access with static exceptions; verify public resources and protected routes. Preserve backend authorization and CSP.
5. Verify normal-URL lifecycle and installed-app/update behavior, then the next actual deployment. Capture safe headers/hash, failed paths/status and states. Local fixtures are not live authentication or delivery evidence.
6. Obtain Android confirmation under final Access/cache settings. Continue independent work while input is pending, but keep required missing evidence explicit and the task in in_implementation.
7. Update README/roadmap to actual settings/results, run appropriate checks and move to ready_for_review only after required gates pass. Append the implementation handoff and final Conventional Commit message. Do not commit during next_task.

### Validation

- Live anonymous static/protected-route GET/body checks, repeated normal worker headers/content, real activation and installed Android opt-in under restored Access.
- Compare worker/manifest with the next actual deployed build without purging. If account/device/deployment access is absent, name the exact outstanding check and input; retain in_implementation.
- Before review: npm run lint; npm run build; npm test; git diff --check. Add typecheck, targeted tests and production-browser checks if implementation/configuration changes. Run image smoke checks for origin-serving changes. Never weaken existing assertions.

Suggested commit: docs(deploy): record verified PWA cache and access configuration.
Finalize the message/body from actual applied/verified behavior and any conditional origin correction.

## Handoff and commit policy

Both newly planned tasks are ready_for_implement, owner implement. Respect T-003's dependency. Tests precede implementation changes and documentation/comments are same-task scope. Required validations must pass before later implementation commits.

Use the full implement -> review -> implement commit workflow. Final Conventional Commit messages belong in the next_task HANDOFF Commit field; only later authorized commit_task commits a ready_to_commit task. Never include Co-Authored-By trailers. One commit per task; work on the current branch. A PR to main remains mandatory for user-reviewed changes and uses aide pr.

This planner edits only planning artifacts, not code, live Cloudflare settings or commits.

## Primary documentation references

- [Access application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)
- [Access policy management](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/policy-management/)
- [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
- [Edge and browser TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/)
- [Single-file purge](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/)
- [Workbox precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
