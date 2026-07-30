# ADR 079 — Low-cardinality human-session telemetry and local reliability evidence

Date: 2026-07-27
Status: accepted for local evidence; productive observability and SLO decisions pending

## Context

Features 077 and 078 establish a provider-neutral BFF and same-origin role-aware shell. They prove functional security properties but do not quantify regressions, classify expected denials, or exercise bounded failure recovery. Adding conventional request logs or high-cardinality metric labels would risk exposing identity/session material and create an operational contract before a productive telemetry platform is approved.

## Decision

Instrument the human-session route boundary with one closed telemetry event per handled request.

- Operations, methods and outcomes are finite enums.
- Events contain only operation, method class, outcome class, HTTP status and monotonic duration.
- No identity, tenant, session, request, URL, provider, client, browser or free-form error dimension is allowed.
- The default exporter is no-op; productive exporter selection cannot be inferred from environment variables.
- Exporter errors are swallowed after response handling and cannot alter authentication behavior.
- A test-only in-memory collector provides count and latency summaries.
- A local loopback harness establishes conservative regression thresholds but explicitly refuses a productive SLO claim.
- Failure injection covers repository authentication outage, provider exchange outage, exporter outage and concurrent rotation.

## Alternatives rejected

### Log full request context

Rejected. State, codes, cookies, subjects, tenant IDs, request IDs and errors are unnecessary for the bounded aggregate signals and would expand privacy/security risk.

### Label metrics by tenant, principal, session or provider subject

Rejected. These dimensions are high-cardinality, can become personal/security metadata and are not needed to detect route-level regressions.

### Select an OpenTelemetry backend now

Rejected as deployment and privacy policy work. Export destination, credentials, network path, sampling, retention, deletion, access and incident ownership require explicit human decisions.

### Treat loopback thresholds as production SLOs

Rejected. Local deterministic execution omits the productive identity provider, network, TLS, ingress, managed database, multi-instance contention and representative user workflows.

## Consequences

Positive:

- route-level latency and outcome regressions are observable without identity labels;
- exporter failure cannot make authentication unavailable;
- recovery semantics are executable and repeatable;
- concurrency protects against double session replacement;
- local thresholds provide a release regression gate.

Residual work:

- productive exporter, dashboards, alerts, burn rates and on-call ownership;
- representative managed-state load and capacity evidence;
- network/provider/database/process failure injection;
- restart, failover, backup restore and regional recovery;
- productive SLO/SLI definitions and error budgets;
- complete authenticated workflows and external users.
