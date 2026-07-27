# Implementation plan

1. Reuse Feature 077 BFF/session lifecycle and the canonical RBAC permission matrix.
2. Serve a same-origin shell from the API server rather than the public Pages artifact.
3. Implement fail-closed anonymous, unavailable, error, and authenticated states.
4. Bootstrap, rotate, and logout exclusively through POST BFF routes with same-origin credentials and in-memory proof values.
5. Filter navigation and panels by local permissions; deny hash navigation to hidden modules.
6. Exclude `integration_client` from all human membership and session paths.
7. Add strict CSP/security headers, accessible semantics, responsive layout, and reduced-motion support.
8. Verify HTTP/static contracts, deterministic Chromium behavior for two roles, PostgreSQL enforcement, named EVAL, regression, scans, and CI wiring.
9. Persist evidence without counting deterministic execution as productive authentication or enabling the twelve browser journeys.
