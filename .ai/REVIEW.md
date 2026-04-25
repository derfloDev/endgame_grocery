# Review Log

Shared review log for the current cycle. Append a new task section when review starts for a new task. Within a task, append a new review round instead of replacing prior history.

---

## Task: T-001

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `backend/src/routes/entries.js` line 138 — `icon ?? null` in the PATCH handler means sending `{ icon: null }` cannot clear a previously set icon (COALESCE preserves the existing DB value). The plan does not require clearing icons, so this is an acceptable design choice, but future tasks that want a clear/reset capability would need a different update strategy (e.g. a dedicated null sentinel or explicit `icon = $3` without COALESCE). No fix required.

#### Verification

##### Steps
- Read migration file `backend/src/db/migrations/1713898800000_add_icon_to_entries.cjs` — correct `up`/`down` structure using `pgm.addColumns` / `pgm.dropColumns`.
- Read `backend/src/routes/entries.js` — GET, POST, PATCH, DELETE all reviewed.
- Read `backend/src/entries.test.js` — all new and updated test cases reviewed.
- Read `backend/src/db/migrations.test.js` — new test case for icon migration reviewed.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning in `AuthContext.jsx` (unchanged).
- Ran `npm run test --workspace backend -- src/entries.test.js` — **5/5 pass**.
- Ran `npm run test --workspace backend -- src/db/migrations.test.js` — **2/2 pass**.
- Ran `npm run build` — frontend bundle and backend syntax check both clean.
- Ran `npm test` — **27/27 backend tests pass, 19/19 frontend tests pass**.
- Inspected `git diff HEAD` — changes are exactly scoped to the 4 implementation files; no unintended modifications.

##### Findings
- All acceptance criteria from the plan are satisfied.
- Migration `up`/`down` is structurally correct; live up/down/up cycle was reported passing by the implementer and confirmed via HANDOFF entry.
- PATCH guard condition correctly uses `icon === undefined` (not falsy), so `{ icon: '🥛' }` alone passes validation.
- RETURNING clauses on GET, POST, and PATCH all include `icon`.

##### Risks
- Live migration rollback was not re-executed by the reviewer (no DB connection in this environment). The implementer's HANDOFF entry records a successful up/down/up run. The migration code itself is correct.

#### Verdict
`PASS`

---

## Task: T-003

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/hooks/useIconSuggestion.js` line 20–24 — `getExactOrPrefixIcon` iterates all 257 map keys with bidirectional `startsWith` on every call. For a grocery app this is imperceptible, but it is O(n) on every render. No fix required.
2. **nit** — `frontend/src/workers/iconWorkerClient.js` line 40–41 — The `handleWorkerError` listener rejects all pending requests but does not set `iconWorker = null`, so subsequent `getIconWorker()` calls return the crashed worker without recreating it. The app would need a page refresh to recover from a fatal worker crash. Acceptable for the current scope; no fix required.

#### Verification

##### Steps
- Read all 6 implementation files: `vite.config.js`, `iconWorker.js`, `iconWorkerClient.js`, `useIconSuggestion.js`, `useIconSuggestion.test.js`, `main.jsx`.
- Verified git diff scope: 7 frontend files changed + `package-lock.json`; no unintended modifications.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/hooks/useIconSuggestion.test.js` — **4/4 pass**.
- Ran `npm run build` — clean; `iconWorker-*.js` bundle at 822 KB (expected for WASM ML); upstream `onnxruntime-web eval` warning noted but not actionable.
- Ran `npm test` — **28/28 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `vite.config.js`: `optimizeDeps: { exclude: ['@xenova/transformers'] }` added at top level ✅
- `iconWorker.js`: singleton pipeline via `??=`; threshold read from env with `Number.isFinite` guard; reference embeddings pre-computed on `init` and memoized; `pooling: 'mean'` + `normalize: true` correct for all-MiniLM-L6-v2; error handling posts `matchError` ✅
- `iconWorkerClient.js`: request-ID correlation; pending-request map; `primeIconWorker()` sends `init`; graceful `Worker === undefined` fallback ✅
- `useIconSuggestion.js`: 300 ms debounce; request sequence number guards against stale async results; cleanup via `clearTimeout` in effect; exact + prefix fast path bypasses worker entirely ✅
- `main.jsx`: `primeIconWorker()` called as module-level side effect before rendering, triggering eager model warm-up ✅
- Test suite: exact-match (no worker call), whitespace (null/false), below-threshold (null), above-threshold (icon) — all four acceptance-criteria cases covered ✅
- `iconWorkerClient.js` as a dedicated shared module was not in the plan but is a clean architectural improvement over inline worker construction in `main.jsx`.

##### Risks
- The 822 KB worker bundle will be fetched on first app load. No caching strategy for the WASM model weights is in scope for this task (deferred to T-006 / future work).

#### Verdict
`PASS`

---

## Task: T-002

### Review Round 1

Status: **PASS**

Reviewed: 2026-04-25

#### Findings

1. **nit** — `frontend/src/data/iconDatabase.js` — Several entries share an emoji with a more prominent item due to Unicode gaps (`cream` → `🥛`, `cocoa` → `☕`, `mustard` → `🌭`, `black pepper` → `🧂`). This is expected and appropriate given emoji availability. No fix required.
2. **nit** — `frontend/src/data/iconDatabase.js` — Typing "pepper" alone does not resolve to a match (only "black pepper" is in the label/tags). This is a minor gap in coverage but not required by the plan. No fix required.

#### Verification

##### Steps
- Read `frontend/src/data/iconDatabase.js` — structure, entry count, bilingual coverage, `EXACT_MATCH_MAP` construction reviewed.
- Read `frontend/src/utils/cosineSimilarity.js` — algorithm, guard clauses, edge cases reviewed.
- Read `frontend/src/utils/cosineSimilarity.test.js` — all 5 test cases reviewed.
- Runtime spot-check via `node -e` to confirm entry count (78), map size (257 keys), and all 12 plan-specified EN/DE lookups resolve correctly.
- Ran `npm run lint` — 0 errors, 1 pre-existing frontend warning (unchanged).
- Ran `npm run test --workspace frontend -- src/utils/cosineSimilarity.test.js` — **5/5 pass**.
- Ran `npm run build` — clean.
- Ran `npm test` — **24/24 frontend tests + 27/27 backend tests, all pass**.

##### Findings
- `ICON_DB` has 78 entries, well above the ≥ 60 minimum.
- All required categories present: dairy, produce, bakery, meat/fish, beverages, frozen, snacks, household, condiments.
- `EXACT_MATCH_MAP` is frozen and derived from label + tags; keys are lower-cased and trimmed.
- `createExactMatchMap` correctly skips empty keys and handles missing `tags` with a default of `[]`.
- `cosineSimilarity` handles zero-magnitude vectors (returns 0), mismatched lengths (RangeError), and non-array inputs (TypeError). Compatible with TypedArrays via `Number()` coercion.
- Test coverage: entry count assertion, 12 exact-match pairs (EN + DE), and 3 vector similarity cases (identical, orthogonal, partial overlap with `toBeCloseTo`).

##### Risks
- None.

#### Verdict
`PASS`
