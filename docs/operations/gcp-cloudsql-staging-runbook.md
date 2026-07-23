# GCP Cloud SQL staging runbook

Status: plan-ready only; no GCP resource has been created by this feature.

## Recorded pilot inputs

```text
project_id: rag-municipalidades
project_number: 1059368783280
region: us-central1
connectivity: AUTH_PROXY_PUBLIC pilot
proposed_pilot_budget_usd: 5
reviewed_hourly_compute_usd: 0.06755
max_pilot_runtime_hours: 4
estimated_compute_and_memory_usd: 0.2702
billable_authorization: absent
```

The estimate excludes storage, backups, network, taxes and other charges. It must be
refreshed from official pricing before a resource-bearing plan. A budget alert does not
stop spend automatically, and the Terraform estimate is not a billing hard cap.

## Human approvals required before any billable action

The complete gate still requires:

1. billing-owner confirmation for the existing project;
2. an actual GCP budget and alerts, plus an approved stop/teardown owner;
3. region and data-residency approval;
4. platform, database, security and release approvers;
5. approval of the time-bounded Auth Proxy public pilot;
6. Terraform state backend and access policy;
7. retention, deletion, PITR and incident ownership;
8. confirmation that only synthetic/non-production fixtures will be used;
9. an explicit spend authorization separate from the project values supplied above.

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

1. Record start time, approver and current price review.
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
