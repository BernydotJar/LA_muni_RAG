# Feature 081 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Hide anonymous product navigation | shell HTML `hidden` state and `setState` toggle | focused test and browser role count |
| Language, landmarks and live status | shell semantic HTML | focused and browser assertions |
| Unique IDs and valid references | source/runtime audits | focused and all-engine smoke |
| Visible interactive names | browser audit helper | Chromium/Firefox/WebKit smoke |
| Minimum target size | 24x24 runtime geometry check | all-engine smoke |
| Heading order | visible heading-level audit | all-engine smoke |
| Hidden focus containment | runtime visibility/focus audit | all-engine smoke |
| One visible current-page state | visible `aria-current` count | anonymous/authenticated browser assertions |
| Keyboard skip navigation | first Tab focuses skip link | all-engine smoke |
| Narrow viewport reflow with classic scrollbar reservation | root has no fixed minimum width; 320x900 smoke forces vertical scrollbar and records root geometry | all-engine smoke |
| Permission and security compatibility | existing role/hash/session/storage/cookie assertions | all-engine smoke |
| CI browser diversity | Playwright Chromium/Firefox/WebKit install and cross-browser script | named EVAL and workflow validation |
| No conformance/productive claim | spec/docs/output `0/12` and complement wording | named EVAL and program records |

## Named evaluation

`EVAL-HUMAN-PRODUCT-SHELL-ACCESSIBILITY-001` verifies anonymous navigation state, executable accessibility assertions, narrow-layout and keyboard coverage, three-engine CI, documentation and explicit non-conformance/non-productive boundaries.

## Commands

- `npm run test:human-product-shell-accessibility`
- `npm run smoke:human-product-shell-cross-browser`
- `npm run eval:human-product-shell-accessibility`

The commands provide deterministic local regression evidence only. Human assistive-technology acceptance remains a separate prerequisite.
