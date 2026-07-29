# LA Muni RAG — Current Program State

Updated: 2026-07-29T06:42:07Z

Program status: **PARTIAL WITH DOCUMENTED BLOCKERS — Features 077–083 and the localized Graph Harness exact-SHA CI repair are published and green on the draft branch; productive identity, complete workflows, real corpus, managed staging evidence, protected merge and production release remain open**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
branch: feature/gcp-cloudsql-staging-v1
evidence_baseline_head: 82d75711f28a03de4e7df35d5ec6435cc7610319
functional_repair_parent: ba6acf3cc654e798f46b104d4eaac6d5c78712ab
graph_harness_framework_observed_head: 0eb0d5fe09e3b1ecaf561b4a1cc9b32510480a26
graph_harness_events: 43
graph_harness_required_gates: 4/4 PASS
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
This was public-surface evidence only and did not test human identity. Features 077–083
subsequently added a local provider-neutral BFF and role-aware UI/navigation shell with
Chromium, Firefox and WebKit evidence. Productive IdP interoperability, complete workflows,
screen-reader acceptance and all twelve productive journeys remain pending.

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

The continuation contract is persisted at `docs/handoffs/2026-07-27-development-completion-handoff.md`. Its original Feature 077 recommendation has been completed and superseded by the Features 077–083 checkpoint recorded below.

## Feature 077 — provider-neutral human session/BFF foundation v1

Feature 077 separates human browser sessions from integration Bearer credentials and adds a
disabled-by-default BFF boundary. Login is bound by state, a separate HttpOnly browser cookie,
nonce and PKCE S256. Callback state and authorization codes are single-use; new sessions are
unrelated to incoming cookies, rotate on bootstrap and explicit rotation, and revoke on logout.
Browser mutations require exact Origin plus session-bound proof. Browser routes reject Bearer
headers.

Provider output is limited to validated issuer, opaque subject and nonce. Application tenant,
principal, roles and permissions come only from local governed `human_subjects`, `principals`
and `memberships`; ambiguous cross-tenant mappings fail closed. Persistence contains digests or
protected challenge material, forced RLS, fixed-search-path security-definer functions and
minimized audit/failure aggregates. The deterministic provider, protector and repository are
test-only and production mode rejects them.

Local evidence passed 20/20 focused lifecycle/migration tests, 9/9
`EVAL-HUMAN-SESSION-BFF-001`, PostgreSQL 15.18/pgvector 0.8.5 non-owner gates, a compiled
Node/PostgreSQL smoke, typecheck, build, dependency audits, structured validation,
secret/PII scan and 905/908 integrated tests with three explicit environment skips and zero
failures. Functional commit: `1af3f0ecdca4fe49b47e5e1209f563c30a314adf`.

Feature 083 later supplies a generic discovery/JWKS/token adapter. No productive IdP selection,
client registration or credential, MFA/recovery policy, access-review operation, external OIDC
interoperability or complete productive browser workflow is claimed. The local role-aware
UI/navigation shell still uses only the deterministic test provider. The productive
matrix remains `0/12`; this is not production readiness.


## Feature 078 — authenticated role-aware product shell v1

The API now serves a same-origin authenticated shell whose browser lifecycle uses only the
BFF session cookie and POST endpoints. Effective navigation is derived from locally governed
human roles and permissions; integration credentials and `integration_client` are rejected
from human sessions. Chromium, Firefox and WebKit verify viewer/admin visibility, rotation,
logout, malformed-route fallback, no Web Storage credentials and an unreadable HttpOnly
cookie. Functional commit: `442623e05308011d7384f2b2fcbe779775898b67`.

## Feature 079 — human-session reliability and telemetry v1

The BFF emits only closed low-cardinality operation, method, outcome, status and duration
telemetry. Exporter and monotonic-clock failures are isolated, repository/provider failures
return generic responses, concurrent rotation has one winner, and a bounded local harness
records non-productive latency evidence. No production exporter, error budget, alerting or
on-call claim exists. Functional commit: `04dbb125c15e9c429e7319a6506bfd787f51d940`.

## Feature 080 — human-gated decision packets v1

Four versioned packets cover productive IdP, real corpus, Cloud SQL lifecycle and production
controls. Their deterministic validator reports four packets, zero selected options, zero
authorized actions and no production-readiness claim. No packet is execution authority and
no conforming human receipt exists. Functional commit:
`706109c3820dba326573ddc796d9a0095e5446eb`.

## Feature 081 — cross-browser accessibility complement v1

The authenticated shell has automated anonymous/authenticated checks in Chromium, Firefox
and WebKit for accessible names, unique IDs, minimum targets, heading progression, hidden
focus, visible current-page state, keyboard skip navigation and 320-pixel reflow. This is a
regression complement, not WCAG conformance or human assistive-technology acceptance.
Functional commit: `282b2441912828b193f82133543c4823f5f14659`.

## Feature 082 — task-first municipal workspace v1

The generic dashboard was replaced by an evidence-first municipal workspace with grouped
work/corpus/governance navigation, secondary session details, honest zero-data states and
closed permission-aware task shortcuts. Canonical protected `/app/*` deep links now survive
login through an exact return-path allowlist; deliberate navigation preserves browser
Back/Forward while denied or malformed routes normalize safely without reflecting input.
Provider errors distinguish generic authentication rejection from transient unavailability,
focus/denial states meet the automated contrast contract, and the civic light visual system
contains no copied PixelRAG code or assets.

Feature 082 focused tests passed 6/6 and `EVAL-HUMAN-WORKSPACE-001` passed 8/8. Public
browser tests passed 10/10; Chromium, Firefox and WebKit passed viewer/admin deep-link,
history, rotation, logout, storage/cookie and accessibility checks. PostgreSQL 15.18 with
pgvector 0.8.5 passed migrations, non-owner forced-RLS runtime verification and compiled BFF
smoke. Full regression passed 976/978 with zero failures and two explicit environment skips;
typecheck, build, contracts, inventory, decision packets, workflow template, dependency,
structured, secret/PII and diff gates passed. Functional commit: `ffa30433db9ba62812dd0dac680963759b4868cb`.

The deterministic identity adapter is test-only. Productive authenticated journeys remain
`0/12`; no productive IdP, complete browser-to-domain workflow, real municipal corpus,
external municipal user or managed browser environment is claimed.

## Feature 083 — provider-neutral OIDC adapter v1

The BFF now has a confidential provider-neutral OIDC adapter with path-aware discovery, exact
issuer and endpoint-origin validation, authorization code plus PKCE S256, bounded token/JWKS
reads, asymmetric RS256/PS256/ES256 verification, audience/`azp`/time validation, unique public
verification keys and URI-bound JWKS caching. Provider roles, groups, tenant and profile claims
are discarded; only issuer, opaque subject and nonce reach local membership resolution.
Environment composition remains disabled by default and fails closed without explicit enablement,
provider approval and complete server-side configuration.

Feature 083 focused tests passed 10/10 and `EVAL-HUMAN-OIDC-PROVIDER-001` passed 9/9. Full
regression passed 995/997 with zero failures and two explicit environment skips; public browser
passed 10/10; Chromium, Firefox and WebKit passed deterministic authenticated smoke; typecheck,
build, contracts, kits, inventory, packets, audits, structured validation, secret/PII and diff gates
passed. Functional commit: `7ec7037af4af5601c5c515be1bdf4aef35682a0a`.

Productive IdP integration remains absent. No productive IdP is selected, provisioned or approved. Client registration, credentials, provider
metadata receipt, external interoperability, MFA/recovery, access review, managed secrets, external
users and deployed browser environment remain absent. Productive journeys remain `0/12`; this is
not production readiness.

## Exact-SHA localized CI repair — Graph Harness SDLC

Exact-SHA CI for `ba6acf3cc654e798f46b104d4eaac6d5c78712ab` exposed two localized failures: WebKit root overflow caused by a fixed 320-pixel root minimum and a local reliability percentile contaminated by process/client cold start. Graph Harness invalidated only Feature 079 reliability, Feature 081 accessibility, their shared Feature 082 workspace descendant and the draft PR checkpoint. Feature 083 OIDC remained preserved and `done`.

Functional repair `82d75711f28a03de4e7df35d5ec6435cc7610319` removed the fixed root minimum, strengthened the 320-pixel forced-scrollbar diagnostic, and added 12 validated but unmeasured shell warm-up requests while preserving the 500 ms steady-state p95 threshold. The persisted Graph Harness chain contains 43 events, two repair plans, four passing required gates and one exact-SHA checkpoint. Typed state is stored in `program/graph-harness/state.json`.

Exact-SHA GitHub Actions passed:

- Backend CI run `30428162887`;
- Public Browser Gate run `30428162850`;
- GCP Cloud SQL Terraform validation run `30428162725`.

The framework runtime was executed from the separate Graph Harness workspace at observed HEAD `0eb0d5fe09e3b1ecaf561b4a1cc9b32510480a26`. Its executable runtime files were uncommitted there, so this repository records the observed runtime and evidence chain but does not claim a durable immutable framework pin. That pin remains an explicit follow-up.

This repair changes no productive capability: productive authenticated journeys remain `0/12`, real documents ingested remain `0`, and no merge, deployment, IdP provisioning, corpus acquisition or Cloud SQL lifecycle mutation was authorized.

## Verification

```text
EVAL-GCP-CLOUDSQL-STAGING-001: 14/14 pass
EVAL-PUBLIC-BROWSER-GATE-001: 5/5 pass
EVAL-ONLINE-PAGES-RELEASE-001: 5/5 pass
EVAL-HUMAN-SESSION-BFF-001: 9/9 pass
EVAL-HUMAN-PRODUCT-SHELL-001: 9/9 pass
EVAL-HUMAN-SESSION-RELIABILITY-001: 9/9 pass
EVAL-HUMAN-DECISION-PACKETS-001: 9/9 pass
EVAL-HUMAN-PRODUCT-SHELL-ACCESSIBILITY-001: 9/9 pass
EVAL-HUMAN-WORKSPACE-001: 8/8 pass
EVAL-HUMAN-OIDC-PROVIDER-001: 9/9 pass
Feature 083 focused OIDC adapter: 10/10 pass
Graph Harness repair: 43 events / 2 repair plans / 4 required gates PASS / 1 checkpoint
Exact-SHA repair CI: Backend 30428162887 success; Public Browser 30428162850 success; Terraform 30428162725 success
Reliability repair: 12 validated warm-up requests; 80 measured shell requests; unchanged shell p95 limit 500 ms
Feature 082 focused workspace: 6/6 pass
Public browser gate: 10/10 pass
Authenticated local shell smoke: Chromium / Firefox / WebKit pass
Feature 077 focused lifecycle/migration: 20/20 pass
Feature 077 PostgreSQL non-owner gate and compiled smoke: pass
Feature 076 final CI: Backend 30224836298 / 30224834914 success; Public Browser 30224836291 / 30224834919 success; Terraform 30224836307 success
Playwright public browser gate: 10/10 pass (Chromium desktop + mobile); remote runs 30180490148 / 30180488768 success
full regression: 997 total / 995 pass / 0 fail / 2 environment skips
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
5. Preserve the local Features 077–083 gates; obtain productive IdP, corpus, workflow, accessibility, observability and managed-environment approvals/evidence before counting any authenticated journey.
6. Preserve published functional repair `82d75711f28a03de4e7df35d5ec6435cc7610319` and its three green exact-SHA workflows; keep PR #24 draft until all remaining human-gated product and environment prerequisites are satisfied.
7. Publish the Graph Harness executable runtime and schemas at an immutable framework commit before claiming a durable framework pin.

## Critical blockers

- `BLK-GCP-LIFECYCLE-074`: the restart authorization expired without a successful managed-run receipt; restart and destructive teardown require new explicit authorization;
- `BLK-PAGES-DEPLOYMENT-076`: closed for this pilot; exact-SHA deployment and rollback to the authorized main SHA are both verified;
- `PQG-OPEN-ENABLEMENT-001`: public gateway lacks authorized ingested evidence, edge
  controls, deployed staging and approval;
- `BLK-CORPUS-OPS-001`: source rights, durable object storage, scanner and
  retention/legal-hold controls are unavailable;
- the provider-neutral BFF, generic OIDC adapter and task-first role-aware shell pass local gates, but no approved productive IdP registration/credentials, external interoperability, complete browser-to-domain workflows or real managed environment exists; twelve productive journeys remain blocked;
- external consumer repositories have not executed their suites;
- no managed Cloud SQL staging execution, observability/SLO, load/HA, coordinated
  recovery or privacy operation exists;
- no protected merge, production deployment or observation window exists.

## Persistent boundary assertions

- Live budget alerts are not a hard spending cap.
- A protected state bucket is not a Cloud SQL deployment.
- There is no production object store, scanner/definitions monitor or dispatcher operating.
- Zero documents are credited as ingested; the minimum Antigua-first and comparative corpus is incomplete.
- A provider-neutral BFF/session foundation, generic OIDC adapter and role-aware UI/navigation task-first shell are implemented locally; productive IdP approval/registration/credentials, recovery/MFA, access review, complete workflows and human accessibility acceptance remain absent.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is implemented.
- An offline approved-shape plan is not a plan against live GCP state.
- A live Terraform plan is not authorization to apply it.
- Disposable API/system staging is not production.
- The twelve browser journeys remain blocked and were not counted as passed.
- Provider-side kits do not prove external interoperability.
- A temporary exact-SHA Pages deployment is not a protected merge or production-release approval.
- A green feature branch, draft PR or synthetic receipt is not production readiness.
