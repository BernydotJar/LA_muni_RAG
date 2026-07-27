# ADR 081 — Cross-browser automated accessibility as a complement, not conformance

Date: 2026-07-27
Status: accepted for local regression evidence; human accessibility acceptance pending

## Context

Feature 078 established semantic and responsive shell foundations and deterministic browser evidence. A single-engine smoke and source assertions can miss engine-specific focus, accessibility-tree, layout and navigation behavior. At the same time, automated checks cannot determine whether complete workflows are understandable and usable with assistive technology.

## Decision

Run one enhanced deterministic shell harness in Chromium, Firefox and WebKit and add bounded accessibility assertions to both anonymous and authenticated states.

- Hide role-dependent product navigation until authentication.
- Check visible interactive names, target size, unique IDs, heading progression, hidden-focus containment, visible current-page state and live regions.
- Exercise keyboard skip navigation and 320-pixel reflow without document overflow.
- Preserve role authorization, malformed-route, session, storage and cookie checks in the same run.
- Require all three browser engines in CI.
- Label the result as an automated complement only and keep productive journeys at `0/12`.

## Alternatives rejected

### Treat source inspection as sufficient

Rejected. It cannot observe actual visibility, focus, dimensions, responsive overflow or browser-specific behavior.

### Add an automated WCAG-conformance claim

Rejected. Automation covers only a subset of success criteria and cannot judge usability, comprehension, assistive-technology output or complete workflows.

### Run only Chromium

Rejected. Firefox and WebKit provide independent layout, navigation and cookie/browser behavior that can reveal regressions hidden by one engine.

### Expose disabled navigation before authentication

Rejected. It adds unusable controls and misleading role surfaces to anonymous users and assistive technology.

## Consequences

Positive:

- engine-specific focus/layout regressions become release-gate failures;
- anonymous accessibility tree is cleaner;
- minimum target and narrow-layout regressions are executable;
- browser security/session assertions remain coupled to the accessible UI state.

Residual work:

- human keyboard and screen-reader review;
- contrast, forced-colors, zoom/reflow and cognitive/usability assessment;
- representative content and complete workflow testing;
- productive IdP, environment and external user evidence;
- formal accessibility acceptance and remediation ownership.
