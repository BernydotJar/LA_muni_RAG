# Feature 074 — GCP Cloud SQL staging v1

Status: plan-ready; project inputs recorded; external resource creation remains human-gated.

## Goal

Provide a plan-only, auditable Cloud SQL PostgreSQL 16 target that can later run the
existing twenty API/system staging journeys through Cloud SQL Auth Proxy without
creating resources from repository CI.

## Acceptance

- Default Terraform creates zero resources.
- A resource-bearing plan requires exact confirmation, billing, budget, data-residency
  and bounded pilot-cost approval.
- The approved plan contains only Cloud SQL API enablement and one protected instance.
- The supplied project ID/number, region, connectivity and USD 5 pilot envelope are
  recorded in a disabled example.
- The selected tier is constrained to a maximum four-hour reviewed pilot; persistent
  USD 5/month staging is explicitly rejected.
- Private IP is default; public pilot has no authorized networks and requires connectors.
- PostgreSQL 16 Enterprise, bounded SSD, backups, PITR, IAM auth and Query Insights are explicit.
- No plaintext database password or automatic infrastructure mutation path exists.
- Preflight validates Cloud SQL, pgvector, admin capability and dedicated-instance state.
- The existing 20-journey runner is reused unchanged.
- Root package scripts and Backend CI expose a named Feature 074 eval.

## Non-goals

No project creation, billing enablement, resource provisioning, production/shared data,
BigQuery persistence migration, public gateway enablement, browser E2E, load/HA proof,
merge or deployment.
