# Plan

Status: **ready_for_implement**

Goal: add donation support to the repo and the in-app Info & Settings sheet, and document the vibe-coded origin of the project.

## Scope

- **T-001** – Update `README.md` and add `.github/FUNDING.yml`:
  - Insert a "Support" / donation section in `README.md` with Buy Me a Coffee and GitHub Sponsors badges.
  - Insert a "Built with" section crediting aide/agentinit (https://github.com/riadshalaby/agentinit) as the AI workflow tooling that powered this project.
  - Create `.github/FUNDING.yml` to activate the GitHub "Sponsor" button (buy_me_a_coffee: derflodev).

- **T-002** – In-app Buy Me a Coffee link in `InfoSheet.jsx`:
  - Add a new `info-sheet-section` block below the version/license rows containing an `<a>` link to `https://www.buymeacoffee.com/derflodev` with the official yellow button image.
  - Add a CSS rule for `.info-sheet-donate` (center-aligned, padding) to `InfoSheet` styles or the nearest relevant CSS file.
  - Update `InfoSheet.test.jsx` to assert the donate link renders with the correct `href`.

## Acceptance Criteria

- `README.md` contains a Support section with Buy Me a Coffee image-link and a GitHub Sponsors link.
- `README.md` contains a Built-with / vibe-coded section mentioning aide and agentinit with the repo URL.
- `.github/FUNDING.yml` exists and lists `buy_me_a_coffee: derflodev`.
- Opening "Info & Settings" in the app shows a Buy Me a Coffee button that links to `https://www.buymeacoffee.com/derflodev`.
- `InfoSheet.test.jsx` passes with a test covering the donate link.
- `npm run lint` passes.
- `npm run build` passes.

## Implementation Phases

### Phase 1 — T-001: README & FUNDING.yml

1. Edit `README.md`:
   - After the badge row, **no change needed there**; add a dedicated **Support** section near the top (after the intro paragraph) with:
     - Buy Me a Coffee image badge linking to `https://www.buymeacoffee.com/derflodev`.
     - GitHub Sponsors badge/link (placeholder until Sponsors is activated; use standard shields.io badge).
   - Add a **Built with** section at the bottom (before License) describing that this project is vibe-coded using [aide](https://github.com/riadshalaby/agentinit).
2. Create `.github/FUNDING.yml`:
   ```yaml
   buy_me_a_coffee: derflodev
   ```

### Phase 2 — T-002: In-App Donation

1. Edit `InfoSheet.jsx`:
   - Add a new section between the license row and the closing tag:
     ```jsx
     <div className="info-sheet-section info-sheet-donate">
       <a
         href="https://www.buymeacoffee.com/derflodev"
         target="_blank"
         rel="noopener noreferrer"
       >
         <img
           src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png"
           alt="Buy Me a Coffee"
           style={{ height: "40px" }}
         />
       </a>
     </div>
     ```
2. Add `.info-sheet-donate` CSS rule (center alignment) to the relevant stylesheet (locate via grep).
3. Edit `InfoSheet.test.jsx`:
   - Add a test asserting the donate link (`href` contains `buymeacoffee.com/derflodev`) is present.

## Validation

- `npm run lint`
- `npm run build`
- `npm test`
