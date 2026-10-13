# ROADMAP

Goal: restore push-notification opt-in in the installed Android PWA.

Updated: 2026-10-13T13:42:32Z. T-003 is closed on the user's instruction after a reported full cache purge; unverified gaps are listed below. Evidence uses relative paths and reserved examples.

## Priority 1

Objective: identify and fix why the installed app cannot obtain an active service worker when enabling list notifications.

### Reported reproduction

- Platform: Android; reproduced with installations through Chrome and Brave.
- Open a list and select "Benachrichtigung aktivieren".
- After several seconds, the app displays "Service worker is not available. Try refreshing the page."
- Reloading the page does not resolve the problem.

Latest deployed reproduction, reported on 2026-10-12:

- The user deployed the latest fix and reproduced the failure in the installed Android Chrome PWA.
- Selecting "Benachrichtigung aktivieren" now displays "Der Benachrichtigungsdienst konnte nicht vollständig installiert werden. Prüfe deine Verbindung und versuche es erneut."
- The user confirms that the application is protected by Cloudflare Zero Trust authentication.
- The user confirms that no Cloudflare Access exceptions are configured.
- At that point, the deployed user outcome remained unmet despite the completed repository task. The new localized error did not establish that its underlying cause was corrected.
- The user temporarily disabled Cloudflare authentication for diagnosis; the Android PWA error still occurs.
- The user supplied the worker console error `bad-precaching-response` for `/assets/translation-CFgQw2PM.js` with status 404. This matches the obsolete worker and the independently reproduced browser failure below.

Latest device outcome, reported at 2026-10-12T10:32:31Z:

- After clearing the Cloudflare cache, the user reports that notification opt-in now works on the phone in the previously failing Android PWA context.
- This is user-reported device recovery, in addition to the independent desktop lifecycle evidence. The user did not provide a browser version or separate results for real notification delivery, click navigation or Brave.
- Permanent cache-rule changes and whether Cloudflare Access has been re-enabled have not yet been reported.

### Desired outcome and acceptance criteria

- Privacy constraint: no personal deployment domains or URLs in any repository file, including README, roadmap, plans, reviews and handoffs. Use reserved example domains and relative resource paths; actual targets remain outside repository artifacts.
- On the reported deployment, supported installed Android browsers can enable notifications with permission granted and valid push configuration.
- Selected scope: fix the confirmed cause, provide understandable localized errors, and allow retry from the app without a page reload.
- Verify registration, installation and activation of the deployed service worker before deciding on the fix; do not treat a longer timeout as an established solution.
- Add regression coverage for the confirmed failure and verify the production worker lifecycle in a real browser. Record device-specific verification separately from desktop browser checks.
- Preserve existing push delivery, notification-click navigation, offline reads and service-worker update behavior.
- Include explicit updates to affected `README.md` PWA/push/deployment troubleshooting instructions and related code comments alongside any behavior or configuration changes.
- Selected follow-up approach: make required static PWA files publicly accessible through narrowly scoped Cloudflare Access exceptions; retain Access and application authorization for API/private data.
- Derive the required public paths from the actual production worker and its precache manifest. Account for the worker entry, app shell, generated assets, fonts, icons and manifest as required by that build; avoid a domain-wide bypass.
- Update `README.md` explicitly with the public path list, Cloudflare setup steps, why installation needs those resources, what becomes publicly visible, what remains protected, and verification/troubleshooting instructions. Explain that an origin code deployment alone does not change Cloudflare Access policies.
- Include the confirmed stale-CDN-worker failure in README troubleshooting: distinguish Access exceptions from cache bypass, describe targeted worker cache purging and effective edge/browser cache rules, and verify that the normal worker URL references the deployed build. Preserve `no-cache` for the worker/app shell and long immutable caching only for content-hashed assets.
- Implementation validation must include `npm run lint`, `npm run build`, `npm test`, and targeted browser checks appropriate to the confirmed failure.

### Investigation evidence before T-001

- `frontend/src/hooks/usePushNotifications.ts` emits the reported error after an eight-second wait for `navigator.serviceWorker.ready`; the error does not identify the registration or installation failure.
- Push readiness currently reflects the VAPID public key, even when the service worker is still unavailable. Existing hook tests explicitly cover that behavior.
- `frontend/src/sw/register.ts` uses the Vite PWA React registration hook through the update banner; registration failures are not exposed there.
- `frontend/vite.config.ts` builds a custom worker at `/service-worker.js`; `frontend/src/sw/service-worker.js` precaches the app shell and handles push events.
- External HTTP probes from this environment failed during TLS connection setup; a separate web fetch could not access the domain. This does not establish a certificate or deployment fault on the user's device.
- At that stage, use of Cloudflare Access had not been confirmed by the user; the latest report now confirms it.

### Current evidence and limits

- `frontend/src/sw/register.ts` now shares the plugin-owned registration attempt and reports `workerInstallation` when an observed worker becomes `redundant` without an activated worker. The reported German message maps to that error; it does not identify a failing precache URL or prove an Access failure.
- `frontend/src/sw/service-worker.js` still uses Workbox `precacheAndRoute` for the generated manifest. Installation depends on its resource requests completing successfully.
- T-001 implementation and review recorded anonymous HTTP 302/HTML responses to the Cloudflare Access login origin for `/service-worker.js`, `/index.html` and `/icon-512.png`. Live policies were not changed, and authenticated Android installation was not verified.
- Earlier anonymous probes from this environment returned HTTP 403 with a plain-text content type. On the subsequent diagnostic run, the body was identified as Cloudflare error 1010, a browser-signature rejection. Requests with a normal browser user agent and real Chromium successfully retrieved the deployment. This diagnostic-client restriction is separate from the Android precache 404.
- Cloudflare's authorization-cookie documentation states that each protected HTTP request is checked for a valid `CF_Authorization` cookie. Workbox's precaching documentation places precache downloads in the worker install event. A blocked or redirected install-time resource is therefore a hypothesis to verify, not a confirmed cause.
- Source references: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/ and https://developer.chrome.com/docs/workbox/modules/workbox-precaching.

### Confirmed deployment findings at 2026-10-12T10:08–10:09Z

- The normal `/service-worker.js` returns HTTP 200 / `application/javascript`, 18,415 bytes, SHA-256 `1d8ed17d3c963ec73c55984d0822573369c62d000ccb100fd8e21e930fca38df`, `CF-Cache-Status: HIT`, `Age: 20926`, `Last-Modified: Wed, 23 Sep 2026 11:09:53 GMT`, and `Cache-Control: public, max-age=31536000, immutable`. A request with `Cache-Control: no-cache` still returned the same cached worker.
- Its manifest contains 16 unique resource URLs. Four currently return HTTP 404: `/assets/index-DFTiszGI.js`, `/assets/index-CNMlI3Dy.css`, `/assets/translation-CFgQw2PM.js` and `/assets/translation-BZ3ccX9k.js`. The other 12 unique resources return 200 without Access login redirects for the diagnostic browser user agent.
- A unique diagnostic query on the worker URL returns HTTP 200 / JavaScript, 19,543 bytes, SHA-256 `4a8694cb52c3147d7fd91b20a4c0ff9ad9c755ffc8f0cce344dd0914d781ac79`, `CF-Cache-Status: MISS` and `Last-Modified: Mon, 12 Oct 2026 08:26:21 GMT`. Its effective `Cache-Control` is still `max-age=14400`, rather than the repository's intended `no-cache`; the cause of that effective header requires deployment/rule inspection.
- All 38 entries in the current worker's manifest (35 unique URLs, including three duplicate icon/manifest entries) return 200. Checks included Workbox revision query parameters for revisioned resources, the app shell, all generated JS/CSS chunks, fonts, icons and the web manifest. No Access login redirects were encountered.
- The live `/index.html` is current, is served with `Cache-Control: no-cache` / `CF-Cache-Status: DYNAMIC`, and references `/assets/index-BMAP1cP0.js` and `/assets/index-1AzRfIYY.css`, matching the current worker rather than the cached old worker.
- In separate clean Chromium 147.0.7727.15 contexts, explicit diagnostic registration of the normal worker URL transitioned `installing -> redundant`, with a 404 for `/assets/translation-CFgQw2PM.js`. Registering the query variant transitioned `installing -> installed -> activating -> activated`, with no failed HTTP responses. These registrations were isolated diagnostics, not changes to application registration code or user browser storage.
- This confirms the stale Cloudflare worker response as a deployment installation failure independently of the temporarily disabled Access authentication. Desktop activation does not establish Android opt-in or real push delivery.
- Cache remediation references: https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-single-file/ and https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/.

### Decisions and remaining investigation

- Cloudflare Zero Trust authentication and the original absence of Access exceptions are confirmed. Authentication is temporarily disabled by the user for diagnosis. The effective cache rules, original Access paths, overlapping applications and cookie scope remain uninspected.
- The user selected option 1: correction plus improved registration-error feedback and retry behavior.
- Use the existing Vite PWA registration path as the registration owner; avoid a second independent registration implementation.
- Deployed worker/registration evidence confirms an obsolete cached worker and missing precache resources; the user cleared the cache and confirmed Android recovery. No further speculative application registration fix is justified by this resolved failure.
- Remaining follow-up: verify effective Cloudflare/origin cache rules prevent stale worker delivery after subsequent deployments, and document the diagnosis and remediation in README. Durable edge/browser cache configuration is not yet verified by the planner.
- When restoring Access, verify the selected public static paths separately; device recovery after the temporary authentication change does not establish the final Access policy configuration.
- The user selected narrowly scoped public access for required PWA files and requested an explanation in the documentation. The alternative of keeping every static resource behind Access is not the chosen approach.
- Document that the selected static files, including the app shell when required, will be retrievable without a Zero Trust login. Verify both anonymous static-resource access and continued protection of private/API routes; define the exact public paths from the production build before changing configuration.
- Planner scope is roadmap refinement and, after an explicit planning command, an implementation handoff. No live Access policies or implementation files have been changed in this planner session.
- Keep application/API authentication requirements explicit. Any follow-up behavior/configuration change must include affected README instructions, English code comments, regression coverage and production/device verification.
- Preserve T-001's completed board and handoff history. The user invoked `start_plan`; the follow-up plan creates T-002 and dependent T-003 without reopening T-001. Required account/device/deployment checks remain explicit in T-003 so documentation completion alone cannot close the rollout.

### T-002 repository preparation — 2026-10-12T12:10:02Z

- README now specifies narrow public static Access paths/exposure, separate edge/browser cache settings, targeted purge and safe GET/body verification. It distinguishes measured incident evidence, user-reported Android recovery and local simulations from pending live configuration checks.
- The production regression derives an obsolete manifest from the current build and returns a real 404 for a retired JavaScript chunk while page assets stay current. It observes redundant installation and localized feedback, verifies no push/subscription persistence during a failed opt-in, then verifies activation and opt-in after removal of the stale response without navigation. All previous browser assertions remain intact.
- The current build has 38 precache entries / 35 unique URLs within the public path table and no worker imports. Executable application/Vite options and origin-serving configuration are unchanged.
- Validation passed: lint, typecheck, build, full unit suite, five production browser scenarios, eleven origin contract tests, README example syntax, and production-image Nginx HTTP/cache/security/gzip smoke checks. Windows required task-local preview process cleanup and Bash standard-input forwarding to Docker Desktop for the smoke script; no runtime dependency or repository harness setting was introduced.
- No live Cloudflare configuration was changed or verified by T-002. T-003 still requires effective Access/cache rules, anonymous static/protected-route checks, subsequent deployment consistency and final Android evidence; historical phone recovery does not close those gates.

### T-003 rollout baseline — 2026-10-12T14:46:21Z

- T-002 dependency is complete at commit `09a2600`. T-003 remains `in_implementation`; no live Access/cache settings have been changed by this task.
- Three anonymous normal `/service-worker.js` GETs returned HTTP 200 JavaScript, `Cache-Control: max-age=14400`, `CF-Cache-Status: REVALIDATED`, and SHA-256 `4a8694cb52c3147d7fd91b20a4c0ff9ad9c755ffc8f0cce344dd0914d781ac79`. Effective worker browser/edge bypass is not established. `/index.html` returned `no-cache` / `DYNAMIC`.
- All 38 manifest requests (35 unique paths, including revision queries) returned 200 with no failed/login-HTML resources; the current shell's asset references are present and the worker has no imports. The manifest body is valid JSON, served as `application/octet-stream`.
- Normal icon URLs still report year-long immutable cache headers and old `HIT` responses; revision-query icon responses report one-day headers. Inspect account/deployed-origin rules and cache keys before attributing this discrepancy to source or purging additional entries.
- Root and a list route returned anonymous HTML 200; `/api/health` returned 200 and `/api/lists` returned 401 JSON. Application API authorization is observed, but restored Access protection and effective applications/policies are unverified.
- An isolated clean Chromium 147.0.7727.15 diagnostic registration of the normal worker observed `installing -> installed -> activating -> activated`, scope `/`, with no failed static requests. This does not establish installed-app updates, Android opt-in or real push delivery. A direct manifest navigation aborted because it was served as a download; the completed lifecycle diagnostic used a public image document instead.
- No Cloudflare connector was found, no matching Cloudflare credential environment/CLI was available, and browser-control initialization failed twice with `setup refresh had errors`. Effective account rules and deployed image provenance could not be inspected; the live worker differs from the local build, without proving that the deployed image is incorrect.
- Administrator action requested: apply/confirm README's exact static Access exceptions, protected hostname application, worker/shell edge bypass, origin-respecting browser TTL and relevant conflicting overrides; report actual non-secret rules and timestamps. Then repeat anonymous/protected-route and lifecycle checks. Final Android Chrome version/opt-in, Brave or explicit gaps, and next-real-deployment consistency without purging remain required; no arbitrary deployment was initiated.

### T-003 administrator follow-up — 2026-10-13T04:26:57Z

- User-confirmed configuration: Cloudflare authentication bypass and cache rules have been created and are active. Exact account rule contents remain unavailable to the agent.
- Three anonymous normal worker requests return JavaScript 200, `Cache-Control: no-cache`, `CF-Cache-Status: DYNAMIC`, no Age and the unchanged baseline SHA-256 `4a8694cb52c3147d7fd91b20a4c0ff9ad9c755ffc8f0cce344dd0914d781ac79`. `/index.html` also returns no-cache/DYNAMIC. This confirms improved effective responses, not a subsequent deployment.
- `/`, `/login`, a list route, `/api/health` and `/api/lists` now return HTTP 302 to Access. Public worker/shell, icons, manifest and fonts return 200; the manifest contains 38 entries / 35 unique paths and covers the current shell assets. All 26 asset entries return HTTP 302/HTML instead of public assets, so full precache coverage fails.
- Clean Chromium 147.0.7727.15 diagnostic registration of the normal worker observes `installing -> redundant`. This is a real deployed install failure under the current anonymous policy, distinct from the prior stale-worker 404 incident. No application workaround, cache purge or live account change was performed by the agent.
- Administrator correction requested: inspect the effective `/assets/*` Access application, Bypass / Include Everyone policy and more-specific overlapping applications. Repeat resource/lifecycle checks once corrected. The normal icons still report old year-long immutable HIT headers and need effective cache-key/header inspection.
- T-003 remains in_implementation. Final rule details, Android Chrome version/opt-in under final settings, installed update/reload/delivery/click checks, Brave results or gaps, and consistency after the next actual deployment remain outstanding.

### T-003 assets recheck — 2026-10-13T04:33:02Z

- All 26 current manifest asset entries return anonymous HTTP 200 with JavaScript/CSS/image MIME types. All 38 precache requests / 35 unique paths pass; the previous asset redirects are no longer observed.
- Normal worker and shell responses retain no-cache/DYNAMIC. Worker SHA-256 is unchanged from the recorded baseline; sampled root/list/API requests still redirect to Access.
- Clean Chromium 147.0.7727.15 native normal-worker registration observes installing -> installed -> activating -> activated, scope /, with no failed HTTP responses. This verifies the current anonymous worker installation, not installed Android opt-in or the next deployment.
- Final Android Chrome version/opt-in under restored Access and a subsequent normal deployment without manual purging were requested from the user. Installed update/reload/delivery/click checks, Brave results or gaps, effective rule/image details and unhashed icon header follow-up remain outstanding. T-003 stays in_implementation; no live mutation, purge, deployment or commit was performed by the agent.

### T-003 continuation and device confirmation — 2026-10-13T06:20:08Z

- User-reported installed Android Chrome opt-in under the current Access configuration: works. Chrome version was not supplied. Reload restoration, installed update behavior, real delivery/click navigation and Brave results are not inferred from opt-in.
- User reports no subsequent deployment and an earlier cache purge without an exact timestamp. The required next-actual-deployment check remains pending; no arbitrary release/deployment was initiated.
- Three normal worker requests retain JavaScript 200, no-cache/DYNAMIC and the recorded baseline SHA-256; Last-Modified remains 12 October 08:26:21 GMT. All 38 precache requests / 35 unique paths pass. Root/list/API samples remain Access redirects. No new content/deployment evidence is observed.
- Normal `/icon-192.png` body SHA-256 is `5c0f3fcf068547fee5fdc9c3b437c50dd78e455778048b889cc872b1e9ccf862`; its revision-query response and repository file instead match at `14ccaffda1b79f0225ec07aced6cc953ba0fea5cf70ea8c00a6bd12d82f00fac`. Normal `/icon-512.png` body matches the current file. Both normal URLs still return year-long immutable HIT headers, whereas revision queries return one-day headers. This demonstrates stale normal icon content/header cache entries without proving a repository-origin defect.
- Requested administrator action: inspect conflicting icon cache/header rules and purge only the two normal icon URLs, then repeat body/header checks. The agent has no connected account tool and performed no live mutation or purge. T-003 remains in_implementation until required external checks pass.

### T-003 post-deployment report and checks — 2026-10-13T06:52:55Z

- User reports a new deployment without purge and good operation. The prior installed Android Chrome opt-in confirmation is retained; Chrome version and separate delivery/reload/click/Brave outcomes remain unspecified. Do not interpret the unspecified outcomes as passing.
- Independent post-report checks: three normal worker requests and shell return no-cache/DYNAMIC without Age; root/login/list/API samples redirect to Access; all 38 manifest requests / 35 unique paths pass and shell assets are covered. Hashed assets remain one-year immutable; fonts and revisioned icons have one-day headers.
- Clean Chromium 147.0.7727.15 normal-worker diagnostic again observes installing -> installed -> activating -> activated without failed HTTP responses. Post-report worker SHA-256 remains `4a8694cb52c3147d7fd91b20a4c0ff9ad9c755ffc8f0cce344dd0914d781ac79`, with Last-Modified 12 October 08:26:21 GMT. This does not contradict a redeployment of identical content, but exact image/version comparison remains unavailable; requested the deployed image version/digest.
- Normal icon URLs still return old one-year immutable HIT headers; normal icon-192 still has the previously demonstrated older image body. Requested targeted purge of only the two normal icon URLs, separate from the documented deployment-without-purge check. No live mutation, purge or deployment performed by the agent.
- Consolidated README rollout status into a current evidence table while preserving full historical evidence here and in HANDOFF. T-003 remains in_implementation pending icon cleanup and image comparison; required final local validations and review handoff follow once those gates pass.

### T-003 closure � 2026-10-13T13:42:32Z

- User reports everything was purged, including the normal icon URLs, and asks to close the task. The agent did not re-measure the live icons (no deployment host in repository artifacts).
- Open and unverified: exact image digest comparison, Android Chrome version, reload restoration, real delivery/click navigation and Brave. Opt-in under restored Access and a redeployment without purge are user-reported.
- Local checks: lint, build, 421 backend tests and `git diff --check` pass.
