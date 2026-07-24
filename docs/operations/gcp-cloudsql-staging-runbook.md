# GCP Cloud SQL staging runbook

Status: live administrative controls are mostly verified; bucket IAM recovery and final
live-plan approval remain pending. No Cloud SQL instance has been created and no
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
reviewed_hourly_compute_usd: 0.06755
max_pilot_runtime_hours: 4
estimated_compute_and_memory_usd: 0.2702
billing_owner: Eduardo Sacahui
emergency_stop_teardown_owner: Eduardo Sacahui
operational_contact: verified and maintained outside the repository
billable_authorization: confirmed for a future controlled pilot
```

The USD value is the Terraform cost-review envelope; COP 4,000 is the actual recurring
Cloud Billing budget. The estimate excludes storage, backups, network, taxes and other
charges. It must be refreshed from official pricing before a resource-bearing plan. A
budget alert does not
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
- only one project `roles/owner` principal was observed;
- Cloud SQL was not created and `terraform apply` was not run.

The first IAM-hardening attempt removed legacy bucket-owner convenience bindings after
establishing only object administration. That role cannot read or change bucket IAM, so
the operator lost `storage.buckets.getIamPolicy`. Commit `ce01163` repairs the sequence:
it temporarily grants project-level `roles/storage.admin` only when needed, establishes
bucket-scoped `roles/storage.admin`, removes legacy bindings, verifies the final policy
and then removes the temporary project-level grant.

## Remaining human approvals and controls

1. run the `ce01163` recovery and obtain the final successful `--check` output;
2. decide whether to add a second appropriate human project owner; no owner is added
   automatically;
3. obtain platform, database, security and release approval for the exact live plan;
4. approve the time-bounded Auth Proxy public pilot and synthetic-only fixtures;
5. refresh current pricing and record the start time and four-hour stop window;
6. issue final execution authorization tied to the exact live plan.

Eduardo Sacahui is the confirmed emergency stop/teardown owner. Personal contact data
must not be committed to the repository, Terraform state, resource labels or logs. Use
the non-sensitive resource label `owner=eduardo-sacahui`.

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

1. Record start time, approver, Eduardo Sacahui as stop/teardown owner, and current price review.
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
