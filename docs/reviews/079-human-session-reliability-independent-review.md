# Feature 079 independent implementation review

Date: 2026-07-27
Review model: Producer → Critic / Red Team → Fixer → Independent Verifier → Release Gate

## Producer result

Added a closed low-cardinality human-session telemetry boundary, no-op default exporter, test-only aggregate collector, transient repository/provider failure injection, concurrent rotation recovery evidence and a bounded local load harness for the BFF and shell.

## Critic / Red Team findings

1. **Conventional request telemetry could become an identity/session log.** Required an exact five-field event with no tenant, principal, session, request, state, code, cookie, CSRF, issuer, URL, IP, user-agent, body, query or error text.
2. **Exporter failure could turn observation into an availability dependency.** Required a no-op default and complete exception isolation after response handling.
3. **Wall-clock timestamps could produce negative or misleading latency.** Required an injected monotonic clock, lower/upper clamp and bounded precision.
4. **A provider exchange retry could replay consumed state/code.** Required the recovery contract to clear browser session state and demand a fresh login.
5. **A repository authentication outage should not revoke an untouched session.** Required generic failure followed by a successful retry of the same token.
6. **Concurrent rotation could create multiple replacements.** Required an executable one-winner/two-contender test and validation of the surviving replacement.
7. **Expected authentication denials could be misclassified as availability failures.** Required separate denied/unavailable/server-error outcome classes and exact expected counts.
8. **Loopback latency could be misreported as a production SLO.** Required explicit local/non-productive classification, conservative regression thresholds and `productiveSloClaim: false`.

## Fixer changes

- added finite operation, method and outcome enums plus exact event validation;
- added monotonic duration measurement, rounding and clamping;
- made no-op telemetry the default and isolated exporter exceptions;
- added leakage checks over state, code, cookies, CSRF, issuer/subject and identity IDs;
- added repository/provider outage and recovery tests;
- added concurrent rotation winner/loser verification;
- added a bounded load harness with expected event/outcome counts and local latency thresholds;
- documented the missing productive exporter, alerts, capacity, restart/failover and recovery controls.

## Independent verifier evidence

At implementation checkpoint:

- focused reliability/failure-injection tests: implemented;
- existing Feature 077 and Feature 078 focused gates: passing after instrumentation;
- TypeScript typecheck and build: passing;
- local reliability harness: implemented with 80 shell reads, 40 expected denials, 24 complete BFF lifecycles and concurrency 6.

The exact focused count, named EVAL, measured latency output, PostgreSQL/browser regression, full integrated regression, scans and exact functional SHA are recorded after the release gate completes.

## Release-gate judgment

Current judgment: **local release gate passed; implementation candidate, not production ready**.

The telemetry and harness are safe local regression tools. They do not establish productive SLOs, a telemetry platform, alerts, error budgets, representative capacity, managed failover, backup restore or disaster recovery.

## Exact-SHA CI repair — 2026-07-29

Backend CI run `30424332058` passed the complete unit/EVAL/PostgreSQL sequence and then failed the local reliability harness because the first concurrent shell wave included one-time process/client initialization, producing shell p95 `1048.381 ms` against the unchanged `500 ms` steady-state threshold.

The repair did not raise or disable any threshold. It added 12 bounded shell warm-up requests that must return `200` with `Cache-Control: no-store, max-age=0`; only the following 80 requests contribute to the measured percentile. Three independent post-repair harness executions passed with shell p95 values `4.358 ms`, `3.616 ms` and `3.707 ms`, 160 expected BFF telemetry events per run and zero unexpected failures.

Independent judgment: **localized reliability repair accepted for remote re-verification**. The evidence remains local, deterministic and non-productive. It does not establish cold-start performance, a production SLO, managed capacity, external IdP availability or operational readiness.
