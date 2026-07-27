# Implementation plan

1. Define a closed low-cardinality telemetry contract around the existing BFF route boundary.
2. Use a no-op exporter by default and isolate exporter failure from authentication behavior.
3. Add an in-memory aggregate collector exclusively for tests and local harness evidence.
4. Inject transient repository and provider failures and verify generic errors plus safe recovery semantics.
5. Test concurrent session rotation so only one replacement can win.
6. Build a reproducible local load harness for shell reads, expected denials and complete BFF lifecycles.
7. Establish conservative local-only thresholds and explicitly reject a productive SLO interpretation.
8. Add named EVAL, CI wiring, operations/security/privacy documentation and traceability.
9. Re-run PostgreSQL, existing BFF/shell gates, full regression, audits, scans and structured validation.
10. Persist exact evidence and blockers without enabling productive telemetry, identity or browser journeys.
