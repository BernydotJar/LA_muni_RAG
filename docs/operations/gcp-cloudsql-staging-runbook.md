# GCP Cloud SQL staging runbook

Status: plan-ready only; no GCP resource has been created by this feature.

## Human approvals required before any billable action

Record the existing GCP project, billing owner, region, budget and approvers before any
resource-bearing plan is accepted. The complete gate requires:

1. existing project and billing-owner approval;
2. monthly staging budget and alerts;
3. region and data-residency approval;
4. platform, database, security and release approvers;
5. VPC/private-services-access decision or a time-bounded Auth Proxy public pilot;
6. Terraform state backend and access policy;
7. retention, deletion, PITR and incident ownership;
8. confirmation that only synthetic/non-production fixtures will be used.

## Provisioning boundary

Repository CI performs formatting, provider initialization, validation and offline plan
assertions. Committed defaults produce zero resources. The approved plan is constrained
to Cloud SQL API enablement and one protected PostgreSQL instance. Infrastructure
mutation remains a separate human action outside repository automation.

The target is PostgreSQL 16 Enterprise with pgvector availability, backups, PITR, IAM
database authentication, bounded SSD growth, connector enforcement, Query Insights and
both Terraform/API deletion protection. Private IP is the default. `AUTH_PROXY_PUBLIC`
is a pilot exception with no authorized networks.

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
  PROJECT_ID:REGION:INSTANCE_NAME
```

The proxy uses IAM authorization and an encrypted connection to Cloud SQL. No browser or
static frontend receives database material.

## Preflight

In another terminal, use the lowercase IAM database username. A password is not required
when the proxy uses automatic IAM authentication:

```bash
export GCP_CLOUDSQL_CONFIRM_STAGING=true
export STAGING_ADMIN_DATABASE_URL='postgresql://iam-user@example.com@127.0.0.1:5433/postgres'
node --import tsx src/cli/verifyGcpCloudSqlStaging.ts
```

Preflight fails unless the endpoint is loopback, PostgreSQL is version 16 or newer,
`vector` is available, the connection has the temporary admin capabilities required by
the staging runner, the Cloud SQL IAM flag is visible and no unrelated database exists.

## Execute the established staging matrix

Only after preflight and approval, execute the exact provider-side matrix already used
locally and in CI:

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

## After the run

1. retain only the sanitized SHA-bound receipt;
2. confirm zero target databases and zero target roles;
3. revoke temporary `cloudsqlsuperuser` membership;
4. review Cloud Audit Logs and Query Insights without retaining query/document content;
5. record actual cost and runtime;
6. decide explicitly whether to keep the protected staging instance or initiate the
   separate deletion-protection and removal procedure;
7. never treat this as real-corpus, browser, load/HA or production evidence.
