# ROADMAP

Goal: restore push-notification opt-in in the installed Android PWA.

Updated: 2026-10-12T12:10:02Z. T-002 repository preparation is ready for review. T-003 remains the separate live rollout task after T-002 is reviewed and committed. Repository artifacts use relative paths and reserved example domains.

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
