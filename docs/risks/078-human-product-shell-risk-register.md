# Feature 078 risk and threat review

Date: 2026-07-27
Scope: same-origin role-aware shell using the Feature 077 BFF

| Threat / failure | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Bearer or readable token enters browser | no Authorization construction; HttpOnly cookie; CSRF only in memory; no Web Storage/URL/DOM logging | static source assertions and real Chromium storage/cookie checks | third-party script supply chain remains prohibited by CSP; productive telemetry configuration absent |
| Anonymous shell leaks tenant data | static shell contains no tenant data; authenticated workspace remains hidden until validated BFF payload | HTTP and browser smoke | future module data fetches require independent authorization tests |
| IdP claims escalate UI | shell consumes only local roles/permissions returned by BFF; closed allowlists | viewer/admin deterministic smoke; provider claim injection remains ignored by Feature 077 | productive provisioning and membership governance absent |
| Integration identity used as human | `integration_client` excluded in TypeScript repository and PostgreSQL resolve/create/auth/revoke paths | focused test, migration assertion, non-owner SQL gate | existing data cleanup/migration policy needed before productive onboarding |
| Hidden route reached by hash | denied hash target falls back to overview; hidden panels remain hidden | Chromium viewer smoke | backend remains authoritative; future client router needs equivalent guards |
| CSRF on bootstrap/rotation/logout | POST lifecycle; same-origin credentials; bootstrap proof; exact Origin and session CSRF in BFF | Feature 077 adversarial tests plus browser smoke | reverse-proxy Origin handling and deployment headers unverified |
| XSS reads CSRF or acts as user | no inline script, strict self-only CSP, no dynamic HTML injection, textContent/replaceChildren only | static assertions and CSP header tests | any future dynamic renderer or dependency requires renewed review |
| Clickjacking | CSP `frame-ancestors 'none'` and X-Frame-Options DENY | HTTP tests | none for current surface |
| Cross-origin data exposure | no CORS; CORP same-origin; COOP same-origin; referrer none | HTTP tests | approved external integrations must use service APIs, not the shell |
| Stale cached authenticated state | no-store headers; pageshow persisted bootstrap; logout clears state and URL hash | HTTP/browser smoke | browser/process crash and multi-tab coordination need future testing |
| Accessibility exclusion | semantic landmarks, skip link, focus visibility, responsive/reduced-motion rules, Spanish labels | static checks and Chromium interaction | screen reader, zoom, contrast and human review remain incomplete |
| False readiness claim from test adapter | output and docs explicitly identify deterministic provider and 0/12 productive journeys | named EVAL and program records | productive IdP and real ephemeral browser evidence remain blockers |

## Review conclusion

The shell safely demonstrates permission-aware session consumption under the deterministic BFF. It does not turn the local adapter into an approved human identity system, implement the module workflows, or satisfy production browser journeys.
