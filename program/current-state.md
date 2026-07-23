# LA Muni RAG — Current Program State

Updated: 2026-07-23T07:03:38Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 074 provides a guarded, cost-bounded Cloud SQL staging plan with named billing/emergency ownership and conditional spend authorization, while live GCP control verification, real corpus, human identity, managed staging execution and production release remain absent**

## Authoritative checkout

```text
workspace_id: 090ec1e4-f130-4801-addd-f6ecb198744a
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
functional_commit: afa0a427080ed7b9555a9ee5a3c7c77d9a2067cd
remote_base_ref_before_push: 7a00f3ee902cb6dd41c153d3ebfb7c943b50f7a1
working_tree: clean before administrative-owner reconciliation
pull_request: 24 draft at remote SHA dc7644def4e223deef30d15c2194bb9f6d29c549
merged: false
cloud_staging_deployed: false
production_deployed: false
cloud_resources_created: false
billable_actions: 0
cost_generated: USD 0
remote_program_checkpoint: dc7644def4e223deef30d15c2194bb9f6d29c549
push_status: published_through_ci_reconciled_checkpoint
preserved_pre_sync_stash: stash@{0}
```

`AGENTS.md` and `RTK.md` remain authoritative. Merge, deployment, paid infrastructure, project/billing mutation, production credentials and legal conclusions remain human-gated.

## Feature 074 — guarded Cloud SQL staging v1

The plan-only module now records the project-owner inputs without treating them as authorization:

```text
project_id: rag-municipalidades
project_number: 1059368783280
region: us-central1
connectivity: AUTH_PROXY_PUBLIC time-bounded pilot
proposed_pilot_budget_usd: 1
selected_tier: db-custom-1-3840
reviewed_hourly_compute_usd: 0.06755
max_pilot_runtime_hours: 4
estimated_compute_and_memory_usd: 0.2702
billing_owner: Eduardo Sacahui
emergency_stop_teardown_owner: Eduardo Sacahui
operational_contact: verified out of band; not committed
spend_authorized: true for a future controlled pilot subject to remaining gates
billing_approved: false
budget_approved: false
data_residency_approved: false
allow_billable_resources: false
```

The estimate excludes storage, backups, network, taxes and other charges. It is a plan guard, not a GCP hard cap. Current pricing must be re-reviewed immediately before any resource-bearing plan. A USD 1 budget does not support an always-on instance at the selected tier; only a short, explicitly approved pilot is modeled.

The Terraform boundary:

- produces zero resource changes with the committed project-specific example;
- requires exact confirmation, billing, budget, residency and bounded cost review before resource planning;
- permits exactly SQL Admin API enablement and one protected PostgreSQL 16 Enterprise instance in the approved offline shape;
- configures no authorized network for the Auth Proxy pilot and requires connector enforcement;
- retains IAM database authentication, backups, PITR, bounded SSD growth, Query Insights and dual deletion protection;
- contains no SQL user, plaintext password, `terraform apply` or `terraform destroy` automation;
- exposes named root preflight/eval scripts and a Backend CI eval step.

BigQuery Vector Search was not adopted as a persistence replacement. The current product depends on PostgreSQL transactions, forced RLS, relational constraints, migrations, pgvector repositories and non-owner runtime roles. Replacing those controls is a separate architecture program, not a deployment shortcut.

## Verification

Current working tree:

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 13/13 pass
EVAL-PRODUCTION-PUBLIC-SURFACE-001: 33/33 pass
Terraform 1.15.8 fmt: pass
Terraform init -backend=false: pass
Terraform validate: pass
project-specific zero plan: 0 resource changes
approved offline shape: exactly 2 addresses
approved offline estimated compute/memory: USD 0.2702 / 4 hours
typecheck: pass
```

Remote validation state:

```text
Terraform validation run: 29982927884 success
Backend CI run: 29982927859 success
PR: #24 draft at dc7644def4e223deef30d15c2194bb9f6d29c549
```

No GCP API was enabled, no instance was created, no billing operation was performed and no Terraform apply occurred.

## Cumulative verified capabilities

- tenant identity/RBAC and transaction-local forced RLS;
- source/document/procedure catalog APIs;
- artifact acceptance, ingestion jobs, leases/fencing and tenant vectors;
- Search, conservative EvidenceBundle and disabled-by-default public query gateway APIs;
- ProcedureQuery, ClaimPack, EvidenceGap, workflow lifecycle and ProcedureCase APIs;
- provider-side consumer contract kits;
- fail-closed public product shell and Procedure Academy;
- disposable PostgreSQL runner for all twenty API/system staging journeys;
- plan-only, cost-bounded Cloud SQL staging target;
- accessibility, corruption, restore, boundary, tenant, artifact and vector hard gates.

## Current corpus truth

```text
source inventory records: 17
verified records: 4
records with acquisition metadata: 1
controlled acquired bytes present in this checkout: 0
records credited as ingested: 0
records retrieval-validated against real corpus: 0
```

Synthetic fixtures, offline plans and database gates do not change those values.

## Next execution sequence

1. Preserve the successful Backend CI and Terraform validation receipts for the current published head.
2. Verify the named billing role, actual USD 1 budget alerts, residency, IAM and Terraform-state controls.
3. Re-review current Cloud SQL pricing and produce a human-reviewed resource-bearing plan only.
4. After separate authorization, provision a short synthetic-only Cloud SQL pilot and execute the existing twenty journeys.
5. Obtain rights, durable storage, scanner, retention/legal-hold and named reviewers for the Antigua-first corpus.
6. Acquire, scan, ingest and judge real public evidence.
7. Implement human IdP/BFF/session and role-aware authenticated UI, then execute browser E2E.
8. Complete external consumer, edge/load/SLO, HA/recovery/privacy, protected merge, rollout and observation gates.

## Critical blockers


- `BLK-GCP-SPEND-074`: billing/emergency ownership and conditional spend authorization are recorded, but direct billing-role verification, budget alerts, residency, IAM/state and final live-plan approval are absent;
- `PQG-OPEN-ENABLEMENT-001`: public gateway cannot be enabled without authorized ingested evidence, edge controls, deployed staging and approval;
- `BLK-CORPUS-OPS-001`: source rights, durable object storage, scanner and retention/legal-hold controls are unavailable;
- the minimum Antigua-first and comparative corpus is incomplete;
- zero documents are credited as ingested and no judged real-corpus retrieval evidence exists;
- no approved human IdP/BFF/session or authenticated role-aware UI; twelve browser journeys remain blocked;
- external consumer repositories have not executed their suites;
- no managed GCP staging execution, observability/SLO, load/HA, coordinated recovery or privacy operation exists;
- no protected merge, production deployment or observation window exists.

## Persistent boundary assertions

- A disabled project-specific Terraform example is not spend authorization.
- A budget alert or repository estimate is not a hard spending cap.
- An offline approved-shape plan is not a plan against live GCP state and creates no resource.
- Disposable API/system staging is not deployed cloud staging or production.
- The twelve browser journeys remain blocked; they were not counted as passed.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is implemented.
- There is no production object store, scanner/definitions monitor or dispatcher operating.
- Browser authentication/session architecture is not implemented. Human IdP/BFF/session, access review and role-aware navigation remain unimplemented.
- Provider-side kits do not prove external interoperability.
- A green feature branch, draft PR or synthetic receipt is not production readiness.
