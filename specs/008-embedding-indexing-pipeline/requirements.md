# 008 Embedding Indexing Pipeline Requirements

Status: Implemented

## Objective

Specify a production-oriented embedding indexing pipeline for normalized
municipal/legal document sections.

The pipeline should prepare the system to index `NormalizedDocument` and
`NormalizedSection` outputs into PostgreSQL/pgvector without changing current
retrieval, evidence, answer, chat, or ingestion behavior during this spec
phase.

## Goals

- Define how normalized sections become embedding-ready records.
- Define deterministic chunk identity and idempotency requirements.
- Define embedding job states and retry semantics.
- Define how citations and provenance survive indexing.
- Define validation gates before any vector search is used by the API.
- Preserve keyword and phrase retrieval as the current operational truth until
  vector retrieval is explicitly implemented and validated.

## Acceptance Criteria

- Documents the proposed indexing flow from normalized sections to vector rows.
- Defines required metadata for every indexed chunk.
- Defines provider-agnostic embedding interfaces.
- Defines read/write boundaries and idempotency behavior.
- Defines failure handling for partial indexing.
- Defines verification commands and expected tests for implementation phase.
- Leaves runtime code unchanged in this spec phase.

## Non-Goals

- No implementation in `src/embeddings`.
- No external API calls.
- No migrations.
- No package dependencies.
- No changes to search/evidence/answer/chat behavior.
- No env or secret changes.
- No vector retrieval endpoint yet.
