# Plan

Status: **ready**

Goal: make version-related unit tests version-agnostic (Option B — regex pattern matching).

## Scope

Two tests hardcode the version string `0.2.0`. After the 0.3.0 release they fail. The fix
replaces every exact version assertion with a regex that matches any valid semver, so the
tests never need to be touched again on a release bump.

## Acceptance Criteria

- `npm test` passes on branch `fix/test` without any version-specific string changes.
- The two previously failing tests (`vite worker config > defines the app version from the
  root package.json` and `authentication shell > opens the overview info sheet and logs out
  from it`) now pass.
- No other test behaviour is changed.
- `npm run lint` reports no new errors.

## Implementation Phases

### Phase 1 — Fix `vite-config.test.js`

File: `frontend/src/vite-config.test.js`

- Line 24: replace
  ```js
  expect(viteConfig.define.__APP_VERSION__).toBe(JSON.stringify("0.2.0"));
  ```
  with
  ```js
  expect(viteConfig.define.__APP_VERSION__).toMatch(/^"\d+\.\d+\.\d+"$/);
  ```
  This checks that `__APP_VERSION__` is a JSON-stringified semver without pinning the exact
  version number.

### Phase 2 — Fix `app.test.jsx`

File: `frontend/src/app.test.jsx`

- Line 251: replace
  ```js
  expect(screen.getByText("v0.2.0")).toBeTruthy();
  ```
  with
  ```js
  expect(screen.getByText(/^v\d+\.\d+\.\d+$/)).toBeTruthy();
  ```
  `getByText` accepts a `RegExp`, so no wrapper function is needed.

## Validation

Run in order after implementation:

```
npm run lint
npm test
```

Both must exit with code 0 before the task moves to `ready_for_review`.
