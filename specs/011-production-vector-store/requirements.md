# Requirements: Production Vector Store

Feature: 011-production-vector-store  
Mode: SHIP  
Status: spec_ready

## Problem

Features 008, 009, and 010 established the embedding pipeline, hybrid ranking layer, and hybrid evidence integration. However, vector retrieval is still boundary-based and test-safe. The system does not yet define a production persistence and retrieval strategy for embedding vectors.

Without a production vector store, hybrid retrieval can combine phrase and keyword candidates, but cannot retrieve persisted semantic candidates from indexed document chunks.

## Goal

Define a production vector storage and retrieval design for persisted embedding chunks behind the existing retrieval boundary.

The design must support:

- persisted embedding chunk records
- deterministic chunk identity
- vector similarity search
- citation/provenance preservation
- test-safe repository boundaries
- no answer-policy drift

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions.
5. New ingestion formats.
6. New embedding provider calls in tests.
7. A production embedding vendor decision unless separately approved.
8. Legal interpretation or answer expansion.
9. Unreviewed schema changes.

## Functional Requirements

### FR-1: Vector Store Schema Design

The feature must define the table or storage model required to persist embedding vectors and chunk metadata.

The model must preserve:

- chunk id
- content hash
- chunk text
- embedding vector
- embedding model
- embedding provider
- embedding dimension
- document key/version
- citation label
- page/article coordinates when available
- metadata/provenance

### FR-2: Repository Boundary

The production vector store must sit behind an explicit repository interface.

Runtime code must not depend directly on database query details outside the repository layer.

### FR-3: Similarity Search

The design must support vector similarity search by query embedding.

Search results must be mappable to the existing `VectorCandidateInput` or `HybridCandidate` shape.

### FR-4: Idempotent Upsert

Indexing must remain idempotent.

Repeated indexing of unchanged chunks must not create duplicate vector records.

### FR-5: Citation Integrity

Vector search must never return uncitable evidence.

Records without citation labels must be excluded or rejected at write/search boundary.

### FR-6: Dimension Safety

Vector search must validate embedding dimensions before query execution.

Wrong-dimension vectors must fail predictably.

### FR-7: Test Safety

Tests must remain deterministic and offline.

Production database behavior may be covered by unit tests around SQL generation/repository mapping or integration tests guarded by environment variables.

## Quality Requirements

### QR-1: No External Calls In Tests

No test may call an external embedding provider or hosted vector service.

### QR-2: Evidence-First Preservation

No evidence still means no answer.

### QR-3: Reviewable Migration

If a migration is proposed, it must be small, explicit, and reversible where possible.

### QR-4: Backward Compatibility

Existing keyword, phrase, hybrid, answer, chat, and server behavior must continue passing.

## Acceptance Criteria

The feature can move to review when:

1. A production vector store schema or migration is defined.
2. A repository implementation or approved adapter is added.
3. Vector search results map to the existing hybrid retrieval boundary.
4. Citation/provenance is preserved.
5. Dimension mismatch behavior is predictable.
6. Idempotent writes are preserved.
7. Tests are deterministic and offline.
8. No LLM calls are introduced.
9. No external API calls are required in tests.
10. `npm run typecheck` passes.
11. `npm run build` passes.
12. `npm run test` passes.
