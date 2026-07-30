# Feature 078 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Same-origin authenticated shell | `src/humanShell/handler.ts`, `src/server.ts` | HTTP focused tests; Chromium smoke |
| No browser Bearer or readable session cookie | `src/humanShell/assets.ts`; Feature 077 HttpOnly cookie | source assertions; Chromium Web Storage/document-cookie checks |
| POST bootstrap, rotation and logout | shell JavaScript and Feature 077 handlers | focused source test; Chromium lifecycle smoke |
| Fail-closed anonymous/unavailable/error states | shell HTML/JS and disabled BFF default | HTTP 503 test; browser anonymous/login transition |
| Local-permission navigation | shell permission declarations and closed payload parser | permission canonicality test; viewer/admin browser comparison |
| Denied route fallback | `selectRoute` fallback to overview | viewer hash-navigation browser assertion |
| Human/service role separation | `HumanSecurityRole`, `isHumanSecurityRole`, migration 017 exclusions | focused repository test; migration assertion; SQL runtime gate |
| Session rotation and revocation | Feature 077 repository/BFF plus shell actions | Chromium cookie replacement and logout clearing |
| Strict browser headers | `src/humanShell/handler.ts` | HTTP CSP/cache/frame/COOP/CORP/referrer tests |
| Accessible shell foundation | semantic HTML, skip link, focus styles, responsive and reduced-motion CSS | static focused tests; keyboard/browser smoke; human review remains pending |
| Public Pages separation | server-only `/app`; no Pages artifact or public-site link | named EVAL and repository inspection |
| No false productive-authentication claim | spec/docs/program retain deterministic-only and `0/12` | named EVAL; program evidence |

## Named evaluation

`EVAL-HUMAN-PRODUCT-SHELL-001` verifies the server route, browser credential boundary, permission model, service-role exclusion, accessibility foundation, deterministic Chromium harness, CI wiring, Pages separation and explicit non-readiness statements.

## Executable evidence

- `npm run test:human-product-shell`
- `npm run eval:human-product-shell`
- `npm run smoke:human-product-shell-browser`
- `npm run test:human-session-bff`
- `db/tests/human_session_bff_runtime_gate.sql`

The deterministic browser smoke is local integration evidence only. It does not replace an approved IdP, real ephemeral deployment, external user, or any of the twelve authenticated product journeys.
