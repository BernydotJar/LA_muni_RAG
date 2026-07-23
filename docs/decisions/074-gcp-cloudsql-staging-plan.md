# Decision 074 — Gate Cloud SQL staging behind a zero-resource Terraform default

## Decision

Adopt a dedicated Cloud SQL for PostgreSQL 16 Enterprise instance as the first managed
GCP staging target. The committed Terraform default creates zero resources. A
resource-bearing plan requires an explicit enablement flag, exact confirmation, billing
approval, budget approval, data-residency approval and a bounded pilot-cost review.

The project owner supplied project ID `rag-municipalidades`, project number
`1059368783280`, region `us-central1`, a proposed USD 5 pilot budget and
`AUTH_PROXY_PUBLIC` connectivity. These values are recorded in a disabled example and
do not constitute billing approval or spend authorization.

Private IP remains the target posture. The supplied pilot mode configures no authorized
networks, enforces connectors and must use Cloud SQL Auth Proxy or a supported language
connector. IAM database authentication, backups, PITR, bounded storage growth, Query
Insights and both Terraform and Cloud SQL deletion protection remain mandatory.

The selected `db-custom-1-3840` tier was reviewed in July 2026 at approximately USD
0.06755/hour for compute and memory in `us-central1`. The approved-shape offline plan
uses a maximum four-hour window, producing a USD 0.2702 compute/memory estimate before
storage, backups, network, taxes or other charges. Pricing must be re-reviewed before
any resource-bearing plan. A USD 5 budget is incompatible with an always-on instance at
this tier and is therefore a time-bounded pilot constraint only.

Repository automation is validation-only. Provisioning, destruction, project creation,
billing enablement, IAM assignment and paid operation remain human-gated. GCP budget
alerts are operational notifications, not a hard spending cap; the repository cost gate
is likewise a planning control rather than an enforcement guarantee.

## Rationale

The existing Feature 073 runner already proves twenty API/system journeys. Reusing that
runner against a dedicated managed PostgreSQL service gives higher-fidelity database,
network and operational evidence without creating a second test matrix. Independent
approvals and an explicit runtime/cost envelope prevent a copied confirmation string or
project ID from authorizing spend by itself.

BigQuery Vector Search is not adopted as the persistence replacement in this slice. The
current product depends on PostgreSQL transactions, forced RLS, migrations, relational
constraints, pgvector repositories and non-owner runtime roles. Replacing those controls
would be a separate architecture program, not a cheaper deployment toggle.

## Consequences

This feature proves a validated production-shaped plan, not a deployed environment. The
first approved run uses synthetic fixtures only and does not prove real-corpus quality,
human identity, browser E2E, load/HA, production readiness, merge or deployment.
