# LA Muni RAG — Current Program State

Updated: 2026-07-25T23:57:58Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 075 adds a real public Chromium browser gate with 10/10 desktop/mobile executions; the managed Cloud SQL restart window expired without a successful run, and authenticated browser journeys, real corpus, destructive teardown and production release remain open**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
evidence_baseline_head: f2640400b6415fa7e5c12035c9e6d1a70f746cf9
working_tree_at_baseline: clean
pull_request: 24 draft
merged: false
cloud_sql_instance_created: true
cloud_sql_instance_state: STOPPED
activation_policy: NEVER
terraform_apply_executed: true
managed_staging_execution: false
teardown_executed: false
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
not count as redundancy. Final execution authorization covered only the four recorded
SHA-256 values of `approved-live-v2-e7c4393b0655-20260725T152522Z` during the bounded
09:00-13:00 America/Guatemala window.

Remote Terraform state and Cloud SQL operation history now prove that the exact two-resource
plan was applied. The instance create operation completed successfully and the initial
backup operation also completed. A later repeat invocation correctly refused because the
remote state already contained the SQL Admin API and Cloud SQL instance addresses. The
operator then changed activation policy from `ALWAYS` to `NEVER`; the update completed at
2026-07-25T18:42:49.466Z and the instance reports `STOPPED`, PostgreSQL 16, the approved
tier and labels, and deletion protection enabled. The exception expired on stop. No
synthetic managed staging journey or destructive teardown is claimed. The second restart
window expired at 17:25 America/Guatemala after one transient startup failure whose script
reported complete temporary-user cleanup and return to `STOPPED`; no retry or managed
journey receipt was captured before expiry.

## Feature 075 — public browser gate v1

Playwright 1.62.0 now executes the generated fail-closed Pages artifact in real Chromium
for desktop and Pixel 7 mobile emulation. Ten executions verify responsive geometry,
keyboard skip-link focus, reduced motion, the disabled assistant, Academy fallback and
bounded learning progress, procedure-workflow HTTP 503 behavior, and Pages bridge
credential stripping. Unexpected page or console errors fail the gate.

The browser run found and fixed three public-surface defects: missing favicon, a skip-link
target that could not receive programmatic focus, and Academia missing the Pages API bridge.
This is public-surface evidence only. The twelve authenticated role-aware journeys remain
blocked by missing human IdP/BFF/session and authenticated UI. Firefox/WebKit, screen-reader
and human WCAG review remain pending.

## Verification

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 14/14 pass
EVAL-PUBLIC-BROWSER-GATE-001: 5/5 pass
Playwright public browser gate: 10/10 pass (Chromium desktop + mobile)
full regression: 875 total / 873 pass / 0 fail / 2 environment skips
Bash syntax: pass
Typecheck: pass
Build: pass
Terraform validation workflows 30175249662 / 30175248520: success
Backend CI workflows 30175249675 / 30175248512: success
project-specific disabled offline plan: 0 resource changes
live GCS-backed disabled plan: 0 resource changes; resources_enabled=false
approved offline shape: SQL Admin API plus one protected Cloud SQL instance
first live resource plan: 2 creates; rejected_missing_owner_label
corrected live resource plan: 2 creates; verifier_status=valid; applied=true
governance exception: single_owner_pilot_only; status=expired_on_stop
authorized execution window: 2026-07-25T09:00:00-06:00..2026-07-25T13:00:00-06:00
corrected plan evidence head: e7c4393b0655d3c660941778ff47b1f31e6be57d
live plan generator: self-locating, fail-fast, state-locked, atomic verified-artifact publish
cloud_sql_instance_created: true
cloud_sql_instance_state: STOPPED
activation_policy: NEVER
terraform_apply_executed: true
managed_staging_execution: false
teardown_executed: false
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

1. Keep Cloud SQL stopped; the managed-run authorization expired without a successful receipt.
2. Observe the new Public Browser Gate on the published feature SHA and preserve its public-only scope.
3. Review actual billing after export latency; obtain a new explicit authorization for any restart or teardown.
4. Continue corpus, human identity, twelve authenticated browser journeys, external consumer,
   edge/load/SLO, recovery/privacy, protected merge and production-release work.

## Critical blockers

- `BLK-GCP-LIFECYCLE-074`: the restart authorization expired without a successful managed-run receipt; restart and destructive teardown require new explicit authorization;
- `PQG-OPEN-ENABLEMENT-001`: public gateway lacks authorized ingested evidence, edge
  controls, deployed staging and approval;
- `BLK-CORPUS-OPS-001`: source rights, durable object storage, scanner and
  retention/legal-hold controls are unavailable;
- public Chromium browser checks pass 10/10, but no approved human IdP/BFF/session or authenticated role-aware UI exists; twelve authenticated journeys remain blocked;
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
