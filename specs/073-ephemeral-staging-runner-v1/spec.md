# Feature 073 — Ephemeral staging runner v1

Status: implemented, independently verified and published; API/system staging executed with synthetic fixtures, while browser/cloud/production remain unproved.

## Objective

Execute the Feature 070 staging architecture against a dedicated disposable PostgreSQL/pgvector service, prove all twenty runnable API/system journeys, preserve the twelve browser blockers, emit a closed sanitized receipt and destroy every database and runtime role created by the run.

## Functional requirements

1. Load and validate the canonical staging plan before mutation.
2. Map every runnable API journey exactly once to a compiled smoke; map no browser journey.
3. Use only the four fixed `_test` databases and three fixed non-owner runtime roles.
4. Require a loopback PostgreSQL admin URL targeting `/postgres`, explicit ephemeral confirmation and a dedicated cluster with no unrelated databases.
5. Refuse pre-existing known databases/roles unless explicit cleanup is enabled.
6. Build without shell execution and run child smokes with a minimal environment and local dotenv disabled.
7. Apply only repository-controlled migration/gate SQL.
8. Exercise exact viewer, document manager, platform admin, tenant admin, integration client, procedure author, reviewer, approver and case operator personas.
9. Recreate the catalog database and verify the source list is empty after reset.
10. Always destroy run-owned databases and roles, including after smoke failure.
11. Preserve foreign/pre-existing environments when cleanup was not authorized.
12. Validate a closed receipt before writing it under ignored `artifacts/staging/` with mode `0600`.
13. Persist no connection URL, password, credential, raw child output, query, document content or production claim in the receipt.
14. Execute both the named eval and the real runner in CI without provisioning cloud resources.

## Explicit non-goals

- real municipal corpus acquisition or ingestion;
- browser authentication or browser E2E;
- external OS Electoral or Content Agency execution;
- GCP project/resource creation;
- load, HA, penetration, privacy or production observation evidence;
- merge or deployment.

## Acceptance

- `EVAL-EPHEMERAL-STAGING-RUNNER-001` passes;
- PostgreSQL 16/pgvector run reports 20/20 API journeys and 12/12 browser blockers;
- receipt validation passes;
- independent queries find zero target databases and zero target roles after execution;
- full regression, contracts, build and audits remain green;
- exact remote SHA and remote CI success are recorded before checkpoint closure.
