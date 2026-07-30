# Feature 078 — Authenticated role-aware product shell v1

Status: implemented locally against the Feature 077 deterministic BFF adapter; productive IdP and authenticated browser journeys remain blocked

## Goal

Provide a same-origin product shell that consumes the provider-neutral BFF session contract without exposing Bearer credentials, session cookies, authorization codes, or persistent browser tokens. Navigation and module visibility must derive only from locally governed permissions returned by the BFF.

## Functional requirements

1. `/app`, `/app/shell.css`, and `/app/shell.js` are served by the API server, not the public Pages artifact.
2. The shell is publicly loadable but contains no tenant data until a same-origin BFF session is verified.
3. Session bootstrap uses `POST /auth/session`, credentials `same-origin`, and the non-simple `x-session-bootstrap: v1` proof. Anonymous `401` and disabled `503` responses render bounded states.
4. The browser never sends or stores a Bearer credential. No session/CSRF token is written to localStorage, sessionStorage, IndexedDB, URL, DOM, console, or document cookie.
5. The session cookie remains HttpOnly. The CSRF value exists only in JavaScript memory and is sent only to same-origin rotation/logout mutations.
6. Navigation modules are hidden unless the returned local permission grants the module. Hash navigation to a denied module falls back to the overview.
7. `integration_client` is not a valid human-session role. Repository and PostgreSQL paths reject an integration-only human membership/session.
8. Viewer and tenant-administrator shells expose different module sets according to `src/security/rbac.ts`; neither receives `platform:admin` without that local role.
9. Session rotation replaces the cookie and CSRF value; logout revokes the session and returns the shell to the unauthenticated state.
10. Shell responses use no-store caching, no CORS, strict same-origin CSP, frame denial, referrer suppression, COOP/CORP, Permissions-Policy, and nosniff.
11. The shell includes semantic landmarks, skip navigation, keyboard-visible focus, responsive layouts, reduced-motion handling, live status regions, and Spanish UI text.
12. Invalid or unexpected session payloads fail closed and do not render role-aware content.
13. Deterministic browser execution is test evidence only. It does not satisfy a productive IdP prerequisite or count any of the twelve authenticated product journeys.

## Permission-to-module mapping

| Module | Required local permission |
|---|---|
| Overview | authenticated session |
| Consulta y evidencia | `evidence:query` |
| Procedimientos | `procedure:read` |
| Casos | `case:read` |
| Fuentes | `source:read` |
| Documentos | `document:read` |
| Ingesta | `document:ingest` |
| Autoría | `procedure:draft` |
| Revisión | `procedure:review` |
| Aprobación | `procedure:approve` |
| Identidad y acceso | `identity:manage` |
| Auditoría | `audit:read` |
| Plataforma | `platform:admin` |

`integration:query` has no human-shell module.

## Acceptance criteria

- Static/HTTP focused tests validate security headers, fail-closed states, accessible structure, permission declarations, no browser credential storage, official return path, and integration-role exclusion.
- A real Chromium smoke completes deterministic login for `viewer` and `tenant_admin`, validates role-aware visibility, rotates the session, logs out, and verifies zero exposed/document cookies or Web Storage credentials.
- Migration 017 and its non-owner runtime gate prove that integration-only human memberships cannot resolve or create a human session.
- `EVAL-HUMAN-PRODUCT-SHELL-001`, typecheck, build, full regression, structured validation, dependency audit, secret/PII scan, and diff checks pass.
- The productive authenticated browser count remains `0/12`.

## Explicit limitations

- No productive IdP, external OIDC interoperability, client registration, MFA/recovery, access review, or human provisioning operation exists.
- Product modules are role-aware shell surfaces; they do not yet implement all authenticated data workflows.
- No real ephemeral environment or external user journey is exercised.
- Chromium deterministic execution is not production authentication evidence.
- This feature is not production readiness.
