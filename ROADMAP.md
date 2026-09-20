# ROADMAP

Goal: make the first paint of a grocery list fast again. Opening `/lists/<id>` after the
browser caches have been evicted currently takes ~2-3 s before any entry is visible. Remove
the blocking work from that path without losing icon suggestions, offline behaviour or i18n.

## Measured baseline

Lighthouse, mobile, `https://endgame-grocery.derflo.dev/lists/<id>`, 2026-09-20, run with
browser extensions active (see "Verification method" for the caveat).

| Metric | Value |
| --- | --- |
| First Contentful Paint | 2.8 s |
| Largest Contentful Paint | 3.2 s |
| Time to Interactive | 4.4 s |
| Total Blocking Time | 830 ms |
| Total transfer | 23,086 KiB |

Findings behind those numbers:

- `model_quantized.onnx` is 22,986 KiB of the 23,086 KiB total (99.5 %), downloaded from
  `us.aws.cdn.hf.co` between 1715 ms and 4047 ms, followed by the ONNX WASM runtime from
  `cdn.jsdelivr.net`. Triggered by `primeIconWorker()` in `frontend/src/main.tsx` before the
  first render.
- Every detail-page endpoint is requested twice: `/api/lists` (597 / 1008 ms),
  `/entries` (601 / 1011 ms), `/history` (611 / 1014 ms), `/mark-viewed` (1108 / 1408 ms),
  `/members` (1112 / 1416 ms).
- Entries are available at 725 ms but only rendered at ~1562 ms, because `loadMembers` is
  inside the `isLoading` gate.
- The Google Fonts stylesheet in `frontend/index.html` blocks rendering for 788 ms.

## Verification method

All acceptance criteria are verified in a Chrome incognito window with **no extensions**, on
`/lists/<id>` with an authenticated session, Lighthouse in mobile mode.

- Cold start: clear Cache Storage and IndexedDB for the origin before loading.
- Warm start: load once, then reload with caches populated.

The baseline above was recorded with extensions active; roughly 1.7 s of its main-thread time
and almost all of its "unused/unminified JavaScript" findings belong to those extensions.
CPU-bound numbers (TBT, main-thread work, bootup time) are therefore tracked as observations
in this cycle, not used as pass/fail gates. Transfer weight, request counts, requested hosts
and visible rendering behaviour are the gates.

## Priority 1

Objective: the 22.9 MB icon model must no longer block or compete with the first page load.

- Stop calling `primeIconWorker()` at module load time in `frontend/src/main.tsx`.
- Bootstrap the icon worker on demand, when the add/edit item sheet is opened.
- The first icon lookup may wait for the model, but must show an explicit loading state
  instead of silently stalling the sheet.
- Document when the model is fetched and what that means offline (README, code comments).

Acceptance criteria:

- A cold load of `/lists/<id>` issues no request to `huggingface.co`, `hf.co` or
  `cdn.jsdelivr.net`.
- Adding an entry still produces an icon suggestion, covered by an E2E check.

Decision point (resolved 2026-09-20): strictly on sheet open. The connection-gated idle
prefetch originally listed here is dropped, and no idle warm-up helper ships. Any automatic
warm-up would re-issue a model-host request on a cold visit and contradict the very criterion
this priority exists to satisfy; keeping an unreachable helper would only ship dead code.

The "total transfer below 500 KiB" criterion moved to Priority 4. It is not reachable from
this priority's files — the cold-load weight sits in the PWA icons, the logo and the precache
manifest, none of which the icon-loading path controls.

## Priority 2

Objective: the list renders immediately from cache and refreshes without duplicate requests.

- Remove `accessErrorMessage` from the effect dependencies in
  `frontend/src/pages/ListDetailPage/useListDetailData.ts`. Keep an error *key* in state and
  translate it at render time, so lazily loaded i18n resources no longer re-trigger the load.
- Move `loadMembers` out of the `isLoading` gate: render entries as soon as `/entries`
  resolves and let members arrive afterwards.
- Serve reads cache-first: render the cached `entries`/`lists` payload from `offlineStore`
  immediately and replace it with the network response, instead of reading the cache only in
  the network-error branch of `frontend/src/api/client.ts`.
- Drop the boot-time reachability probe to `/api/health` while real API calls are already in
  flight, since `reportRequestOutcome` establishes reachability from those.
- Update README and code comments describing the load and cache behaviour.

Acceptance criteria:

- Each of `/api/lists`, `/entries`, `/history`, `/members`, `/mark-viewed` is requested
  exactly once per page visit.
- Entries become visible as soon as `/entries` has responded; the members request does not
  delay them.
- With a populated cache, entries are visible in the first frame after mount, with no spinner.
- Offline reads, the mutation queue and SSE resync behave as before; existing tests stay green.

Decision point: show a "stale data" indicator while the cache-first render is being revalidated?
Recommendation: no. Replace silently; the offline banner stays the only status indicator.

## Priority 3

Objective: the first frame no longer depends on third-party hosts.

- Remove the Google Fonts stylesheet and the `preconnect` hints from `frontend/index.html`.
- Self-host Orbitron, Exo 2 and JetBrains Mono, shipping only the weights actually used, and
  keep `font-display: swap`.
- Add `woff2` to `injectManifest.globPatterns` in `frontend/vite.config.ts` so the fonts are
  precached by the service worker.
- Check and document the font licences and any attribution requirements (LICENSE / README).

Acceptance criteria:

- No request to `fonts.googleapis.com` or `fonts.gstatic.com` on any page.
- Lighthouse reports no third-party render-blocking stylesheet.
- Typography is visually unchanged (before/after comparison).
- The app renders with its own fonts while fully offline.

## Priority 4

Objective: the cold load stays under a real transfer budget.

Added 2026-09-20 after the T-001 review measured a cold load at 1266.7 KiB against a 500 KiB
budget that no icon-loading file could influence. The weight is in static assets and in the
precache manifest:

| Response | Transfer |
| --- | --- |
| `icon-512.png` | 503.6 KiB |
| `assets/iconWorker-*.js` | 162.2 KiB |
| `assets/index-*.js` | 158.3 KiB (fetched twice: page + service-worker precache) |
| `endgame_grocery_logo.png` | 127.4 KiB |
| `icon-192.png` | 73.3 KiB |
| Google Fonts woff2 pair | 52.1 KiB (Priority 3 removes this) |

- Re-encode `frontend/public/icon-512.png` and `frontend/public/icon-192.png`; they are flat
  PWA icons and are far larger than their content warrants.
- Re-encode `frontend/src/assets/endgame_grocery_logo.png`, which is imported by seven pages.
- Exclude `assets/iconWorker-*.js` from `injectManifest.globPatterns` in
  `frontend/vite.config.ts`. After Priority 1 the worker chunk never executes on a cold visit,
  yet it is still precached and downloaded.
- Investigate the duplicate page + service-worker fetch of the main JS and CSS bundle and avoid
  paying for the same bytes twice on a cold visit.
- Document the asset budget and the precache exclusions (README, code comments).

Acceptance criteria:

- Total transfer of a cold load of `/lists/<id>` is below 500 KiB, measured after Priority 3
  has landed, in an extension-free incognito window with Cache Storage and IndexedDB cleared.
- No cold-load response exceeds 150 KiB.
- The PWA icons, the maskable icon purpose and the logo are visually unchanged at their
  rendered sizes.
- The app still installs as a PWA and still works offline after the precache exclusions.

Route-level code splitting stays deferred; this priority is limited to assets and the
precache manifest.

## Constraints

- No loss of function: offline queue, SSE resync, push notifications and i18n stay intact.
- No new third-party CDN dependencies.
- Every behaviour change ships with tests; existing assertions are not weakened.
- Documentation updates belong to the task that changes behaviour, never to a follow-up.

## Deferred

Consciously out of scope for this cycle, revisit afterwards:

- Route-level code splitting and bundle diet (i18next + ICU are the heavy parts).
- Backend hygiene: `pg` pool configuration (default 10 s idle timeout closes all connections),
  missing indexes on `entries.list_id`, `list_members(user_id)`, `list_views`.
- Replacing the embedding-based icon matching with a lighter approach.
