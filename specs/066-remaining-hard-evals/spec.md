# Feature 066 — Remaining named hard-eval consolidation

Status: implemented locally; PostgreSQL runtime, detached and remote verification pending

## Objective

Close the four named evaluation gaps that still had only dispersed proof:
`EVAL-SOURCE-001`, `EVAL-MISSING-001`, `EVAL-RBAC-001` and `EVAL-INGEST-001`.
The feature must consolidate executable behavior without widening claims beyond
what the repository and disposable runtime actually demonstrate.

## Acceptance criteria

1. Source inventory validates authority, jurisdiction, version and lifecycle.
2. Comparative municipal sources remain non-authoritative for Antigua.
3. Acquisition metadata is not promoted to durable possession or ingestion.
4. Unknown procedures return explicit missing evidence with no invented actor,
   unit, deadline, external system, citation or approval.
5. EvidenceGap remains an open immutable intake, not a resolution claim.
6. All ten product roles and their closed permissions are tested.
7. Tenant context is transaction-local and server-side authorization is tested.
8. Documentary review remains separate from ordinary case operation.
9. Artifact, job lease and vector persistence behaviors are consolidated under
   one ingestion eval and re-run against real disposable PostgreSQL/pgvector.
10. The feature explicitly preserves limitations around real corpus bytes,
    production object storage/scanning/dispatch, human IdP/access review and
    production topology.
11. All four evals are wired into package scripts and CI.
12. Existing named evals and full regression remain green.

## Non-goals

- acquiring or committing municipal document bytes;
- declaring a document ingested;
- selecting or provisioning a human identity provider;
- creating production object storage, malware scanning or dispatch systems;
- production deployment.
