# GCP Cloud SQL staging runbook

Status: live administrative controls, state-bucket IAM recovery, the live
zero-resource Terraform plan and current pricing are verified. The first exact
resource-bearing plan was generated but rejected because it omitted the required
`owner=eduardo-sacahui` label. Owner redundancy, a corrected immutable plan and final
execution approval remain pending. No Cloud SQL instance has been created and no
`terraform apply` has been run.

## Recorded pilot inputs

```text
project_id: rag-municipalidades
project_number: 1059368783280
region: us-central1
connectivity: AUTH_PROXY_PUBLIC pilot
planning_pilot_budget_usd: 1
live_billing_currency: COP
live_monthly_budget_cop: 4000
reviewed_hourly_compute_usd: 0.08775
max_pilot_runtime_hours: 4
estimated_compute_and_memory_usd: 0.351
billing_owner: Eduardo Sacahui
emergency_stop_teardown_owner: Eduardo Sacahui
operational_contact: verified and maintained outside the repository
billable_authorization: confirmed for a future controlled pilot
```

The USD value is the Terraform cost-review envelope; COP 4,000 is the actual recurring
Cloud Billing budget. The 2026-07-24 review estimates USD 0.351 for four hours of
compute and memory and USD 0.38826024 when the configured 20 GiB SSD capacity is
included. Backups, network, taxes and other charges remain excluded. Pricing must be
refreshed again if the plan is generated after this review window. Budget alerts do not
stop spend automatically, and the Terraform estimate is not a billing hard cap.

## Live administrative evidence

Out-of-band authenticated Cloud Shell output verified:

- the project is linked to a COP-denominated billing account;
- the named operator has Billing Account Administrator access;
- a project-scoped COP 4,000 monthly budget exists with current-spend alerts at 50%,
  90% and 100%;
- the effective `constraints/gcp.resourceLocations` policy allows all locations, so
  `us-central1` is permitted;
- a dedicated regional Standard GCS state bucket exists with uniform bucket-level
  access, public access prevention, versioning, seven-day soft delete and the approved
  non-sensitive labels;
- authenticated `--apply` and `--check` executions both completed successfully;
- bucket-scoped `roles/storage.admin` is established for the approved operator;
- no `roles/storage.legacy*` convenience bindings remain on the state bucket;
- the temporary project-level recovery grant was removed before successful completion;
- only one project `roles/owner` principal was observed;
- Cloud SQL was not created and `terraform apply` was not run.

The recovery sequence is fail-closed and idempotent: it temporarily grants project-level
`roles/storage.admin` only when bucket IAM is inaccessible, waits for propagation,
establishes bucket-scoped administration, updates bucket controls, removes legacy
bindings, verifies the final policy and removes the temporary project-level grant. The
live recovery completed successfully on 2026-07-24.

## Remaining human approvals and controls

1. decide whether to add a second appropriate human project owner or record an
   accepted governance exception; no owner is added automatically;
2. regenerate and inspect the exact resource-bearing plan using the 2026-07-24
   reviewed pricing inputs, the required owner label and the repository verifier;
3. obtain platform, database, security and release approval for that corrected exact plan;
4. approve the time-bounded Auth Proxy public pilot and synthetic-only fixtures;
5. record the start time and four-hour stop window;
6. issue final execution authorization tied to the exact live plan, which must be the
   reviewed resource-bearing plan.

Eduardo Sacahui is the confirmed emergency stop/teardown owner. Personal contact data
must not be committed to the repository, Terraform state, resource labels or logs. Use
the non-sensitive resource label `owner=eduardo-sacahui`.

## Initialize the verified backend and produce a zero-resource live plan

The bootstrap script writes ignored `backend.tf` and `backend.gcs.hcl` files with mode
`0600`. `backend.tf` declares the GCS backend, while `backend.gcs.hcl` supplies the bucket
and prefix. Keeping both files outside Git lets repository CI initialize without a backend
and run offline plans. From authenticated Cloud Shell, first prove the live backend can
initialize and that committed defaults still plan zero resources:

```bash
cd ~/LA_muni_RAG/infra/gcp/cloudsql-staging

test -f backend.gcs.hcl
test ! -f terraform.tfstate

terraform init -reconfigure -backend-config=backend.gcs.hcl
terraform plan \
  -out=default-live.tfplan \
  -var='project_id=rag-municipalidades' \
  -var='connectivity_mode=AUTH_PROXY_PUBLIC'

terraform show -json default-live.tfplan > default-live.tfplan.json
jq -e '
  ([.resource_changes[]? | select(.change.actions != ["no-op"])] | length) == 0 and
  (.output_changes.resources_enabled.after == false)
' default-live.tfplan.json

rm -f default-live.tfplan default-live.tfplan.json
```

Stop if initialization proposes state migration, if a local `terraform.tfstate` exists,
or if the plan contains any resource change. Do not commit backend configuration, state,
plan files or plan JSON. This zero-resource plan is evidence only and does not authorize
a resource-bearing plan or apply.

Authenticated Cloud Shell evidence on 2026-07-24 verified Terraform 1.15.8, successful
GCS backend initialization, zero resource changes, `resources_enabled=false`, successful
JSON assertion and removal of the local plan and JSON files. Cloud SQL was not created
and `terraform apply` was not run.

## First resource-bearing plan: generated and rejected

Authenticated Cloud Shell generated an exact two-resource plan from repository head
`8d6991d7d025b41a6e26a02c3bc6a034a36e90ca`. The plan proposed only SQL Admin API
enablement and one protected PostgreSQL instance, with PostgreSQL 16, connector
enforcement, encrypted-only transport, no authorized networks, IAM database
authentication, backups, PITR, bounded SSD, Query Insights and both deletion-protection
layers. The JSON assertion passed and `terraform apply` was not run.

The plan is **not eligible for approval or apply** because its `user_labels` omitted the
required non-sensitive `owner=eduardo-sacahui` label. Its SHA-256 evidence is retained
only to identify the rejected artifact:

```text
plan: 57851090aa472c2d7263b1de7a742680c174faa73e667ec2cfeb2e54e52b41eb
json: a176802dc2814ec7ee63461b31068a397993dbbb36ba31976bf3a93b41e8795d
text: 0ba3e348227400cb1e75fd495624e95a86819eb1410e682bedaeb32c7fa83bf6
review_status: rejected_missing_owner_label
```

Do not apply or approve those hashes. Keep the rejected files outside Git or remove them
after the evidence record is secured.

## Regenerate and verify the corrected exact plan

The first manual regeneration attempt was started from the Cloud Shell home directory
instead of the repository module. Terraform therefore initialized an empty directory,
no plan was created, `npm` could not find `package.json`, and the shell continued because
the fail-fast preamble had not been included. The resulting zero-byte JSON/text files and
success message are invalid evidence. No infrastructure mutation occurred.

The repository now provides a self-locating, fail-fast generator. It verifies the branch,
remote HEAD, clean tracked worktree, active GCP project, gcloud authentication, exact
Terraform version, backend files and absence of local state. The live plan uses
`-lock-timeout=60s` rather than disabling state locking. The script writes into a temporary
directory, invokes the reusable plan verifier, requires every output to be non-empty and
only then atomically publishes an ignored artifact directory with SHA-256 hashes.

Run this single command from any Cloud Shell directory:

```bash
git -C ~/LA_muni_RAG pull --ff-only && \
  bash ~/LA_muni_RAG/infra/gcp/generate-cloudsql-live-plan.sh
```

The script moves any original `approved-live.*` files found in the Terraform module into
`plan-artifacts/rejected-missing-owner/`. It does not touch similarly named files outside
the repository. Empty files accidentally created in the Cloud Shell home directory may
be removed separately after confirming their size is zero.

Success requires `status: "valid"`, four non-empty artifacts and a `SHA256SUMS` manifest
inside an ignored directory named for the repository HEAD and UTC timestamp. A correct
address set alone is insufficient. The script contains no `terraform apply` command.

## Corrected immutable plan: verifier-valid, not execution-authorized

Authenticated Cloud Shell successfully ran the self-locating generator from repository
head `e7c4393b0655d3c660941778ff47b1f31e6be57d`. Terraform proposed exactly two creates: SQL Admin API enablement
and one protected PostgreSQL 16 instance. The plan includes the required
`owner=eduardo-sacahui` label, and the reusable verifier returned `status: valid` with an
empty issue list. The immutable artifact directory is:

```text
approved-live-v2-e7c4393b0655-20260725T152522Z
```

Artifact identity:

```text
plan: a9c16848cc89d68ad56de2d1344f3e6e20da0a4faca753a060d9a726aa09fe1e
json: 8e7a01cbc29bbce63c9d05b4a0935765cb6779afd05c7514cb8b7c0d8c0e106a
text: efd8f22358385c94f49f2edca40d141e38a274cbc10c47c0a7df1694577cc3e2
verification: d6b6a840b05b8ade30e1fca5408ec06d7f4f6ae923607c02b9f819a7baa1adce
```

These hashes supersede the rejected first-plan hashes for review purposes. Technical
verification does not constitute final execution authorization. Any future authorization
must name these exact four hashes, the intended start time and the four-hour stop window.
No Cloud SQL instance was created and `terraform apply` was not run.

## Governance exception and exact execution authorization

On 2026-07-25 the project owner accepted a temporary single-owner governance exception
for this synthetic staging pilot because no second approved human GCP principal exists in
the current team. The assistant is not a human principal, cannot hold IAM ownership and
does not count as owner redundancy. The exception is limited to the exact immutable plan
below and expires at the earlier of successful teardown or 2026-07-25 13:00
`America/Guatemala`. It does not authorize production, a different plan, a later window or
an extension of runtime.

Final execution authorization was granted for exactly these four SHA-256 values:

```text
plan: a9c16848cc89d68ad56de2d1344f3e6e20da0a4faca753a060d9a726aa09fe1e
json: 8e7a01cbc29bbce63c9d05b4a0935765cb6779afd05c7514cb8b7c0d8c0e106a
text: efd8f22358385c94f49f2edca40d141e38a274cbc10c47c0a7df1694577cc3e2
verification: d6b6a840b05b8ade30e1fca5408ec06d7f4f6ae923607c02b9f819a7baa1adce
```

Authorized execution window:

```text
timezone: America/Guatemala
start: 2026-07-25T09:00:00-06:00
end: 2026-07-25T13:00:00-06:00
maximum_runtime_hours: 4
```

The manual applicator is fail-closed and refuses execution outside this window, when the
current branch is not aligned with the remote, when the Terraform module or verifier has
changed since the plan source commit, when remote state is non-empty, or when any artifact
hash or verification field differs. Run from authenticated Cloud Shell:

```bash
git -C ~/LA_muni_RAG pull --ff-only && \
  FINAL_AUTHORIZATION=APPLY_APPROVED_LA_MUNI_GCP_STAGING_20260725 \
  bash ~/LA_muni_RAG/infra/gcp/apply-approved-cloudsql-live-plan.sh
```

This authorization records permission to execute the exact plan; it does not claim that
`terraform apply` has already run. The apply receipt, managed staging receipt and teardown
evidence must be recorded separately.

## Provisioning boundary

Repository CI performs formatting, provider initialization, validation and offline plan
assertions. Committed defaults produce zero resources. The approved plan is constrained
to Cloud SQL API enablement and one protected PostgreSQL instance. Infrastructure
mutation remains a separate human action outside repository automation.

Use `infra/gcp/cloudsql-staging/rag-municipalidades.pilot.tfvars.example` as the review
basis. All billable and approval gates remain `false` in that file. Do not edit the
committed example into an enabled configuration.

The target is PostgreSQL 16 Enterprise with pgvector availability, backups, PITR, IAM
database authentication, bounded SSD growth, connector enforcement, Query Insights and
both Terraform/API deletion protection. Private IP is the long-term default.
`AUTH_PROXY_PUBLIC` is a time-bounded pilot exception with no authorized networks.

## Temporary staging operator

Create a dedicated IAM database user separately after the instance exists. Cloud SQL IAM
authentication does not grant PostgreSQL privileges automatically. For the bounded
staging lifecycle, the temporary operator must be granted `cloudsqlsuperuser` so it can
create the four test databases and three non-owner roles. Revoke that membership when
the run finishes. Application runtime roles remain non-owner, `NOSUPERUSER` and
`NOBYPASSRLS`.

## Cloud SQL Auth Proxy

Prefer automatic IAM database authentication. Start the proxy on loopback and never
expose its local listener:

```bash
cloud-sql-proxy \
  --address 127.0.0.1 \
  --port 5433 \
  --auto-iam-authn \
  rag-municipalidades:us-central1:la-muni-rag-staging
```

The proxy uses IAM authorization and an encrypted connection to Cloud SQL. No browser or
static frontend receives database material.

## Preflight

In another terminal, use the lowercase IAM database username. A password is not required
when the proxy uses automatic IAM authentication:

```bash
export GCP_CLOUDSQL_CONFIRM_STAGING=true
export STAGING_ADMIN_DATABASE_URL='postgresql://iam-user@example.com@127.0.0.1:5433/postgres'
npm run gcp:cloudsql:preflight
```

Preflight fails unless the endpoint is loopback, PostgreSQL is version 16 or newer,
`vector` is available, the connection has the temporary admin capabilities required by
the staging runner, the Cloud SQL IAM flag is visible and no unrelated database exists.

## Execute the established staging matrix

Only after preflight, explicit spend approval and a human start-time record, execute the
exact provider-side matrix already used locally and in CI:

```bash
export STAGING_CONFIRM_EPHEMERAL=true
export STAGING_CLEAN_EXISTING=false
export STAGING_RUN_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
npm run staging:run
```

Expected provider-side result is 20/20 API/system journeys, four created/destroyed test
databases, three created/destroyed non-owner roles and a zero/zero postcondition. The
twelve browser journeys remain blocked and must not be counted as passed.

The instance must be dedicated to this synthetic staging run. Do not point the runner at
production, shared development, an instance containing unrelated databases or a project
without explicit cost authorization.

## Four-hour pilot boundary

1. Record start time, approver, Eduardo Sacahui as stop/teardown owner, and confirmation that the reviewed price inputs remain current.
2. Execute preflight and the staging runner.
3. Record actual runtime, logs and receipt.
4. Stop or initiate the protected teardown review before four elapsed hours.
5. Verify billing export or console observations when available.
6. Treat any overrun, failed cleanup or missing owner as an incident and stop work.

## After the run

1. retain only the sanitized SHA-bound receipt;
2. confirm zero target databases and zero target roles;
3. revoke temporary `cloudsqlsuperuser` membership;
4. review Cloud Audit Logs and Query Insights without retaining query/document content;
5. record actual cost and runtime;
6. stop the instance or initiate the separate deletion-protection and removal procedure;
7. never treat this as real-corpus, browser, load/HA or production evidence.
