# Authenticated role-aware product shell

Status: local deterministic foundation verified; productive authentication and browser journeys absent
Last reviewed: 2026-07-27

## Surface

The API server exposes:

- `/app` — semantic product shell;
- `/app/shell.css` — responsive, reduced-motion-aware styling;
- `/app/shell.js` — same-origin BFF session lifecycle and permission rendering.

These files are not part of the public GitHub Pages build. The shell can load without a session, but it renders no tenant workspace until `POST /auth/session` returns a valid locally authorized session.

## Session behavior

The shell never reads the HttpOnly cookie. It calls the BFF with `credentials: same-origin`, `Cache-Control: no-store` behavior, and POST-only lifecycle operations:

- bootstrap: `POST /auth/session` with `x-session-bootstrap: v1`;
- rotation: `POST /auth/session/rotate` with the in-memory CSRF value;
- logout: `POST /auth/logout` with the in-memory CSRF value.

The CSRF value is never displayed, persisted, placed in a URL, or written to Web Storage. The shell does not accept or construct an Authorization/Bearer header. Unexpected session payloads fail closed.

## Role-aware navigation

The BFF returns roles and effective permissions derived from local membership. The shell validates both against closed allowlists and reveals modules only when the corresponding permission exists. Direct hash navigation to a denied module resolves to the overview.

A human session cannot carry the `integration_client` role. The in-memory repository, PostgreSQL resolution, session creation, authentication, and revocation paths exclude that service-only role.

## Browser security headers

Every shell response includes:

- `Cache-Control: no-store, max-age=0` and `Pragma: no-cache`;
- CSP with `default-src 'none'`, same-origin script/style/connect, no frames, no objects, and same-origin form actions;
- `Cross-Origin-Opener-Policy: same-origin`;
- `Cross-Origin-Resource-Policy: same-origin`;
- `Permissions-Policy` disabling camera, geolocation, microphone, payment, and USB;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`.

No permissive CORS header is emitted.

## Accessibility

The shell provides Spanish labels, a skip link, semantic header/navigation/main landmarks, live status regions, visible keyboard focus, responsive navigation, a 320-pixel minimum layout, and reduced-motion handling. Automated checks are complementary; human accessibility review remains required before release.

## Verification boundary

A deterministic Chromium smoke verifies `viewer` and `tenant_admin` visibility, same-origin login, rotation, logout, HttpOnly cookie behavior, and empty local/session storage. That smoke uses the test-only provider and does not prove productive IdP interoperability or satisfy the twelve authenticated product journeys. Their official result remains `0/12`.
