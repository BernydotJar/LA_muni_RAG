# Decision 074 — Gate Cloud SQL staging behind a zero-resource Terraform default

## Decision

Adopt a dedicated Cloud SQL for PostgreSQL 16 Enterprise instance as the first managed
GCP staging target. The committed Terraform default creates zero resources. A
resource-bearing plan requires an explicit enablement flag, exact confirmation, billing
approval, budget approval, data-residency approval and a bounded pilot-cost review.

The project owner supplied project ID `rag-municipalidades`, project number
`1059368783280`, region `us-central1`, a USD 1 planning envelope and
`AUTH_PROXY_PUBLIC` connectivity. Eduardo Sacahui is the named billing owner and
emergency stop/teardown owner. His contact address is maintained outside the repository.
Spend authorization is confirmed for a future controlled pilot.

Authenticated Cloud Shell evidence later verified the linked COP billing account, Billing
Account Administrator assignment, a project-scoped COP 4,000 monthly budget with 50%,
90% and 100% current-spend alerts, an effective resource-location policy that permits
`us-central1`, and a protected regional GCS state bucket. The first legacy-IAM cleanup
removed bucket-policy administration too early; commit `ce01163` adds an idempotent
recovery that establishes bucket-scoped `roles/storage.admin` before removing legacy
bindings and removes any temporary project-level grant afterward. Project-owner
redundancy, current price review and final approval of the exact live plan remain open.

Private IP remains the target posture. The supplied pilot mode configures no authorized
networks, enforces connectors and must use Cloud SQL Auth Proxy or a supported language
connector. IAM database authentication, backups, PITR, bounded storage growth, Query
Insights and both Terraform and Cloud SQL deletion protection remain mandatory.

The selected `db-custom-1-3840` tier was reviewed in July 2026 at approximately USD
0.06755/hour for compute and memory in `us-central1`. The approved-shape offline plan
uses a maximum four-hour window, producing a USD 0.2702 compute/memory estimate before
storage, backups, network, taxes or other charges. Pricing must be re-reviewed before
any resource-bearing plan. The COP 4,000 live budget and USD 1 Terraform planning envelope are both
incompatible with an always-on instance at this tier and therefore constrain only a
time-bounded pilot.

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
