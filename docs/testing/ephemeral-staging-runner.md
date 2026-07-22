# Ephemeral staging runner

Feature 073 turns the Feature 070 plan into an executable local/CI gate.

## What it executes

The runner validates the canonical plan, creates four fresh databases in a dedicated PostgreSQL/pgvector service, applies guarded migrations and fixtures, executes compiled HTTP/service smokes, recreates the catalog database for reset verification, validates a sanitized receipt and destroys all run-owned databases and roles.

```text
API/system journeys: 20
browser journeys: 12 (all intentionally blocked)
databases: 4
runtime roles: 3
cloud resources: 0
```

The browser journeys remain blocked by `BLK-HUMAN-IDP-BFF-001` and `BLK-AUTHENTICATED-UI-001`. The runner does not convert them into fake API checks.

## Safety contract

- `STAGING_ADMIN_DATABASE_URL` must use PostgreSQL on loopback and target `/postgres`.
- `STAGING_CONFIRM_EPHEMERAL=true` is mandatory.
- The admin role must be able to create databases and roles.
- The cluster may contain only `postgres`, templates and the four known test database names.
- Existing known test databases/roles are preserved unless `STAGING_CLEAN_EXISTING=true`.
- The executor does not invoke a shell.
- Child processes receive a minimal environment; `DOTENV_CONFIG_PATH=/dev/null` prevents local `.env` loading.
- Raw stdout/stderr and connection material are never placed in the receipt.
- Receipts are schema-validated and written under ignored `artifacts/staging/<run-id>/receipt.json` with mode `0600`.
- Cleanup runs in `finally`; independent postcondition queries must show zero target databases and roles.

## Command

With a dedicated PostgreSQL 16 + pgvector 0.8.5 service already listening locally:

```bash
STAGING_ADMIN_DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@127.0.0.1:55432/postgres' \
STAGING_CONFIRM_EPHEMERAL=true \
STAGING_CLEAN_EXISTING=false \
npm run staging:run
```

Use `STAGING_CLEAN_EXISTING=true` only for a disposable CI/local cluster whose known test names may remain from an interrupted run.

## Evidence produced

The receipt contains immutable Git SHA, plan version, phase states, twenty journey states, twelve browser blockers and cleanup counts. It does not contain municipal data or prove real-corpus quality, human authentication, external interoperability, staging deployment or production readiness.
