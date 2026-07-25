# LA Muni RAG — Current Program State

Updated: 2026-07-25T15:48:48Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 074 has a verifier-approved immutable plan, a temporary single-owner governance exception and final hash-bound execution authorization for 09:00-13:00 America/Guatemala; apply, managed staging execution, teardown, real corpus, human identity and production release remain open**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
evidence_baseline_head: 2213de5e9f43657d9341c6f87828b14aabb1c30e
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

Authenticated Cloud Shell then generated an exact two-create resource plan from head
`8d6991d7d025b41a6e26a02c3bc6a034a36e90ca`. The plan retained PostgreSQL 16,
connector enforcement, encrypted-only transport, IAM database authentication, backups,
PITR, bounded SSD, Query Insights and both deletion-protection layers. It is rejected and
not eligible for apply because the required `owner=eduardo-sacahui` label was absent.
No Cloud SQL instance was created and `terraform apply` was not run.

A subsequent manual regeneration attempt started from the Cloud Shell home directory and
failed before plan creation because no Terraform configuration or `package.json` was
present there. Empty derivative files and the trailing success echo are not evidence. The
repository now provides a self-locating fail-fast generator that verifies all prerequisites,
builds in a temporary directory and atomically publishes only verifier-approved non-empty
artifacts. No Cloud SQL instance was created and `terraform apply` was not run.

The self-locating generator was then executed successfully from authenticated Cloud Shell
at repository head `e7c4393b0655d3c660941778ff47b1f31e6be57d`. The corrected immutable plan contains exactly SQL
Admin API enablement and one protected PostgreSQL instance, includes
`owner=eduardo-sacahui`, and the reusable verifier returned `status=valid` with no issues.
The published artifact directory is `approved-live-v2-e7c4393b0655-20260725T152522Z`. Its plan, JSON, text and verification
SHA-256 values are recorded in the evidence register. This is technical plan verification,
not final execution authorization. No Cloud SQL instance was created and `terraform apply`
was not run.

A temporary single-owner governance exception was accepted because no second approved
human GCP principal exists for the pilot; the assistant is not an IAM principal and does
not count as redundancy. The exception and exact-plan authorization expire at teardown or
2026-07-25 13:00 America/Guatemala. Final execution authorization covers only the four
recorded SHA-256 values of `approved-live-v2-e7c4393b0655-20260725T152522Z`. A
fail-closed manual applicator has been added. At this checkpoint, authorization exists but
`terraform apply` has not yet run and Cloud SQL has not been created.

## Verification

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 14/14 pass
full regression: 870 total / 868 pass / 0 fail / 2 environment skips
Bash syntax: pass
Typecheck: pass
Build: pass
Terraform validation workflows 30163816198 / 30163815155: success
Backend CI workflows 30163816219 / 30163815112: success
project-specific disabled offline plan: 0 resource changes
live GCS-backed disabled plan: 0 resource changes; resources_enabled=false
approved offline shape: SQL Admin API plus one protected Cloud SQL instance
first live resource plan: 2 creates; rejected_missing_owner_label
corrected live resource plan: 2 creates; verifier_status=valid; final_authorization=true
governance exception: single_owner_pilot_only; expires=2026-07-25T13:00:00-06:00_or_teardown
authorized execution window: 2026-07-25T09:00:00-06:00..2026-07-25T13:00:00-06:00
corrected plan evidence head: e7c4393b0655d3c660941778ff47b1f31e6be57d
live plan generator: self-locating, fail-fast, state-locked, atomic verified-artifact publish
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

1. Execute the exact authorized plan through the fail-closed applicator before 13:00
   America/Guatemala.
2. Execute the synthetic-only managed staging run and teardown controls within the same
   authorized window.
3. Record apply, runtime, cleanup and cost receipts.
4. Continue corpus, human identity, browser E2E, external consumer, edge/load/SLO,
   recovery/privacy, protected merge and production-release work.

## Critical blockers

- Feature 074 spend/owner gates are resolved only for the exact 09:00-13:00 pilot; apply, managed execution and teardown receipts remain pending;
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
