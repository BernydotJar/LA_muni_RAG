# Human product shell accessibility complement

Status: automated local complement; human acceptance absent
Last reviewed: 2026-07-27

## Automated scope

The deterministic role-aware shell smoke runs the same authenticated states in Chromium, Firefox and WebKit. For anonymous and authenticated views it checks:

- Spanish language metadata and document title;
- a single main landmark and expected product navigation exposure;
- skip-link keyboard focus;
- unique IDs and resolved structural references;
- accessible names for visible interactive controls;
- minimum 24 by 24 CSS-pixel visible targets;
- no visible focusable descendants of hidden containers;
- no heading-level jumps;
- one visible `aria-current="page"` marker only after authentication;
- live status regions;
- no document-level horizontal overflow at 320 CSS pixels;
- role-specific navigation, denied/malformed hash fallback, rotation and logout;
- empty local/session storage and no readable session cookie.

Product navigation is hidden until the BFF session is authenticated, so anonymous users and assistive technology are not presented with unusable role-dependent controls.

## Cross-browser CI

The public-browser workflow installs Chromium, Firefox and WebKit and executes `npm run smoke:human-product-shell-cross-browser`. The deterministic provider remains test-only. Passing the gate confirms consistent bounded behavior in those engines, not interoperability with a productive identity provider or a real assistive-technology stack.

## What automation does not prove

This complement does not assert WCAG conformance or replace:

- keyboard-only review by a human;
- screen-reader review across supported browser/AT combinations;
- 200% and 400% zoom/reflow review;
- color-contrast and forced-colors assessment;
- magnification, switch input, voice control or cognitive/usability testing;
- understandable error/recovery review with municipal users;
- complete workflow accessibility once real product modules exist.

Those reviews require a stable productive-like environment, complete authenticated workflows, approved identity, representative content and named human acceptance owners. The official productive authenticated journey count remains `0/12`.
