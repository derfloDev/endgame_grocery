# Plan

Status: **ready_for_implement**

Goal: Add GNU General Public License v3 to the repository and integrate it consistently across all relevant files.

## Scope

- Create `LICENSE` file in the repository root containing the full GNU GPL v3 text.
- Add `"license": "GPL-3.0-or-later"` field to `package.json`.
- Add a GPL-3.0 license badge to the badge block in `README.md` and a `## License` section at the end of `README.md`.

## Acceptance Criteria

- `LICENSE` exists at the repository root and contains the unmodified GNU GPL v3 full text.
- `package.json` contains `"license": "GPL-3.0-or-later"`.
- `README.md` badge block includes a GPL-3.0 shield badge linking to the LICENSE file.
- `README.md` ends with a `## License` section referencing GNU GPL v3 and linking to the LICENSE file.
- `npm run lint` passes without errors.

## Implementation Phases

### Phase 1 — LICENSE file

- Create `LICENSE` at the repository root with the complete GNU GPL v3 text (https://www.gnu.org/licenses/gpl-3.0.txt).
- Use the standard SPDX identifier header: `GNU GENERAL PUBLIC LICENSE Version 3`.

### Phase 2 — package.json

- Open `package.json` and add `"license": "GPL-3.0-or-later"` as a top-level field (after `"version"`).

### Phase 3 — README.md

- Insert the following badge into the existing badge block (after the CI badge line):
  ```html
  <img src="https://img.shields.io/badge/License-GPL%20v3-blue.svg" alt="License: GPL v3" />
  ```
  Wrap it in an `<a>` tag pointing to `./LICENSE`.
- Append a `## License` section at the end of `README.md`:
  ```markdown
  ## License

  This project is licensed under the [GNU General Public License v3.0](./LICENSE).
  ```

## Validation

- `npm run lint`
