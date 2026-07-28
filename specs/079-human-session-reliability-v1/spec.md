# Feature 079 — Human session local reliability, telemetry and recovery v1

Status: local non-productive evidence implemented; productive observability, SLOs and recovery operations remain absent

## Goal

Add a bounded, privacy-minimized telemetry contract and reproducible local reliability evidence for the Feature 077 BFF and Feature 078 shell. The increment must detect latency, expected denials and server failures without emitting tenant, principal, subject, session, request, code, cookie, CSRF, URL or free-form error values.

## Functional requirements

1. Every handled human-session route records one telemetry event after the response completes.
2. Telemetry operations are a closed set: `login`, `callback`, `session_bootstrap`, `session_rotate`, and `logout`.
3. Each event contains exactly five fields: operation, method class, outcome class, HTTP status and bounded duration in milliseconds.
4. Method values are `GET`, `POST` or `OTHER`; outcome values are `success`, `denied`, `unavailable` or `server_error`.
5. No event contains tenant, principal, subject, session, request, role, permission, state, nonce, code, cookie, CSRF, issuer, URL, user-agent, IP address, body, query or free-form error text.
6. The default exporter is no-op. Productive exporters, dashboards, alerts and retention require a separate reviewed deployment composition.
7. Exporter failure is isolated and must never alter authentication, authorization, rotation, logout or error responses.
8. Duration uses a monotonic clock, is clamped to 0–60,000 ms and rounded to millisecond precision suitable for aggregate analysis.
9. Transient repository failure returns the existing generic server error, leaks no internal text and allows a safe retry when no state mutation occurred.
10. Transient provider exchange failure returns the existing generic server error, clears browser session state and requires a fresh login because state/code have been consumed.
11. Concurrent rotation of one session permits exactly one replacement; all other contenders are denied, the old token remains revoked and the winning replacement remains usable.
12. The local load harness exercises static shell reads, expected anonymous denials and complete login/callback/bootstrap/rotate/logout cycles with bounded concurrency.
13. Local thresholds are deliberately conservative and non-productive: shell p95 ≤ 500 ms, BFF p95 ≤ 750 ms and individual BFF event max ≤ 2,500 ms on the disposable workspace.
14. The harness fails on unexpected HTTP outcomes, exporter server errors, unavailable responses, event-count mismatch or threshold breach.
15. Harness output explicitly labels the evidence local/non-productive, denies a productive SLO claim and preserves the official authenticated journey result at `0/12`.

## Acceptance criteria

- Focused reliability tests cover telemetry minimization, exporter isolation, repository recovery, provider failure recovery and concurrent rotation.
- `EVAL-HUMAN-SESSION-RELIABILITY-001` validates the closed telemetry contract, failure injection, load thresholds, documentation, CI wiring and non-production statements.
- The local load harness completes 80 shell requests, 40 expected anonymous denials and 24 complete five-operation BFF lifecycles at concurrency 6.
- Existing Feature 077 and Feature 078 tests remain green.
- Typecheck, build, full regression, PostgreSQL gate, structured validation, dependency audit, secret/PII scan and diff checks pass.
- No productive SLO, exporter, dashboard, alert, retention policy, deployment or authenticated journey is claimed.

## Explicit limitations

- Local loopback latency is not representative of TLS, ingress, network, managed database, external IdP or browser-user latency.
- The in-memory repository and deterministic provider do not establish managed-state capacity or provider availability.
- No productive telemetry backend, sampling policy, dashboard, alert, on-call rotation, burn-rate policy or retention/deletion operation exists.
- No multi-instance coordination, process restart recovery, database failover, backup restore or regional recovery is exercised.
- The official productive authenticated browser matrix remains `0/12`.
- The local evidence is not a production SLO and cannot be promoted into one without representative infrastructure, an approved policy and operational ownership.
- This feature is not production readiness.
