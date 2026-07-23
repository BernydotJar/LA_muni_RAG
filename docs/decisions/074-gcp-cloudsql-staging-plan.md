# Decision 074 — Gate Cloud SQL staging behind a zero-resource Terraform default

## Decision

Adopt a dedicated Cloud SQL for PostgreSQL 16 Enterprise instance as the first managed
GCP staging target. The committed Terraform default creates zero resources. A
resource-bearing plan requires an explicit enablement flag, exact confirmation, billing
approval, budget approval and data-residency approval.

Private IP is the target posture. A time-bounded pilot may select
`AUTH_PROXY_PUBLIC`, but it configures no authorized networks, enforces connectors and
must use Cloud SQL Auth Proxy or a supported language connector. Enable IAM database
authentication, backups, PITR, bounded storage growth, Query Insights and both Terraform
and Cloud SQL deletion protection.

Repository automation is validation-only. Provisioning, destruction, project creation,
billing enablement, IAM assignment and paid operation remain human-gated.

## Rationale

The existing Feature 073 runner already proves twenty API/system journeys. Reusing that
runner against a dedicated managed PostgreSQL service gives higher-fidelity database,
network and operational evidence without creating a second test matrix. Independent
approvals prevent a copied confirmation string from authorizing spend by itself.

## Consequences

This feature proves a validated production-shaped plan, not a deployed environment. The
first approved run uses synthetic fixtures only and does not prove real-corpus quality,
human identity, browser E2E, load/HA, production readiness, merge or deployment.
