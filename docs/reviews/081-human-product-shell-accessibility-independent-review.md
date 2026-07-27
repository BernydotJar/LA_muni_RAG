# Feature 081 independent accessibility review

Date: 2026-07-27
Review model: Producer → Critic / Red Team → Fixer → Independent Verifier → Release Gate

## Producer result

Enhanced the role-aware shell smoke with anonymous/authenticated accessibility assertions, 320-pixel reflow checks and deterministic Chromium, Firefox and WebKit execution. Product navigation is removed from the anonymous accessibility tree.

## Critic / Red Team findings

1. **Hidden route buttons remained exposed through their parent navigation before authentication.** Required the entire product navigation to be hidden and state-controlled.
2. **Counting `aria-current` by attribute alone included controls hidden by an ancestor.** Required visibility-aware counting.
3. **Source assertions could not prove actual target size or overflow.** Required runtime geometry and 320-pixel viewport checks.
4. **Selector interpolation could create brittle malformed-route tests.** Existing route lookup was preserved as an exact dataset comparison and malformed hash fallback remained executable.
5. **One engine could hide focus/layout behavior.** Required the same smoke in Chromium, Firefox and WebKit.
6. **Automated output could be overstated as WCAG conformance.** Required explicit complement-only language and `0/12` productive journeys.
7. **A clean accessibility tree does not prove understandable complete workflows.** Required human keyboard, screen-reader, zoom, contrast and usability work to remain open.

## Fixer changes

- hid product navigation until authenticated state;
- added visibility-aware duplicate-ID, accessible-name, target-size, heading, hidden-focus and current-page audits;
- added first-Tab skip-link and 320-pixel overflow assertions;
- retained permission-aware denied/malformed route, rotation, logout, storage and cookie checks;
- ran the same harness in Chromium, Firefox and WebKit;
- added focused tests, EVAL, CI wiring and non-conformance documentation.

## Independent verifier evidence

At implementation checkpoint:

- enhanced deterministic smoke: Chromium, Firefox and WebKit passing;
- anonymous and authenticated state audits: passing;
- role-aware viewer and tenant-admin flows: passing;
- keyboard skip navigation and malformed route fallback: passing;
- no persistent browser credentials or readable session cookie: passing.

The exact focused/EVAL counts, integrated regression, audits/scans and functional SHA are recorded after the release gate completes.

## Release-gate judgment

Current judgment: **automated accessibility candidate, not human acceptance or production readiness**.

The cross-browser gate improves regression detection but does not establish WCAG conformance, assistive-technology usability or productive authenticated journey evidence.
