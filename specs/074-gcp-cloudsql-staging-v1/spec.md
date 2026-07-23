# Feature 074 — GCP Cloud SQL staging v1

Status: plan-ready; external resource creation remains human-gated.

## Goal

Provide a plan-only, auditable Cloud SQL PostgreSQL 16 target that can later run the
existing twenty API/system staging journeys through Cloud SQL Auth Proxy without
creating resources from repository CI.

## Acceptance

- Default Terraform creates zero resources.
- A resource-bearing plan requires exact confirmation plus billing, budget and
  data-residency approvals.
- The approved plan contains only Cloud SQL API enablement and one protected instance.
- Private IP is default; public pilot has no authorized networks and requires connectors.
- PostgreSQL 16 Enterprise, bounded SSD, backups, PITR, IAM auth and Query Insights are explicit.
- No plaintext database password or automatic infrastructure mutation path exists.
- Preflight validates Cloud SQL, pgvector, admin capability and dedicated-instance state.
- The existing 20-journey runner is reused unchanged.

## Non-goals

No project creation, billing enablement, resource provisioning, production/shared data,
public gateway enablement, browser E2E, load/HA proof, merge or deployment.
