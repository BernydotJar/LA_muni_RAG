# Backend deployment runbook

Status: pre-production procedure; no backend deployment has been performed
Last reviewed: 2026-07-18
Runbook owner: Platform/Operations owner pending assignment
Approval authority: Release manager, Security owner, Database owner, and Product owner (named humans pending)

## Purpose and non-goals

This runbook defines the release gates for the Node.js API and PostgreSQL data plane. It does not select a cloud or container platform, create infrastructure, authorize production, or change the separate public GitHub Pages workflow. A successful CI run builds confidence in source; it never authorizes or performs a backend deployment.

No production runtime, registry, managed database, secret manager, ingress, DNS, observability service, pager, or release environment is evidenced in this repository. Platform selection and risk acceptance require human decisions before these steps can be executed.

## Release invariants

- Every production release has an approved commit SHA, immutable image digest, migration inventory, change record, rollback owner, and named approver.
- The release is built from the reviewed commit using the lockfile; local uncommitted files are not part of it.
- Database migrations are forward-only. Do not reverse schema changes destructively during rollback.
- Secrets come from an approved secret manager at runtime. They never appear in an image layer, repository, CI log, command transcript, ticket, screenshot, or runbook value.
- Production traffic uses TLS and an approved origin/network policy. CORS is not authentication.
- Tenant isolation, authenticated v1 behavior, safe errors, body/rate limits, and audit must be proven before confidential or multi-tenant data is allowed.
- GitHub Pages remains a public static demo and must contain public data only.
- A human release approval is mandatory after preflight and before any production mutation.

## Required platform decisions

The release manager must stop if any item is unassigned or undocumented:

| Decision | Required evidence | Current state |
|---|---|---|
| Runtime platform and region | architecture record, owner, support boundary | pending |
| Container registry | private repository, retention, scanning/signing policy | pending |
| PostgreSQL/pgvector service | version, HA, extensions, roles, connection limits | pending |
| Secret manager and rotation | secret owners, access policy, break-glass flow | pending |
| TLS ingress, DNS, CORS/origins | certificate and network policy | pending |
| Observability | logs, metrics, alerts, dashboards, paging owner | pending |
| Backup/restore | approved RPO/RTO, encrypted destination, restore drill | pending |
| Incident response | named roster and secure channels | pending |
| Capacity and SLOs | expected load, latency/error objectives, quotas | pending |

This table is a production gate, not a backlog that can be waived by CI.

## Repository verification

The backend workflow at `.github/workflows/ci.yml` runs on pushes and pull requests with read-only repository permission. It installs locked dependencies and runs:

```sh
npm ci
npm run contracts:validate
npm run source-inventory:validate
npm run typecheck
npm test
npm run build
```

It contains no deployment step, environment credential, Pages build, or write permission. Branch protection should require this check on the approved release branch; branch-protection configuration is outside this repository and is currently unverified.

Before approving a release, the release manager records the reviewed commit and independently confirms:

1. backend CI passed for that exact commit;
2. contract and migration changes were reviewed by their owners;
3. dependency/container/secret scans have no unaccepted release-blocking findings;
4. the threat and privacy reviews match the release's data flows;
5. the backup checkpoint and rollback plan are ready;
6. no generated, raw, ignored, or developer environment files entered the artifact.

Dependency scanning, secret scanning, SBOM generation, image signing, and provenance attestation are not yet configured by this workflow and remain release blockers until an approved toolchain supplies equivalent evidence.

## Container artifact

The repository `Dockerfile` uses the explicit `node:24.12.0-bookworm-slim` line for build, production dependency, and runtime stages. It uses `npm ci`, installs only production dependencies in the final stage, runs as the official image's non-root `node` user, exposes port 3000, and checks `/health`.

An approved build system should build from the reviewed commit, scan the image, push it to the selected registry, and record the registry-provided digest. A representative local preflight is:

```sh
docker build --pull \
  --build-arg NODE_VERSION=24.12.0-bookworm-slim \
  --tag la-muni-rag:REVIEWED_COMMIT .
```

`REVIEWED_COMMIT` is a non-secret immutable commit identifier. Do not promote a floating local tag as the release identity. The deployment specification must reference the registry digest (`repository@sha256:...`), not `latest` or a mutable tag.

The image includes the canonical v1 JSON Schemas and OpenAPI document because the v1 handler loads schema validators at runtime. It intentionally excludes contract examples, migrations, raw document bytes, `.rag` local library state, tests, docs, environment files, and Git metadata. Migrations are a separately approved release action sourced from the same reviewed commit. PostgreSQL and any external storage remain required services; the container is not a self-contained database.

Local build evidence on 2026-07-18: `docker build --tag la-muni-rag:ops-foundation .` completed with the versioned Node base, locked build/production installs, and TypeScript build. Image inspection reported `user=node`, `NODE_ENV=production`, `PORT=3000`, the `/health` check, no application secret in the image environment, and an approximately 80.8 MB local image. This was an ephemeral development build, not a vulnerability scan, signature, registry push, runtime start, health/SIGTERM test, or deployment. It is not a release artifact or digest attestation.

The later provider preflight rebuilt the disposable tag from current sources with
the base resolved to
`node:24.12.0-bookworm-slim@sha256:7326fb2dbdce998edd72140946851be64ef4a643e8715e138ca467e8e9d92c99`.
The local manifest digest was
`sha256:4c0e291f1508a728d9c95c7f1d5661158781702d2eb7c825f6163db175fa3c8b`,
size 81,083,418 bytes, `USER node`, and environment contained only the base
PATH/version values plus `NODE_ENV=production` and `PORT=3000`. The digest is
local build evidence only; it was not pushed, signed, scanned, or approved.

### Container validation still required

Run in a non-production environment with a disposable, migration-compatible database:

1. start the image with `DATABASE_URL` injected by the platform secret reference and no plaintext value in the command/log;
2. confirm it stays non-root and has a read-only root filesystem where the platform supports it;
3. confirm `/health` transitions to healthy and fails when the process is unavailable;
4. send `SIGTERM`, verify new traffic stops, in-flight requests receive the approved grace period, the PostgreSQL pool closes, and the process exits before forced termination;
5. verify no secret, source body, query body, or stack trace appears in logs;
6. run authenticated success, denial, cross-tenant, rate-limit, and dependency-failure probes.

The current server registers `SIGINT`/`SIGTERM`, calls `server.close()`, and closes the database pool. A bounded shutdown timeout, orchestrator termination grace, and runtime signal test are not yet evidenced and must be resolved before production.

## Secret handling

Minimum production secret classes are the database credential, API/integration credentials, and any embedding/model-provider credential. For each one, record an owner, purpose, authorized workload identity, rotation interval, last rotation, revocation path, and audit source in the selected secret manager.

- Grant the workload access to specific secret versions, not broad list/admin permissions.
- Use separate credentials for production, staging, CI, migrations, backup, and break-glass roles.
- The runtime database role must not own tenant tables and must not have `BYPASSRLS` or schema-migration privileges.
- Inject values directly through the platform; do not write a production `.env` file into the image or persistent workspace.
- Redact URLs because database URLs can contain passwords.
- Rotate immediately after suspected disclosure and record the incident ID, never the secret value.

## Database migration gate

The repository currently has ordered SQL migration files but no production migration ledger/runner. That is an operational blocker: the Database owner must be able to prove which migrations ran, when, against which database, from which commit, by which identity, and with what result.

For every new migration:

1. review locking, runtime, extension, privilege, RLS, backfill, nullability, storage, and compatibility impact;
2. test from a production-like backup in an isolated environment and record duration/locks/results;
3. make application version N compatible with the schema transition needed by N and N-1, using expand/migrate/contract when required;
4. take and verify the approved pre-deployment backup/checkpoint;
5. obtain the Database owner and Release manager approvals;
6. run only the reviewed forward migration with `ON_ERROR_STOP`, through an approved migration identity and audited runner;
7. verify schema, RLS/role behavior, invariants, and application smoke before traffic promotion;
8. use a new corrective forward migration if a defect appears. Do not edit an applied migration or run destructive down-SQL.

The SQL files use transactions, but that does not guarantee an online or safe migration for a populated production database. A staging migration test is required for each release.

### Disposable migration/runtime evidence (2026-07-18)

A clean database named exactly `la_muni_rag_test` applied, with
`ON_ERROR_STOP=1`, migrations `001`, `002`, legacy vector `011`, `003`, both
registry seeds, and `004`. `db/tests/procedure_query_runtime_gate.sql` then used
a disposable login that was neither owner, superuser, nor `BYPASSRLS` and proved
missing/malformed tenant denial, tenant A/B read/write isolation, same source
bytes in separate tenants, credential function access without identity-table
access, bounded tenantless auth audit, and success-only replay state.

The reported runtime was PostgreSQL 16.14 (Debian) with pgvector 0.8.5. The
compiled handler smoke returned
`200, 200, 409, 403, 400, 401, 500, 200` for success, replay, conflict, tenant
denial, boundary refusal, missing auth, corrupt stored replay, and recomputation.
The image-default production probe returned a non-CORS 404 for the legacy
`/api/search` route.
Post-run inspection found no raw disposable token, key, query, tenant-B marker,
or corrupt-response marker in procedure audit details. The test SQL refuses any
database name other than `la_muni_rag_test`.

This is reproducible local evidence, not a migration ledger, populated-data lock
test, backup restore, HA failover, load test, approved staging topology, or
production authorization. The disposable credential literals in the test
fixture are fixtures only and must never be reused outside that isolated gate.

## Deployment sequence

### 1. Open the change

Record release ID, commit SHA, image digest, included migrations, contract version, change summary, affected tenants/data classes, maintenance expectation, monitoring owner, rollback image digest, incident channel, and all approvals.

### 2. Preflight

- Verify backend CI and independent security/artifact evidence for the exact commit.
- Confirm platform status, database capacity/replication, backup freshness, and no conflicting migration or incident.
- Confirm expected environment variable names without printing values: `DATABASE_URL`, optional `PORT`, optional `DOMAIN_PACK`, and only approved provider credentials.
- Confirm the runtime identity can read required secrets and connect with the least-privilege role.
- Confirm dashboards, alerts, log redaction, paging, and the on-duty Incident Commander.
- Confirm the prior image remains available by digest.

### 3. Backup and migrate

Execute [Backup and restore](./backup-restore.md) checkpoint requirements. Apply only reviewed forward migrations using the audited migration role. Stop on the first error and preserve diagnostics without copying sensitive rows.

### 4. Deploy without broad traffic

Create a canary or zero-traffic revision using the immutable image digest. Inject secrets by reference, set resource/concurrency/time limits, and use the selected platform's non-root/read-only controls. Do not expose it publicly until health and authenticated smoke pass.

### 5. Smoke test

At minimum, record status and request/correlation ID for:

- `GET /health` returns the expected service and dependency-safe status without secrets;
- an authenticated, authorized v1 procedure query succeeds and conforms to the v1 schema;
- malformed input returns a bounded structured 400;
- absent/invalid credentials return a uniform 401;
- forbidden role and cross-tenant request return non-leaking 403 responses and sanitized denial audit;
- idempotent replay returns the same result and conflicting reuse returns 409;
- rate limiting returns 429 with the expected retry guidance;
- a boundary-violating electoral/content request is refused;
- representative evidence links resolve only to authorized/public sources.

If the v1 route or any isolation control is not integrated, the production smoke cannot pass and the release is blocked. Do not substitute successful legacy-route calls.

### 6. Progressive traffic and observation

Increase traffic in approved stages only while the monitoring owner watches:

- request rate, p50/p95/p99 latency, 4xx/5xx, timeouts, and restarts;
- 401/403/409/429 rates without tenant/resource details in labels;
- database connections, pool waits, statement latency, locks, storage, replication/HA health;
- RLS/authorization denials and unexpected empty-result changes;
- queue/ingestion failures, evidence/citation gaps, and provider errors;
- CPU, memory, file descriptors, network, and platform throttling;
- audit/log delivery and redaction.

Thresholds and SLOs are pending platform/capacity decisions. Until they are approved, traffic promotion is not authorized.

### 7. Close or roll back

When acceptance holds through the approved observation window, record the final traffic state, smoke evidence, dashboards, migration result, approvers, and residual risks. On a trigger, follow [Rollback](./rollback.md) and open an incident when security, privacy, integrity, or material availability may be involved.

## Pages boundary

`.github/workflows/deploy-pages.yml` is a separate static-site workflow. The backend CI does not call it and the backend container is not deployed by it. Pages assets must remain public-only and secret-free. A Pages success cannot be cited as backend health, database readiness, authentication, or tenant-isolation evidence.

The existing Pages workflow can run on `main`; branch/environment protection and human approval for that public demo are external GitHub settings and are not verified here.

## Context7 primary-source evidence

On 2026-07-18 these Context7 CLI queries were used:

```text
npx ctx7 docs /docker/docs "Dockerfile multi-stage build USER non-root HEALTHCHECK best practices"
npx ctx7 docs /nodejs/node "HTTP server SIGTERM graceful shutdown process signals production"
```

Context7 returned primary Docker documentation from `github.com/docker/docs`, including multi-stage examples, explicit Node 24.12.0 image use, non-root `USER` guidance, and `HEALTHCHECK` defaults. It returned Node.js primary `process` and `http` documentation for `SIGTERM` listeners and `server.close()`. These references informed the repository artifact and validation checklist. They are design evidence, not an image build, vulnerability scan, shutdown test, or deployment result.
