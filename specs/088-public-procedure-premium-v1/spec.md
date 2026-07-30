# Feature 088 — Public Procedure Gateway and Premium Surface

## Objective

Make the public procedure workflow usable from GitHub Pages with real, tenant-scoped evidence while preserving the fail-closed public boundary.

## Product contract

- `GET /api/public/v1/domain-pack` returns bounded UI metadata for the active pack.
- `GET /api/public/v1/procedure` accepts only `q`, `mode`, `limit`, and `depth`.
- Allowed modes are `keyword`, `phrase`, and `hybrid`; public hybrid means bounded lexical keyword plus phrase retrieval and does not claim semantic search.
- The server supplies tenant and jurisdiction context. The browser cannot supply tenant, credential, authorization, cookie, principal, or semantic-vector fields.
- CORS is emitted only for configured exact origins.
- Results use accepted, clean, processed, public artifacts under tenant RLS.
- Citations expose only safe HTTPS source URLs without credentials, query strings, or fragments.
- Partial evidence must remain visible: unsupported steps are marked insufficient and surfaced as explicit documentary gaps.

## Premium design system

The procedure page must provide:

- modular visual tokens and a dedicated stylesheet;
- responsive command, summary, step, document, gap, and citation components;
- idle, loading, success, error, empty, forced-colors, and reduced-motion states;
- visible focus and keyboard navigation;
- actionable user-facing errors rather than raw HTTP diagnostics;
- safe external links to official sources;
- no third-party runtime media or trial dependency.

## Acceptance

- Exact GitHub Pages origin preflight succeeds for both public routes.
- Foreign origins and browser credentials are rejected.
- The real PDM-OT corpus produces cited workflows for the approved water and stadium queries.
- The stadium workflow does not promote unsupported steps; missing support appears as gaps.
- Desktop and mobile Chromium have no failed requests, console errors, or horizontal overflow.
- Full regression, build, dependency audit, Pages artifact verification, and remote CI pass.
- Cloud Run is deployed from an immutable digest tied to an exact commit.
- GitHub Pages generates a workflow end to end against the deployed gateway.

## Deferred

- Productive OIDC and MFA.
- DMP OCR.
- Semantic retrieval claims.
- General legal-correctness or complete municipal-procedure claims.
- Higgsfield or other external media engines as production dependencies.
