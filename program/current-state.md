# LA Muni RAG — Current Program State

Updated: 2026-07-25T05:08:10Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 074 now has verified live billing, budget, residency, state-bucket IAM recovery and a live zero-resource plan; owner redundancy, resource-bearing plan approval, managed staging execution, real corpus, human identity and production release remain open**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
evidence_baseline_head: b0a267401e18f9470c4c248da506fd5ee22938d7
working_tree_at_baseline: clean
pull_request: 24 draft
merged: false
cloud_sql_instance_created: false
terraform_apply_executed: false
production_deployed: false
```

`AGENTS.md` and `RTK.md` remain authoritative. Merge, production deployment, Cloud SQL
apply, protected-branch mutation and destructive operations remain human-gated.

## Feature 074 — guarded Cloud SQL staging v1

```text
project_id: rag-municipalidades
project_number: 1059368783280
region: us-central1
connectivity: AUTH_PROXY_PUBLIC time-bounded pilot
terraform_planning_budget_usd: 1
live_billing_currency: COP
live_monthly_budget_cop: 4000
reviewed_hourly_compute_usd: 0.08775
max_pilot_runtime_hours: 4
estimated_compute_and_memory_usd: 0.351
billing_owner: Eduardo Sacahui
emergency_stop_teardown_owner: Eduardo Sacahui
spend_authorized: conditional for a future controlled pilot
committed_allow_billable_resources: false
```

Authenticated Cloud Shell evidence verified the linked billing account, Billing Account
Administrator role, the project-scoped COP 4,000 recurring budget and 50/90/100 alerts,
and an effective resource-location policy that allows `us-central1`. It also created a
dedicated Standard regional GCS state bucket with public access prevention, uniform
bucket-level access, versioning, seven-day soft delete and approved labels.

The state-bucket recovery completed successfully through authenticated `--apply` and
`--check` executions. The final bucket policy contains bucket-scoped Storage Admin for the
approved operator and no legacy convenience bindings; the temporary project-level grant
was removed before completion. Authenticated Terraform 1.15.8 then initialized the GCS
backend and produced a live plan with zero resource changes and
`resources_enabled=false`; the local plan and JSON artifacts were removed. Only one
project owner was observed.

The USD value remains the Terraform cost-review envelope; the COP value is the actual
Cloud Billing budget. Neither is a hard cap. Official pricing was re-reviewed on
2026-07-24: USD 0.08775/hour compute+memory, USD 0.351 for four hours and
USD 0.38826024 including 20 GiB SSD before backups, network and taxes.

## Verification

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 14/14 pass
full regression: 870 total / 868 pass / 0 fail / 2 environment skips
Bash syntax: pass
Typecheck: pass
Build: pass
Terraform validation workflow 30131987981: success
Backend CI workflow 30131987996: success
project-specific disabled offline plan: 0 resource changes
live GCS-backed disabled plan: 0 resource changes; resources_enabled=false
approved offline shape: SQL Admin API plus one protected Cloud SQL instance
cloud_sql_instance_created: false
terraform_apply_executed: false
```

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic fixtures, administrative GCP controls and offline plans do not change corpus
truth.

## Next execution sequence

1. Decide whether to add a second appropriate human project owner or record an accepted
   governance exception.
2. Generate the exact resource-bearing plan constrained to SQL Admin API enablement and
   one protected PostgreSQL instance, using the 2026-07-24 reviewed price inputs.
3. Obtain final authorization tied to that exact plan, start time and four-hour window.
4. Execute the synthetic-only managed staging run and teardown controls.
5. Continue corpus, human identity, browser E2E, external consumer, edge/load/SLO,
   recovery/privacy, protected merge and production-release work.

## Critical blockers

- `BLK-GCP-SPEND-074`: owner redundancy decision, exact resource-bearing plan review
  and final apply authorization remain open;
- `PQG-OPEN-ENABLEMENT-001`: public gateway lacks authorized ingested evidence, edge
  controls, deployed staging and approval;
- `BLK-CORPUS-OPS-001`: source rights, durable object storage, scanner and
  retention/legal-hold controls are unavailable;
- no approved human IdP/BFF/session or authenticated role-aware UI; twelve browser
  journeys remain blocked;
- external consumer repositories have not executed their suites;
- no managed Cloud SQL staging execution, observability/SLO, load/HA, coordinated
  recovery or privacy operation exists;
- no protected merge, production deployment or observation window exists.

## Persistent boundary assertions

- Live budget alerts are not a hard spending cap.
- A protected state bucket is not a Cloud SQL deployment.
- There is no production object store, scanner/definitions monitor or dispatcher operating.
- Zero documents are credited as ingested; the minimum Antigua-first and comparative corpus is incomplete.
- Browser authentication/session architecture is not implemented; human IdP/BFF/session, access review and role-aware navigation remain unimplemented.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is implemented.
- An offline approved-shape plan is not a plan against live GCP state.
- A live Terraform plan is not authorization to apply it.
- Disposable API/system staging is not production.
- The twelve browser journeys remain blocked and were not counted as passed.
- Provider-side kits do not prove external interoperability.
- A green feature branch, draft PR or synthetic receipt is not production readiness.
