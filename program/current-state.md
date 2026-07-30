# LA Muni RAG — Current Program State

Updated: 2026-07-30T18:49:39Z

Program status: **PUBLIC PILOT OPERATIONAL — the anonymous PDM-OT assistant and premium procedure workflow are deployed on GitHub Pages, backed by an immutable Cloud Run revision and protected Cloud SQL database; Graph Harness revision 1 is done with all 8 release evidence kinds and the blocking gate PASS. Productive identity/MFA, DMP OCR, complete municipal coverage and legal-correctness claims remain explicitly deferred.**

## Authoritative checkout

```text
workspace_id: b909e055-62ae-4625-ac13-10947906a08f
root: /workspace
functional_feature_commit: a571645ac4249578e79b119479f7f5a7a4cacc08
functional_merge_commit: bfdf3a67665294c605b21b50cd6ec990fb3ad6d9
evidence_checkpoint_branch: docs/public-procedure-release-evidence-v1
graph_harness_framework_merge_pin: 1bebce3db35303072049233786464bb01163c98b
graph_harness_executable_runtime: fef364bc66849b98c08d3c1dcb91caf9701027cd
graph_harness_events: 102
graph_harness_release_node: REL-PUBLIC-CORPUS-PILOT-STAGING-001 revision 1 done
graph_harness_release_gate: GATE-PUBLIC-CORPUS-PILOT-STAGING-001 PASS
graph_harness_checkpoints: 3
pull_request: 27 merged
public_pages: https://bernydotjar.github.io/LA_muni_RAG/
public_procedure: https://bernydotjar.github.io/LA_muni_RAG/procedure-workflow.html
public_gateway: https://la-muni-rag-public-gateway-ccaqcuwgyq-uc.a.run.app
cloud_run_revision: la-muni-rag-public-gateway-proc-a571b
immutable_image_digest: sha256:e15a1108ebb4b67242b1fdf5e9f708aa30b502831acb4a05aa10bc488dd38aad
cloud_sql_instance_state: RUNNABLE
activation_policy: ALWAYS
managed_public_pilot_execution: true
public_pilot_deployed: true
productive_authenticated_product_deployed: false
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

Feature 084 closes the runtime provenance blocker. Backend CI installs Graph Harness SDLC from immutable published merge `1bebce3db35303072049233786464bb01163c98b`, containing executable runtime `fef364bc66849b98c08d3c1dcb91caf9701027cd`, and replays the application event chain without copied framework source. Exact-SHA runs Backend `30470555533`, Public Browser `30470546856` and Terraform `30470549087` all passed for functional commit `6995dd81025d593752a9e87b32aa9e2844e17510`.

At the Feature 084 checkpoint, this repair changed no productive capability and no corpus acquisition was yet credited. Feature 085 subsequently supersedes that corpus count with one controlled real municipal ingestion while productive authenticated journeys remain `0/12`.

## Feature 085 — controlled real corpus ingestion v1 candidate

Two previously identified official municipal PDFs were reacquired from their registered HTTPS URLs and matched the historical exact hashes and byte lengths. PDM-OT module 1 passed structural and ClamAV gates, produced 224 extracted sections and 444 tenant-scoped chunks in PostgreSQL 15.18 with pgvector 0.8.5, and is now credited as `ingested`. DMP v3 passed exact-byte and ClamAV gates but is a 170-page EPSON scan without extractable text; it remains `failed` with `pdf_no_extractable_text`, zero sections and zero chunks. No OCR was attempted without a separate Spanish legal-document accuracy and human-review gate.

The real run exposed and repaired a canonical identity defect: the worker lease did not carry server-owned document key, title and version, so completion rejected real vectors with `vector_record_scope_mismatch`. The lease now carries those values and completion still independently rechecks them. The disposable evidence runtime used a loopback-only PostgreSQL cluster, a non-owner `NOBYPASSRLS` role and five `FORCE RLS` tables. Raw PDFs remain outside Git.

One real municipal document is credited as ingested. The vector representation is explicitly `local-eval-hashing/token-bigram-hash-1536-v1`; it is deterministic lexical evaluation infrastructure, not a semantic model or productive embedding provider. Feature 086 now supplies bounded retrieval measurements. Exact-SHA Backend `30474973082`, Public Browser `30474974657` and Terraform `30474973360` passed for functional commit `4aa7dc72679a029348650b9207f3866709f9d7df`.

## Feature 086 — real-corpus retrieval evaluation v1

A frozen benchmark of eight positive and four no-answer queries was executed against the exact 444 chunks produced from PDM-OT module 1. Phrase, Spanish full-text keyword, deterministic lexical-vector and existing hybrid retrieval were measured in PostgreSQL/pgvector. The safety gate passes: unsupported-answer rate and cross-document leakage rate are zero in every mode.

Measured quality remains mixed and is not promoted into a broad claim. Phrase achieved hit@5 `0.750`, MRR `0.6458333333` and top-1 citation identity `0.500`; keyword achieved `0.750`, `0.5803571429` and `0.375`; lexical-vector achieved `0.750`, `0.6180555556` and `0.500`; hybrid achieved `0.875`, `0.6041666667` and `0.375`. Phrase, keyword and hybrid MRR/top-1 citation targets remain below threshold. The vector mode is explicitly lexical hashing, not semantic retrieval.

`EVAL-REAL-CORPUS-RETRIEVAL-001` passed 11/11, the final program revalidation passed 1049/1050 with zero failures and one explicit environment skip, and exact-SHA Backend `30477447935`, Public Browser `30477448607` and Terraform `30477447915` all succeeded for functional commit `70ec287f1a8705637e04374ca2562fafa175e0da`. Graph Harness gate `GATE-REAL-CORPUS-RETRIEVAL-001` is `PASS`; the node is `done` with documented quality limitations. Further ranking work requires a broader corpus and held-out human judgments rather than tuning repeatedly against the same twelve cases.

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
Graph Harness: 102 events / 3 repair plans / release revision 1 done / release gate PASS / 3 checkpoints / no ready nodes
Exact-SHA repair CI: Backend 30428162887 success; Public Browser 30428162850 success; Terraform 30428162725 success
Reliability repair: 12 validated warm-up requests; 80 measured shell requests; unchanged shell p95 limit 500 ms
Feature 082 focused workspace: 6/6 pass
Public browser gate: 10/10 pass
Authenticated local shell smoke: Chromium / Firefox / WebKit pass
Feature 077 focused lifecycle/migration: 20/20 pass
Feature 077 PostgreSQL non-owner gate and compiled smoke: pass
Feature 076 final CI: Backend 30224836298 / 30224834914 success; Public Browser 30224836291 / 30224834919 success; Terraform 30224836307 success
Playwright public browser gate: 10/10 pass (Chromium desktop + mobile); remote runs 30180490148 / 30180488768 success
Final program revalidation: 1064 total / 1063 pass / 0 fail / 1 explicit environment skip
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
cloud_sql_instance_state: RUNNABLE
activation_policy: ALWAYS
terraform_apply_executed: true
managed_staging_execution: true
teardown_executed: false
```

## Current corpus truth

```text
source inventory records: 17
verified records: 3
records with acquisition metadata: 2
records credited as ingested: 1
records failed after clean acquisition: 1 (pdf_no_extractable_text)
records retrieval-validated against real corpus: 1 document / 12 judged cases; safety pass; quality targets not met
```

Synthetic fixtures, administrative GCP controls and offline plans do not change corpus
truth.

## Next execution sequence

1. Operate and observe the anonymous public pilot at the published Pages and Cloud Run URLs.
2. Review Cloud Billing and Cloud Run/Cloud SQL utilization; preserve the 0–2 Cloud Run instance bound and deletion protection.
3. Expand the official municipal corpus through separately reviewed source acquisitions, provenance, scan, extraction and held-out retrieval judgments.
4. Decide whether to run a Spanish legal-document OCR evaluation for DMP; do not credit OCR without reproducible quality and human review.
5. Select and provision productive Google or Microsoft OIDC for administrative/authenticated journeys; MFA remains deferred from the anonymous pilot but required before privileged production access.
6. Complete retention, legal-hold, named authority/vigencia review, SLO/load and recovery operations before broader production claims.
7. Preserve the immutable Graph Harness runtime pin, append-only 102-event chain, PASS release gate and `public-procedure-premium-operational` checkpoint.

## Critical blockers and deferred scope

- `PQG-OPEN-ENABLEMENT-001`: **closed for the anonymous PDM-OT pilot**; exact origin, Cloud Run, Cloud SQL, Secret Manager, rate limiting, audit, observability and Pages integration are operational.
- `BLK-PAGES-DEPLOYMENT-076`: **closed for the current public release**; custom Actions and legacy Pages deployments both succeeded and the premium desktop/mobile workflow passed online.
- `BLK-GCP-LIFECYCLE-074`: **closed for current pilot operation**; Cloud SQL is RUNNABLE with backups, PITR, deletion protection and connector enforcement. Destructive teardown still requires explicit authorization.
- `BLK-CORPUS-OPS-001`: remains open for broader coverage, production object retention/legal hold, OCR validation, named reviewers and held-out judgments; it does not block use of the approved one-document pilot.
- Productive IdP registration, external OIDC interoperability, recovery/MFA, access review and twelve authenticated journeys remain deferred and are not part of the anonymous public gateway.
- No semantic-search, complete municipal-procedure, legal-correctness or current-vigencia claim is made.

## Persistent boundary assertions

- The public pilot is operational, but one official PDM-OT document is not complete municipal coverage.
- The minimum Antigua-first and comparative corpus remains incomplete; broader official sources and held-out judgments are still required.
- PDM-OT citations can support related planning context; unsupported procedure steps remain `insufficient` and appear as explicit gaps.
- Public `hybrid` means bounded lexical keyword plus phrase retrieval, not semantic vector search.
- DMP v3 remains excluded with `pdf_no_extractable_text`; no OCR result is credited.
- Browser Authorization and Cookie headers remain rejected by the anonymous gateway.
- EvidenceGap is intake-only; no research assignment, resolution lifecycle or notification workflow is automated or claimed.
- Productive human identity, MFA/recovery and privileged administrative journeys remain separate work.
- Cloud Run is bounded to 2 maximum instances; Cloud SQL retains backups, PITR, deletion protection and connector enforcement.
- The public release does not claim general legal correctness, complete procedures, current vigencia or production SLO compliance.

## Feature 087/088 — public corpus pilot and premium procedure workflow completed

The product owner approved the anonymous PDM-OT pilot, managed GCP lifecycle, bounded spend, Pages connection, merge and release. Cloud SQL `la-muni-rag-staging` is RUNNABLE with deletion protection, backups, PITR and connector enforcement. The dedicated `la_muni_rag_public` database and non-owner runtime role remain active; secrets are held in Secret Manager.

The exact PDM-OT corpus is present as 444 accepted chunks and 444 reproducibly projected public sections. DMP remains excluded with `pdf_no_extractable_text`. The immutable image `sha256:e15a1108ebb4b67242b1fdf5e9f708aa30b502831acb4a05aa10bc488dd38aad`, built from feature commit `a571645ac4249578e79b119479f7f5a7a4cacc08`, is promoted through Cloud Run revision `la-muni-rag-public-gateway-proc-a571b` at 100% traffic. Runtime limits are 1 CPU, 512 MiB, concurrency 40 and maximum 2 instances.

GitHub Pages serves the premium responsive procedure workflow. Exact-origin domain-pack and procedure calls return 200. The approved water query returns 47 steps, 5 explicit gaps and 8 official HTTPS citations; the stadium query returns 6 steps, 4 explicit gaps and 8 citations. Desktop and mobile Chromium have no failed requests, console errors or horizontal overflow. Unsupported steps remain insufficient rather than being promoted by general PDM-OT evidence.

Graph Harness release revision 1 is `done` at event 102. `GATE-PUBLIC-CORPUS-PILOT-STAGING-001` is `PASS` with fresh evidence for local regression, managed database, corpus projection, public gateway smoke, immutable image, online Pages, observability and remote CI. The release receipt is `program/reports/2026-07-30-public-procedure-premium-release.json` with SHA-256 `adf9905b71a48a50798e4e4c51444f0d6b409b6b9f921177552f6720b505cfa2`.
