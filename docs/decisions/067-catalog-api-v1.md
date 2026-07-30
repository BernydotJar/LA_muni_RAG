# ADR 067 — Governed tenant catalog API

Status: accepted for Feature 067 implementation

## Context

The repository had governed storage and selected item APIs, but no production-
equivalent source/document collections, no safe ingestion-job collection and no
procedure catalog. File manifests and underlying tables are not an authenticated
SaaS API.

## Decision

Use the existing LA Muni RAG ownership model:

- add `rag.sources` for tenant source-discovery records;
- bind `rag.documents` to a tenant source and registering principal;
- reuse `rag.document_versions`, `rag.artifact_objects`,
  `rag.ingestion_jobs`, `rag.embedding_vectors`, `rag.procedures` and
  `rag.procedure_versions`;
- expose six collection operations through one security-consistent handler;
- keep source validation, artifact acceptance, ingestion, workflow approval and
  retrieval quality as separate server-owned lifecycles.

Registration never promotes authority or operational completion. Runtime grants
are column-specific where existing tables contain object coordinates, scanner
state, pipeline internals or workflow definitions.

## Pagination

Use bounded keyset pagination instead of offset pagination. The cursor encodes
only tenant-visible `created_at` and UUID identity. It is opaque, validated and
bounded; it is not a capability token.

## Replay

Store digest-only request/key identity and exact response bytes. Before replay,
verify SHA-256, schema and identity, then reconstruct the original creation
response from the request, persisted aggregate identity and server-owned initial
state. Corrupt replay cleanup commits before error emission.

## URL boundary

Only public discovery URLs may be stored. Reject embedded userinfo and common
temporary credential/signature parameters at HTTP and PostgreSQL boundaries.
Object-store coordinates and signed URLs remain owned by the artifact adapter.

## Rejected alternatives

- exposing `.rag/source-inventory.json` directly;
- accepting caller-selected `official_source`, validity or ingestion fields;
- creating duplicate document/job/procedure stores;
- returning `SELECT *` from artifact, job or workflow tables;
- offset pagination with cross-tenant totals;
- trusting schema-valid replay bytes without semantic reconstruction;
- implementing search inside the catalog slice without retrieval-quality gates.

## Consequences

The minimum catalog foundation becomes callable and tenant-safe. It does not
complete corpus acquisition, real retrieval validation, human authentication,
production infrastructure or deployment. Search and dedicated EvidenceBundle
routes remain the next retrieval slice.
