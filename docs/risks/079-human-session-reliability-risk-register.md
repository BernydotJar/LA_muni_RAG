# Feature 079 risk and failure review

Date: 2026-07-27
Scope: local BFF/shell telemetry, load, failure injection and recovery evidence

| Risk / failure | Control implemented | Verification | Residual risk / next gate |
|---|---|---|---|
| Metrics become identity/session logs | exact five-field event contract; no identifiers, URL, agent, IP, body, query or error text | telemetry serialization test and named EVAL | productive exporter access/retention still requires privacy review |
| High-cardinality label explosion | finite operation/method/outcome enums; status and bounded duration only | event validator rejects unknown fields/values | future exporter must preserve the contract |
| Telemetry outage breaks login | no-op default; exporter call isolated in `finally`; exceptions swallowed | throwing exporter test | silent exporter loss needs productive health/alert design |
| Wall-clock change corrupts latency | injected monotonic clock; duration clamp and rounding | contract/EVAL assertions | process suspension and clock implementation need runtime monitoring |
| Repository outage leaks secrets | generic 500, no internal text, no cookie mutation before authentication | transient repository failure test | database outage/retry storms and circuit breaking absent |
| Provider outage leaves partial session | state/code consumed before exchange; generic 503; session cleared; fresh login required | transient provider exchange test | productive IdP retry/backoff/outage UX absent |
| Concurrent rotation creates two sessions | repository atomic rotation; one winner, contenders denied | concurrent rotation test | multi-instance/database contention needs managed-state load evidence |
| Loopback latency could be misreported as a production SLO | output says local/non-productive; conservative thresholds; no productive SLO claim | harness output and named EVAL | representative TLS/ingress/IdP/Cloud SQL/user load absent |
| Harness ignores expected denials | expected 401 count separated from unexpected/server errors | load assertions and telemetry summary | productive SLI semantics need approved error-budget policy |
| In-memory collector leaks or grows indefinitely | test-only process-local collector; no production composition | source/EVAL assertions | productive aggregation/storage architecture absent |
| Recovery evidence omits restart/failover | limitation explicitly documented | operations doc and program blockers | process restart, backup restore, DB failover and regional recovery required |
| Added instrumentation regresses auth | existing BFF/shell focused, PostgreSQL, browser and full regression gates | release gate | exact-SHA remote CI unavailable while audited push is disabled |

## Review conclusion

The increment adds useful local regression and recovery evidence without introducing an identity-bearing telemetry stream. It does not establish a productive observability platform, error budget, capacity limit, availability target or disaster-recovery capability.
