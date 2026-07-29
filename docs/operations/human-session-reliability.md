# Human session local reliability and telemetry

Status: local non-productive evidence only
Last reviewed: 2026-07-27

## Telemetry contract

The human BFF records one aggregate-friendly event for each handled route. Events contain exactly:

- operation: login, callback, session bootstrap, rotation or logout;
- method class: GET, POST or OTHER;
- outcome class: success, denied, unavailable or server error;
- HTTP status;
- monotonic duration in milliseconds, clamped to sixty seconds.

The contract intentionally excludes every user/session dimension. Tenant, principal, subject, session, request, role, permission, state, nonce, code, cookie, CSRF, issuer, URL, user-agent, IP address, body, query and error text are forbidden. This means the local collector can report route-level counts and latency percentiles but cannot reconstruct a person, tenant or session.

The default exporter is `NoopHumanSessionTelemetry`. No productive exporter is selected by environment inference. A deployment must explicitly compose any future exporter after privacy, retention, sampling, access and incident-review decisions.

## Failure isolation

Telemetry runs after the response and is observational only. Exporter exceptions are caught and cannot change status, cookies, revocation or authorization behavior.

The focused failure-injection gate establishes:

- repository authentication outage: generic 500, no internal error leakage, same unmodified session can be retried;
- provider code-exchange outage: generic 503, browser session state cleared, consumed transaction requires a fresh login;
- concurrent rotation: exactly one replacement succeeds, contenders fail, old token is rejected and the winning replacement remains usable;
- exporter outage: the original response remains unchanged.

These are bounded local semantics, not a complete incident-recovery plan.

## Local load harness

`scripts/human-session-reliability-harness.mjs` runs against a loopback server with the deterministic test provider and in-memory repository:

| Workload | Count |
|---|---:|
| Validated shell warm-up reads, excluded from percentiles | 12 |
| Measured static `/app` reads | 80 |
| Expected anonymous session denials | 40 |
| Full login/callback/bootstrap/rotate/logout cycles | 24 |
| Worker concurrency | 6 |

The warm-up validates the same `200` and `Cache-Control: no-store, max-age=0` shell contract before measurement. It prevents one-time process/client initialization from contaminating the steady-state percentile without weakening the threshold or counting failed warm-up requests as success. The gate then requires zero unexpected outcomes, exactly forty expected denials, no unavailable/server-error telemetry and the expected event count. Local thresholds are:

- shell p95 ≤ 500 ms;
- BFF event p95 ≤ 750 ms;
- individual BFF event max ≤ 2,500 ms.

These thresholds catch gross local steady-state regressions. They are not a cold-start objective or a production SLO because loopback execution excludes TLS, ingress, network, external IdP, managed database, multiple instances and real user/device behavior.

## Productive operations still required

Before any production SLO or availability claim, humans must approve and implement:

- telemetry exporter and access controls;
- sampling, retention, deletion and privacy notices;
- dashboards, alerts, burn-rate policy and on-call ownership;
- external IdP, ingress and managed database latency/error dimensions;
- multi-instance coordination and restart behavior;
- failure injection for network, database, provider, process and dependency outages;
- backup restore, database failover and regional recovery;
- capacity tests with representative data and authenticated workflows.

The official productive authenticated browser result remains `0/12`.
