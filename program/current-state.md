# LA Muni RAG — Current Program State

Updated: 2026-07-27T18:31:32Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Feature 076 completed its bounded exact-SHA Pages deployment and verified rollback to the prior main publication; authenticated browser journeys, real corpus, managed staging, teardown and production release remain open**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
evidence_baseline_head: 17a6e0cbc7f58a14d1d22497dc324c5448632c54
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

## Feature 076 — online Pages release verification v1

The Pages build now emits one exact full Git SHA in every generated HTML document and in a
three-field `build-metadata.json`. Artifact verification rejects malformed or mismatched
metadata before upload. A new desktop/mobile Chromium verifier rejects insecure target URLs,
stale or wrong SHAs, missing product navigation, browser/runtime errors, failed requests and
widget/API configuration drift.

The previous public URL served a legacy Jekyll-style `main` publication and was correctly
rejected because `build-metadata.json` returned 404. Formal authorization then permitted a
60-minute deployment of exact SHA `b646aa6ce5d7231587ae311f5acb59f84fc35a0e` with `PAGES_API_URL` absent and rollback to
`4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`.

The first dispatch was rejected before publication because the `github-pages` environment
allowed only `main`. A temporary policy for the exact feature branch enabled one run and was
removed immediately after success; the environment again allows only `main`. Deployment run
`30226975010` succeeded, and both workflow and independent Chromium desktop/mobile verification
confirmed the exact SHA at https://bernydotjar.github.io/LA_muni_RAG/. Rollback run `30229913868` completed successfully from `main` at exact SHA `4950ba3c24dbe7d9891d5cec8d7ba5f57db3ef9c`. The latest `github-pages` deployment now references that SHA, the public URL returns HTTP 200, `build-metadata.json` returns 404 as expected for the prior publication, and the temporary candidate SHA is absent from public HTML. The product owner later reported completing the requested manual smoke review. This is user-attested manual acceptance only, not a structured WCAG, screen-reader, legal, authenticated-session or real-corpus evaluation.

The continuation contract is persisted at `docs/handoffs/2026-07-27-development-completion-handoff.md`; the recommended first increment is a provider-neutral human session/BFF foundation that reuses existing service identity, tenant and RBAC controls.

## Verification

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 14/14 pass
EVAL-PUBLIC-BROWSER-GATE-001: 5/5 pass
EVAL-ONLINE-PAGES-RELEASE-001: 5/5 pass
Feature 076 final CI: Backend 30224836298 / 30224834914 success; Public Browser 30224836291 / 30224834919 success; Terraform 30224836307 success
Playwright public browser gate: 10/10 pass (Chromium desktop + mobile); remote runs 30180490148 / 30180488768 success
full regression: 880 total / 878 pass / 0 fail / 2 environment skips
Bash syntax: pass
Typecheck: pass
Build: pass
Terraform validation workflow 30180490141: success
Backend CI workflows 30180490197 / 30180488753: success
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
2. Preserve the green Public Browser Gate as a required public-only check; do not count it as authenticated E2E.
3. Preserve the completed Feature 076 deployment and rollback receipts; require a new exact-SHA, bounded authorization for any future Pages replacement.
4. Review actual billing after export latency; obtain a new explicit authorization for any restart or teardown.
5. Continue corpus, human identity, twelve authenticated browser journeys, external consumer,
   edge/load/SLO, recovery/privacy, protected merge and production-release work.

## Critical blockers

- `BLK-GCP-LIFECYCLE-074`: the restart authorization expired without a successful managed-run receipt; restart and destructive teardown require new explicit authorization;
- `BLK-PAGES-DEPLOYMENT-076`: closed for this pilot; exact-SHA deployment and rollback to the authorized main SHA are both verified;
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
- A temporary exact-SHA Pages deployment is not a protected merge or production-release approval.
- A green feature branch, draft PR or synthetic receipt is not production readiness.
