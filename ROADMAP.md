# ROADMAP

Goal: restore push-notification opt-in in the installed Android PWA.

Updated: 2026-10-12T06:20:59Z. Formal planning started by the user; implementation has not started.

## Priority 1

Objective: identify and fix why the installed app cannot obtain an active service worker when enabling list notifications.

### Reported reproduction

- Platform: Android; reproduced with installations through Chrome and Brave.
- Deployment: `https://endgame-grocery.derflo.dev`.
- Open a list and select "Benachrichtigung aktivieren".
- After several seconds, the app displays "Service worker is not available. Try refreshing the page."
- Reloading the page does not resolve the problem.

### Desired outcome and acceptance criteria

- On the reported deployment, supported installed Android browsers can enable notifications with permission granted and valid push configuration.
- Selected scope: fix the confirmed cause, provide understandable localized errors, and allow retry from the app without a page reload.
- Verify registration, installation and activation of the deployed service worker before deciding on the fix; do not treat a longer timeout as an established solution.
- Add regression coverage for the confirmed failure and verify the production worker lifecycle in a real browser. Record device-specific verification separately from desktop browser checks.
- Preserve existing push delivery, notification-click navigation, offline reads and service-worker update behavior.
- Include explicit updates to affected `README.md` PWA/push/deployment troubleshooting instructions and related code comments alongside any behavior or configuration changes.
- Implementation validation must include `npm run lint`, `npm run build`, `npm test`, and targeted browser checks appropriate to the confirmed failure.

### Investigation evidence

- `frontend/src/hooks/usePushNotifications.ts` emits the reported error after an eight-second wait for `navigator.serviceWorker.ready`; the error does not identify the registration or installation failure.
- Push readiness currently reflects the VAPID public key, even when the service worker is still unavailable. Existing hook tests explicitly cover that behavior.
- `frontend/src/sw/register.ts` uses the Vite PWA React registration hook through the update banner; registration failures are not exposed there.
- `frontend/vite.config.ts` builds a custom worker at `/service-worker.js`; `frontend/src/sw/service-worker.js` precaches the app shell and handles push events.
- External HTTP probes from this environment failed during TLS connection setup; a separate web fetch could not access the domain. This does not establish a certificate or deployment fault on the user's device.
- Repository documentation describes Cloudflare Access bypass rules, but use of Access on the reported deployment is not yet confirmed.

### Decisions and remaining investigation

- Confirm whether Cloudflare Access or another access gateway protects the deployment.
- The user selected option 1: correction plus improved registration-error feedback and retry behavior.
- Use the existing Vite PWA registration path as the registration owner; avoid a second independent registration implementation.
- Obtain deployed worker/registration evidence before attributing the failure to application code, precaching, access policies or hosting configuration.
