# Program Decision Log

## 2026-07-21 — Remote refs override false-negative push responses

Decision: after any connector push error, inspect the exact remote ref before retrying. The connector reported an ownership/Docker failure while `feature/workflow-lifecycle-v1` nevertheless advanced to `f12ee17`; therefore the remote SHA is authoritative and blind retries are prohibited.


## 2026-07-21 — Publication is proven only by the exact remote ref

Decision: treat `feature/workflow-lifecycle-v1` as pushed because `git ls-remote` returns exact commit `c6e110c`. Do not infer PR creation, merge, or CI from branch publication; `main` remains `4950ba3`.


## 2026-07-21 — Repository-persistent execution policy is authoritative

Decision: `AGENTS.md` defines the mandatory startup audit, preservation rules, authorized feature-branch Git actions, and human-gated operations for every execution session. `RTK.md` remains referenced for repository command-output discipline.

Reason: session continuity must be enforced from the checkout rather than relying on conversational memory or stale control-plane metadata.

## 2026-07-21 — Governed workflow lifecycle is a separate authoritative slice

Decision: persist procedure/workflow lifecycle in LA Muni RAG and expose action-specific v1 routes. Every version enters as `draft`; review, approval, supersession, and archival remain server-owned human governance actions.

Evidence: `d842b4e`, `c6e110c`, migrations 009–010, strict contracts, HTTP tests, non-owner SQL gate, and compiled PostgreSQL smoke.

Rejected: caller-selected approved status, frontend-only authorization, generic unrestricted workflow patching, and shared procedure tables with adjacent products.

## 2026-07-21 — Supersession is an atomic replacement approval

Decision: a supersession request must identify an `in_review`, recommended, same-procedure replacement. One transaction locks the records, supersedes the current approved version, appends replacement approval evidence, approves the replacement, and leaves exactly one approved row.

Reason: requiring the replacement to be approved beforehand conflicts with the one-approved-version invariant and creates an unavailable intermediate state.

## 2026-07-21 — Corrupt replay cleanup commits before error emission

Decision: response replay is accepted only after schema, request, tenant, and audit identity validation. Invalid replay state is deleted and audited in a committed transaction; the generic error is emitted afterward.

Reason: throwing inside the cleanup transaction would restore the corrupt row through rollback.

## 2026-07-21 — Production-shaped database verification may use an equivalent disposable runtime

Decision: when Docker-in-Docker cannot register the pinned service image, use PostgreSQL 15.18 plus pgvector 0.8.5 built from the verified official v0.8.5 commit for local evidence. Keep remote CI pinned to PostgreSQL 16/pgvector 0.8.5.

Reason: the acceptance criteria are database behavior, RLS, transactions, contracts, and compiled adapters—not dependence on a broken nested Docker storage driver. Version differences and remote CI remain explicit limitations.

## 2026-07-21 — Fail-closed evidence abstention is a passing outcome

Decision: a citable source without a step-level evidence link must produce explicit `missing_evidence`, not a fabricated claim. Positive fixtures must include a genuinely matching evidence phrase; tests may not relax claim promotion rules.

## 2026-07-21 — Publication remains connector-owned

Decision: do not extract credentials, invoke raw `git push`, force-push, or escalate privileges after the dedicated connector fails before Git execution. Preserve the exact commit graph and retry only through an authorized, repaired publication path.

## 2026-07-21T17:30:46Z — Exact artifact acceptance is a database invariant

Object acceptance must prove current clean scan, exact SHA-256, MIME and generation with a future window no longer than seven days. Accepted identity and scan evidence are immutable; corrupt history stops migration instead of being silently repaired.

## 2026-07-21T17:30:46Z — Finalization uses a narrow privileged lock boundary

The runtime receives no artifact-table UPDATE. A fixed-search-path, tenant-bound, PUBLIC-revoked SECURITY DEFINER function returns only a boolean while locking exact rows until transaction completion.

## 2026-07-21T17:30:46Z — Connector errors require remote-SHA reconciliation

A Docker/NAT connector error is not a publication result. `git ls-remote` is authoritative; `feature/artifact-vector-runtime-hardening-v1` is published at `f539db3aa910dbf57328602daf19fec2ed3e9677`.

## 2026-07-21T17:31:36Z — Remote CI accepted Feature 060

Backend CI run `29852618726` and check `88709014203` completed successfully on exact SHA `f539db3aa910dbf57328602daf19fec2ed3e9677`. This proves CI execution, not merge or deployment.

## 2026-07-21T18:00:57Z — ProcedureAssessment is draft-bound and fail-closed

Decision: the provider uses the same scoped compilation as bundle/workflow, validates the canonical workflow, never trusts opaque provided-document IDs as completion, and keeps cited requirement existence at review-only. It is not a case, approval or legal conclusion.

## 2026-07-21T18:00:57Z — Assessment replay minimizes narrative context

Decision: the response contract requires empty `facts` and `constraints`; only opaque subject/community/document references remain. The idempotency replay table is not a case-note store.

## 2026-07-21T18:00:57Z — Feature 061 publication receipt

`feature/procedure-assessment-v1` is published at exact SHA `56b9866988f080c10fafe1542038410e3b3f3e9d` despite a connector Docker/NAT error. Backend CI run `29855067232` is tracked separately; no PR, merge or deployment is claimed.

## 2026-07-21T18:01:44Z — Remote CI accepted Feature 061

Backend CI run `29855067232` and check `88717220160` completed successfully on exact SHA `56b9866988f080c10fafe1542038410e3b3f3e9d`. This proves remote CI execution, not PR, merge or deployment.

## 2026-07-21T19:40:48Z — EvidenceGap is immutable intake, not research resolution

Decision: `POST /api/v1/evidence-gap-requests` records one tenant-owned
`open` aggregate and does not invoke retrieval or the procedure compiler. OS
Electoral owns the opaque request/campaign reference; LA Muni RAG owns source
authority, validation and any future resolution. Intake never promotes a source.

## 2026-07-21T19:40:48Z — Requester text is machine-labeled unverified

Decision: every acknowledgement fixes
`request_assertion_status=requester_supplied_unverified`. This prevents a
frontend or consumer from presenting repeated subject/reason text as a finding
of LA Muni RAG. Imperative source-authority promotion is rejected before mutation.

## 2026-07-21T19:40:48Z — Transport replay and aggregate identity remain distinct

Decision: `Idempotency-Key` controls tenant/principal transport replay, while
`gap_request_id` and `request_id` control the immutable domain aggregate.
Same-key concurrent work is fenced; distinct keys for the same canonical
aggregate converge on the original response; changed identity/payload conflicts.

## 2026-07-21T19:40:48Z — EvidenceGap replay requires canonical reconstruction

Decision: a stored acknowledgement is emitted only when status, SHA-256, current
schema, tenant/request/gap/credential/audit identities and exact canonical mapper
reconstruction all match. Merely being valid JSON Schema is insufficient because
schema-valid limitations could silently change authority semantics.

## 2026-07-21T19:40:48Z — Feature 062 publication and CI receipt

`feature/evidence-gap-request-v1` is published at exact SHA
`66b41b943242d9c4317d35f125de1cd617ebb6e4`. Backend CI run
`29861888791` and check `88740409681` completed successfully on that SHA.
This proves feature publication and remote CI, not PR, protected merge,
production deployment, research operations or consumer interoperability.

## 2026-07-21 — Procedure cases are operational records, not legal status

Decision: bind every new case immutably to a workflow version approved at
creation, require document-version identity for received/reviewed evidence, use
optimistic revisions and append-only events, and exclude legal/compliance/payment
status from the contract. Case validation requires `procedure:review`, separate
from ordinary `case:write`.

Evidence: ADR 064, commit `cf9449d`, EVAL-CASE-001, PostgreSQL SQL gate and
compiled HTTP smoke.

## 2026-07-21 — Logical restore excludes source ownership and ACLs

Decision: use custom `pg_dump --no-owner --no-acl`, restore transactionally into
a distinct empty target, and reapply reviewed runtime grants through provisioning.
This avoids silently inheriting source privileges.

Evidence: ADR 065, commit `5d45410`, EVAL-RESTORE-001 and restored runtime/HTTP gates.

## 2026-07-21 — All required eval names retain scope-specific limitations

Decision: add SOURCE, MISSING, RBAC and INGEST as dedicated executable families
and record all nineteen goal-required names, but never treat named green gates as
global readiness. Source metadata is not durable possession; server RBAC is not
human login; disposable ingestion/restore is not production operation.

Evidence: commit `e39ad77`, CI 29871698536 and `docs/testing/eval-harness.md`.

## 2026-07-21 — Next critical path is the missing catalog API, not another demo

Decision: prioritize source/document/job-list/search/evidence/procedure catalog
APIs before expanding visual surfaces. These endpoints are required to make the
existing data and providers operable as a coherent SaaS backend.

## 2026-07-21T23:20:48Z — Catalog registration cannot establish authority or processing completion

Decision: `POST /api/v1/sources` creates only unreviewed discovery metadata and
`POST /api/v1/documents` creates only a draft declared version. Official status,
validity, acquisition, scan acceptance, ingestion, retrieval quality and legal
applicability remain separate server/human-owned lifecycles.

Evidence: migration 014 defaults and column grants, closed request schemas,
EVAL-SOURCE-API-001, EVAL-DOCUMENT-API-001 and fresh non-owner PostgreSQL gate.

## 2026-07-21T23:20:48Z — Catalog projections are privilege-minimized, not presentation-only

Decision: do not rely on response mappers alone to hide object keys, scanner
internals, job lease/fencing state, pipeline configuration or workflow
definitions. The runtime receives explicit column grants and repositories use
explicit projections.

Reason: a future mapper bug must not turn broad table privilege into a metadata leak.

## 2026-07-21T23:20:48Z — Catalog replay requires canonical reconstruction and committed cleanup

Decision: exact replay is accepted only after SHA-256, schema, tenant/request/
credential/audit identity, persisted aggregate identity and canonical response
reconstruction match. Schema-valid semantic corruption is deleted in a committed
transaction before a generic `replay_invalid` response is emitted.

## 2026-07-21T23:20:48Z — Public catalog URLs may not contain credentials or temporary signatures

Decision: discovery/source URLs reject userinfo and common token/signature query
parameters at HTTP and PostgreSQL boundaries. Object coordinates and signed URLs
remain owned by the artifact adapter and are never persisted in catalog fields.

## 2026-07-21T23:20:48Z — Feature 067 publication receipt

`feature/catalog-api-v1` is published at exact functional SHA
`9da29720c23d64bc73bdb24e92e67707834f4f84`. Backend CI run `29876782983`
is tracked separately. No PR, merge, deployment or production observation is claimed.
## 2026-07-22T01:10:55Z — E2E follows contracts, identity, deterministic staging and system journeys

Decision: publish provider-side portable contract manifests first, require each
external consumer to pin the exact SHA and run equivalent verification, then
stabilize human identity and resettable staging data before system/API journeys.
Browser E2E is the final layer and validates critical user outcomes rather than
serving as a discovery mechanism for schema, authorization or persistence bugs.

Evidence: Feature 069 `5e5481e26b1a27a0aa2bd9c965e1c160f18b3198`, 16/16 consumer-kit eval, detached 793/795
regression, 2 kits/5 interactions and CI run `29882062536` (`success`). No
external repository, PR, merge or deployment is claimed.

## 2026-07-22T16:53:05Z — Browser E2E remains downstream of executable staging, identity and API/system journeys

Decision: adopt Feature 070 as the single provider-side contract for ephemeral staging and future browser E2E. The contract fixes synthetic identity, exact RBAC, deterministic fixtures, reset/destruction, twenty API/system journeys, twelve browser journeys, mock boundaries, and API-versus-browser concern ownership. Browser journeys remain blocked until human IdP/OIDC/PKCE/BFF/session, secure cookies/CSRF, role-aware UI, and deployed ephemeral services exist.

Evidence: functional SHA `f4d018f0909d15408092167cb935bf4ac71cd6d9`, detached 806/808 regression, 13/13 staging eval, zero staging-plan issues, and Backend CI `29939453123` success. No environment deployment, browser execution, external consumer suite, PR, merge, or production release is claimed.

## 2026-07-22T19:34:37Z — Public product fails closed; GCP selected as target architecture

Decision: remove static answer/procedure/domain fixtures, make Assistant and Glass Wall direct navigation, require explicit API configuration, keep legacy `/api/chat` production-disabled, and reserve `/api/public/v1/query` for a dedicated public gateway. Select GCP Cloud Run/Cloud SQL/Cloud Storage as the target architecture without creating a project, enabling billing, applying Terraform or deploying.

Evidence: Feature 071 `bf29e6fdc48fa155b004b5f0b2ff410050b59c84`, EVAL-PRODUCTION-PUBLIC-SURFACE-001 33/33, detached 816/818 regression, browser smoke, zero audits, and Backend CI `29951023165` success. No gateway, corpus, resource, PR, merge or deployment is claimed.

## 2026-07-22T20:47:22Z — Public browser queries use a dedicated disabled-by-default gateway

Decision: implement `POST /api/public/v1/query` as the only anonymous browser query boundary. The browser supplies no tenant, principal or service credential. Tenant and jurisdiction are server configuration; Authorization and Cookie headers are rejected; anonymous retrieval is keyword/phrase only; forced RLS, strict public evidence eligibility, HMAC/global rate buckets and minimized audit remain authoritative.

Decision: implementation does not authorize enablement. The gateway stays disabled and Pages remains unbound until an authorized ingested public corpus, exact origins, edge controls, staging, load/SLO evidence and deployment approval exist.

Evidence: Feature 072 `856a6edee20cdb14a16a89d0d1a831faadbf166e`, 23/23 named eval, detached 840/842 regression, 33/33 contracts, fresh PostgreSQL 16.14/pgvector 0.8.5 migrations 001–016, non-owner forced-RLS gate, compiled public HTTP smoke and Backend CI `29955124279` success. No PR, merge, cloud resource, Pages binding or deployment is claimed.

## 2026-07-22T21:54:35Z — Execute API/system staging before browser or cloud staging

Decision: Feature 073 is the authoritative provider-side runner for the Feature 070 plan. It maps all twenty runnable API/system journeys exactly once, keeps all twelve browser journeys blocked, executes repository-controlled gates/smokes in four disposable PostgreSQL databases, emits a sanitized SHA-bound receipt and proves cleanup of four databases and three non-owner runtime roles.

Decision: a disposable local/CI PostgreSQL lifecycle is staging evidence for server behavior only. It does not authorize gateway enablement, count as managed cloud staging, prove real-corpus quality, human identity/UI, external consumer conformance, load/HA, merge or deployment.

Evidence: functional SHA `4f6ab306d383f6d74808b393a88ff8172d666b5b`, 14/14 named eval, detached 854/856 regression, 33/33 contracts, PostgreSQL 16.14/pgvector 0.8.5 receipt with 20/20 API/system journeys, 12/12 browser blockers, cleanup 4/4 databases and 3/3 roles, zero/zero postcondition, and Backend CI `29959965725` success including `Execute ephemeral staging runner`.

## 2026-07-23T05:45:00Z — USD 5 authorizes no persistent Cloud SQL environment

Decision: record `rag-municipalidades`, project number `1059368783280`, `us-central1`
and `AUTH_PROXY_PUBLIC` as a disabled, time-bounded pilot configuration. A resource-bearing
plan additionally requires a reviewed hourly rate, a maximum runtime whose compute estimate
fits the declared budget, all human approvals and the exact confirmation phrase.

Decision: treat GCP budgets and the Terraform estimate as planning/alerting controls, not a
hard spending cap. At the July 2026 reviewed compute/memory rate of USD 0.06755/hour for
`db-custom-1-3840`, a four-hour pilot estimates USD 0.2702 before storage, backups, network,
taxes or other charges. Current pricing must be re-reviewed before a live plan.

Decision: do not replace PostgreSQL/pgvector with BigQuery Vector Search in this slice.
Transactions, forced RLS, migrations, relational integrity and non-owner runtime roles are
current product controls and require equivalent evidence before any architecture migration.

Evidence: project-specific zero-resource Terraform plan, exact two-resource approved offline
shape, EVAL-GCP-CLOUDSQL-STAGING-001 13/13 and the Feature 074 ADR/runbook/risk register.
No resource, API enablement, billing mutation, Terraform apply or cost occurred.


## 2026-07-23T07:03:38Z — Name the pilot emergency owner without publishing personal contact data

Decision: revise the proposed pilot budget from USD 5 to USD 1. Record Eduardo Sacahui
as the named billing owner and emergency stop/teardown owner, with the non-sensitive
resource label `owner=eduardo-sacahui`. The confirmed contact address remains outside
the repository, Terraform state, resource labels and logs.

Decision: treat the project owner's spend confirmation as conditional authorization for
a future controlled pilot, not as permission to apply the current configuration. Direct
billing-role verification, an actual USD 1 budget with 50%, 90% and 100% alerts,
residency policy review, IAM ownership, a protected GCS state backend, current pricing
and final approval of the exact live plan remain mandatory.


## 2026-07-24T06:40:00Z — Distinguish the live COP budget from the USD planning envelope and recover bucket IAM before planning

Decision: retain USD 1 as the Terraform cost-review envelope and record COP 4,000 as the
actual recurring Cloud Billing budget. Verified billing, alert and residency controls do
not authorize Cloud SQL creation.

Decision: do not remove legacy bucket-owner convenience bindings until bucket-scoped
`roles/storage.admin` is effective. When recovery is required, grant project-level
Storage Admin temporarily, verify propagation, establish bucket-scoped administration,
remove legacy bindings, verify the final policy and remove the temporary project grant.

Evidence: authenticated Cloud Shell output, recovery commit `ce01163`, 14/14 focused tests,
typecheck, Terraform validation workflow 30042673681 and Backend CI workflow 30042673669.
No Cloud SQL instance or Terraform apply is claimed.

## 2026-07-25T05:20:00Z — Refresh Cloud SQL pilot pricing before a resource-bearing plan

Decision: supersede the prior USD 0.06755/hour compute-and-memory estimate for future
planning. Official Cloud SQL Enterprise pricing for `us-central1` lists USD 0.054 per
vCPU-hour and USD 0.009 per GiB-hour. `db-custom-1-3840` therefore reviews at
USD 0.08775/hour and USD 0.351 for four hours. The configured 20 GiB SSD capacity adds
approximately USD 0.03726024 for the same window, producing USD 0.38826024 before
backups, network, taxes or other charges.

Decision: retain the USD 1 Terraform planning envelope and four-hour maximum because the
reviewed base estimate remains within that envelope. This review does not authorize a
resource-bearing plan or `terraform apply`; both remain tied to an exact immutable plan.


## 2026-07-25T07:11:21Z — Reject address-correct plans that omit required operational metadata

Decision: reject the first exact resource-bearing Cloud SQL plan even though it contained
only the approved two create actions and retained the core database safeguards. The plan
omitted the required non-sensitive `owner=eduardo-sacahui` label and is therefore not
eligible for approval or apply.

Decision: replace address-only plan validation with a reusable JSON verifier that checks
actions, project, region, instance identity, PostgreSQL version, tier, transport,
authorized networks, connector enforcement, IAM authentication, backups, PITR, disk
bounds, Query Insights, deletion protection, required labels and bounded-cost outputs.
Ignore binary plan files and JSON/text derivatives.

Evidence: authenticated plan output at repository head
`8d6991d7d025b41a6e26a02c3bc6a034a36e90ca`; exact two-resource shape; SHA-256 plan
`57851090aa472c2d7263b1de7a742680c174faa73e667ec2cfeb2e54e52b41eb`; no Cloud SQL
creation and no `terraform apply`.


## 2026-07-25T15:25:22Z — Accept the corrected immutable plan for final authorization review

Decision: accept the corrected Cloud SQL resource-bearing plan as technically valid for
final authorization review. The plan was generated from repository head
`e7c4393b0655d3c660941778ff47b1f31e6be57d`, contains exactly SQL Admin API enablement and one protected PostgreSQL
16 instance, includes `owner=eduardo-sacahui`, and passed the reusable verifier with no
issues.

Decision: technical verification does not authorize execution. Any later `terraform apply`
must be explicitly authorized against the exact plan, JSON, text and verification hashes
recorded in the evidence register, together with a start time and four-hour stop window.
Owner redundancy remains unresolved. No Cloud SQL resource was created and no apply ran.


## 2026-07-25T15:48:48Z — Accept a temporary single-owner exception and authorize the exact pilot plan

Decision: accept a temporary governance exception for one project owner because the
current pilot has no second approved human GCP principal. The assistant is not a human or
IAM principal and cannot satisfy redundancy. The exception is scoped only to the corrected
immutable synthetic-staging plan, expires at teardown or 2026-07-25 13:00
America/Guatemala, and is invalid for production, another plan or a later window.

Decision: authorize Terraform apply only for the four recorded SHA-256 values of artifact
`approved-live-v2-e7c4393b0655-20260725T152522Z`, during 09:00-13:00
America/Guatemala on 2026-07-25. A fail-closed manual applicator must verify the exact
hashes, verifier status, plan source, repository/module immutability, empty remote state,
active project and current time before applying the saved plan. Authorization is not an
execution receipt; Cloud SQL remains uncreated until apply evidence is supplied.


## 2026-07-25T18:42:49Z — Reconstruct the authorized apply and expire the exception on stop

Decision: treat the remote Terraform state plus successful Cloud SQL `CREATE` operation as
proof that the exact authorized plan was applied, despite the absence of the applicator's
local success receipt in the conversation. The later applicator refusal is expected because
the state already contains the two approved addresses.

Decision: accept the successful activation-policy update and final `STOPPED` state as the
bounded stop receipt. The temporary single-owner exception expired on stop. Do not restart,
reapply, import, remove state, disable deletion protection or destroy under the expired
authorization. A new explicit authorization is required either for a managed synthetic run
or for destructive teardown. Actual billing remains unknown until provider reporting catches
up; stopped compute does not imply zero storage or backup cost.


## 2026-07-25T19:25:00Z — Reopen a four-hour managed-run window

Decision: accept a second temporary single-owner exception from 13:25 through 17:25
America/Guatemala for the managed synthetic run. The scope is restart, one ephemeral
built-in PostgreSQL operator, loopback-only pinned Auth Proxy, preflight, the existing 20
API/system journeys, verified cleanup, operator deletion and final stop. The maximum
additional compute-and-memory planning amount is USD 0.351. A watchdog and exit trap must
return the instance to `STOPPED`. Terraform apply, state mutation, deletion-protection
changes and destructive teardown are excluded.


## 2026-07-25T23:57:58Z — Establish a public Playwright gate without unblocking authenticated journeys

Decision: require a separate Playwright gate for the generated public Pages artifact in
Chromium desktop and mobile. The gate covers responsive geometry, focus/keyboard behavior,
reduced motion, fail-closed public experiences, bounded Academy progress and Pages bridge
credential stripping. Browser console/page errors fail the gate.

Decision: do not count these ten public executions toward the twelve authenticated
role-aware journeys. Human IdP/BFF/session, secure cookies/CSRF and authenticated UI remain
required before those journeys can become runnable. The expired Cloud SQL restart window
is not extended by this work and no cloud mutation is authorized.
