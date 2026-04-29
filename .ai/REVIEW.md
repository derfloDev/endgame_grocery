# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` and all three changed source files in full.
2. Verified each plan step against the working-tree diff (`git diff`).
3. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated).
4. Ran `npm run build` — success, no new warnings.
5. Ran `npm test` — 98/98 pass (frontend + backend).
6. Cross-checked all three Phase 3 test cases against plan spec.

##### Findings

- All four root-cause fixes from the plan are present and correct.
- `isReady: Boolean(publicKey)` correctly returns `false` for both the "not yet fetched" (`null`) and "server returned no key" (`""`) cases.
- `app.test.jsx` integration test extended with deferred VAPID fetch, asserting `disabled` → not-disabled transition.
- No regressions introduced.

##### Risks

- None. Changes are narrowly scoped to the hook, its consumer, and tests. No backend changes.

#### Open Questions

- None.

#### Verdict

`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

No issues found.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` and all changed source files in full (`usePushNotifications.js`, `vite.config.js`, `usePushNotifications.test.js`, `vite-config.test.js`, `README.md`).
2. Verified each plan phase against the working-tree diff.
3. Confirmed the `Promise.all` is replaced with sequential awaits with `cancelled` guards at both points.
4. Confirmed `devOptions: { enabled: true, type: "module" }` present in `vite.config.js`.
5. Confirmed new regression test "becomes ready when the VAPID key loads even while serviceWorker.ready is pending" is present and correctly stubs a never-resolving SW.
6. Confirmed `vite-config.test.js` new test "enables the module service worker in Vite dev mode".
7. Confirmed README line 77 documents the dev-mode SW behavior.
8. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated).
9. Ran `npm run build` — success, no new warnings.
10. Ran `npm test` — 98/98 pass.

##### Findings

- Sequential fetch correctly decouples `setPublicKey` from `serviceWorker.ready`; `isReady` now becomes `true` as soon as the HTTP response returns.
- Both `cancelled` guards remain in the right positions (after each awaited step) — no regression to cancellation safety.
- The new test directly encodes the fix; a future regression reintroducing `Promise.all` will break it immediately.
- No regressions in any existing test.

##### Risks

- None. Change is narrowly scoped to the hook initialization order and a Vite plugin config flag.

#### Open Questions

- None.

#### Verdict

`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-29

#### Findings

1. **nit** — `frontend/src/sw/service-worker.js` lines 6–8: Plan specified `typeof self.__WB_MANIFEST !== "undefined" ? self.__WB_MANIFEST : []`; implementation uses `const precacheManifest = self.__WB_MANIFEST; precacheAndRoute(precacheManifest || [])`. Both are functionally identical (`self.__WB_MANIFEST` is a property access, not a bare identifier, so it returns `undefined` rather than throwing `ReferenceError`). The `||` idiom is cleaner. Not a required fix.

#### Verification

##### Steps

1. Read `.ai/PLAN.md` and all three changed source files in full (`service-worker.js`, `usePushNotifications.js`, `usePushNotifications.test.js`).
2. Verified each plan phase against the working-tree diff.
3. Confirmed `precacheManifest || []` guard in `service-worker.js` is safe — `self.__WB_MANIFEST` is a property access, not a bare identifier, so missing injection returns `undefined` rather than throwing.
4. Confirmed `registrationRef = useRef(null)` declared, set in `loadPushState()` after SW resolves, and also updated in `subscribe()` after the `Promise.race` (bonus: covers the race-ahead case).
5. Confirmed `subscribe()` timeout structure: `registrationRef.current ?? Promise.race([serviceWorker.ready, 8 s reject])`.
6. Verified timeout test applies `vi.useFakeTimers()` after `isReady` becomes true so fake timers govern only the `setTimeout` inside `subscribe()`; `vi.advanceTimersByTimeAsync(8000)` fires the rejection correctly.
7. Verified cache test uses a getter spy on `serviceWorker.ready` and asserts `readyAccessCount === 1` after subscribe (not re-read).
8. Confirmed `HookHarness` extended with `subscribeError`/`subscribeResult` state — enables DOM assertions without affecting other tests.
9. Ran `npm run lint` — 0 errors, 1 pre-existing warning in `AuthContext.jsx` (unrelated).
10. Ran `npm run build` — success.
11. Ran `npm test` — all tests pass.

##### Findings

- All three plan phases implemented correctly.
- No regressions in any existing test.

##### Risks

- None. Changes are scoped to the SW file, hook initialization, and tests.

#### Open Questions

- None.

#### Verdict

`PASS`
