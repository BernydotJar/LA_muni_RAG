# ADR 078 — Same-origin authenticated role-aware product shell

Date: 2026-07-27
Status: accepted for local foundation; productive authentication and complete product journeys remain pending

## Context

Feature 077 provides a provider-neutral BFF/session lifecycle but no authenticated product surface. The existing GitHub Pages site is intentionally public and must not receive browser credentials or be reclassified as an authenticated application. A shell is needed to prove that locally governed roles can drive browser navigation without placing Bearer tokens or session material in browser storage.

## Decision

Serve a separate shell at `/app` from the API server under the same origin as `/auth/*`.

- The shell is static and may load anonymously, but no tenant content renders until the BFF verifies and rotates a session.
- Bootstrap, rotation, and logout are POST-only same-origin requests.
- The HttpOnly session cookie is never read by JavaScript. The CSRF value is kept only in memory.
- Roles and permissions are validated against closed allowlists and originate from local membership. Provider claims are not accepted by the shell.
- Navigation and panels are hidden by effective permission, and direct navigation to denied modules falls back to the overview.
- `integration_client` remains service-only and is rejected from human membership/session paths.
- Strict CSP, framing, referrer, cross-origin, cache, permissions, and content-type headers apply to HTML, CSS, and JavaScript.
- The shell is not included in the public Pages artifact and is not linked from the public site.

## Alternatives rejected

### Add authentication to GitHub Pages

Rejected. Pages is a public static surface and cannot safely own HttpOnly BFF lifecycle, protected server routes, or approved identity callbacks.

### Store an access token in localStorage or sessionStorage

Rejected. It would expose credentials to script execution, extensions, copied profiles, and accidental telemetry, and would collapse the service/human identity boundary.

### Render navigation from role names only

Rejected. Effective permissions are the stable authorization contract; role names are displayed for accountability but do not directly select modules.

### Trust hidden navigation as authorization

Rejected. UI hiding is usability and defense-in-depth only. Backend permission and tenant enforcement remain authoritative.

## Consequences

Positive:

- no browser Bearer token or readable session cookie;
- same-origin lifecycle with immediate rotation and revocation;
- visible product capabilities align with local permissions;
- public Pages and authenticated application boundaries remain separate;
- deterministic browser evidence can test role differences without selecting a productive IdP.

Residual work:

- productive IdP integration, MFA/recovery, provisioning and access review;
- authenticated data workflows behind each shell module;
- cross-engine and accessibility evidence beyond the bounded smoke;
- real ephemeral deployment, telemetry, SLO, failure recovery and privacy operations;
- all twelve productive authenticated journeys.
