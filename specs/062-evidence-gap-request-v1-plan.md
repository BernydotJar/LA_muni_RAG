# Plan — 062 EvidenceGapRequest Provider v1

Status: implemented locally; remote publication verification pending

## Architecture

The slice is additive and uses a dedicated bounded context within the existing
v1 API process:

```text
OS Electoral
  -> authenticated POST /api/v1/evidence-gap-requests
  -> rate/RBAC/tenant/schema/boundary controls
  -> transport idempotency claim
  -> immutable tenant aggregate claim
  -> exact acknowledgement + audit
```

It deliberately does not invoke ProcedureQuery compilation, retrieval, object
storage, ingestion, workflow lifecycle or ClaimPack generation.

## Components

1. Contract registry and OpenAPI
   - closed request/response JSON Schemas;
   - `requester_supplied_unverified` response labeling;
   - exact route/method/header/error surface.
2. HTTP provider
   - auth-before-body;
   - rate gate before permission/schema;
   - tenant/credential binding;
   - product/authority boundary refusal;
   - exact/canonical replay validation.
3. Persistence
   - immutable `rag.evidence_gap_requests` aggregate;
   - dedicated idempotency/rate tables;
   - bounded pre-tenant authentication aggregate;
   - response SHA-256 constraints and FORCE RLS.
4. Verification
   - focused hard eval and migration tests;
   - OpenAPI/operations documentation-as-code tests;
   - non-owner SQL gate;
   - compiled HTTP smoke;
   - full regression and detached verification.

## Data and transaction plan

One tenant transaction owns aggregate creation, success audit and idempotency
completion. The aggregate uses tenant-leading keys and composite tenant foreign
keys. `ON CONFLICT DO NOTHING` plus an exact scoped read distinguishes replay
from identity conflict under concurrency. The application role has no aggregate
`UPDATE` or `DELETE` privilege, and an owner-level trigger adds defense in depth.

## Security review plan

- reject unknown fields and source authority promotion;
- preserve a uniform non-enumerating 403;
- never persist raw Bearer or idempotency keys;
- keep documentary text out of ordinary audit;
- revalidate stored bytes by hash, schema, identities and canonical semantics;
- test missing/malformed tenant context and pooled transaction-local scope;
- classify immutable aggregate retention as a production Privacy/Legal gate.

## Rollout plan

1. publish feature branch and verify exact remote SHA;
2. require Backend CI with PostgreSQL 16/pgvector service;
3. open/update draft PR when an authorized connector exists;
4. complete external OS Electoral consumer contract tests;
5. approve retention, resolution lifecycle and operational ownership;
6. stage with metrics/alerts/load/backup/restore evidence;
7. obtain explicit human merge/deployment approval.

No destructive rollback is planned. A failed rollout disables routing and uses a
forward migration while preserving already accepted immutable records.
