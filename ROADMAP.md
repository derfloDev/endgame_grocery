# ROADMAP

Goal: make the version-related unit tests version-agnostic so they no longer break on every release.

## Priority 1

Objective: remove hardcoded version strings from unit tests.

- `frontend/src/vite-config.test.js` — replace the exact `"0.2.0"` string check with a
  regex that matches any valid semver pattern (`/^\d+\.\d+\.\d+$/`).
- `frontend/src/app.test.jsx` — replace `screen.getByText("v0.2.0")` with a regex matcher
  (`/^v\d+\.\d+\.\d+$/`) so the test passes regardless of the current release version.

### Acceptance Criteria
- `npm test` passes on the current branch without any version-specific string changes.
- The two previously failing tests now pass.
- No other test behaviour is changed.
