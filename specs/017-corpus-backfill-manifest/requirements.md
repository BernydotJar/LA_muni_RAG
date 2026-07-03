# Requirements: Corpus Backfill Manifest

Feature: 017-corpus-backfill-manifest  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 016 added a CLI-ready vector indexing path for explicit source files.

The next operational gap is corpus state.

The system needs a deterministic way to know which documents have already been indexed, with which version, source hash, embedding provider, embedding model, embedding dimension, chunk count, status, and timestamp.

Without a manifest, operators cannot safely distinguish:

- already indexed documents
- changed documents requiring reindexing
- failed documents requiring retry
- documents indexed with an older embedding model or dimension
- documents that are missing from the vector store

## Goal

Define a manifest-driven corpus backfill model that tracks indexing state per document and supports safe reindex decisions.

This feature should prepare the system for repeatable corpus backfills without introducing a full scheduler or corpus management UI.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions changes.
5. New source extractors.
6. New migrations unless separately approved.
7. Package changes unless separately approved.
8. Secrets or env files.
9. Hosted provider calls in tests.
10. Full production scheduler.
11. Full corpus management UI.
12. Legal answer policy changes.
13. Vector ranking changes.

## Functional Requirements

### FR-1: Manifest Record Model

The implementation must define a stable manifest record model for indexed corpus documents.

Each record should include at least:

- document key
- document title
- source path
- source format
- document version
- content hash
- chunk count
- embedding provider
- embedding model
- embedding dimension
- status
- indexed timestamp
- failure count or failure summary when applicable

### FR-2: Status Values

The manifest must support operational statuses such as:

- indexed
- skipped
- stale
- failed

The exact status vocabulary may be narrowed during implementation, but it must support distinguishing completed indexing from skipped/unchanged and failed cases.

### FR-3: Reindex Decision

The implementation must provide deterministic logic to decide whether a document should be indexed or skipped.

A document should be reindexed when material inputs change, such as:

- content hash changed
- document version changed
- embedding provider changed
- embedding model changed
- embedding dimension changed
- previous status was failed

### FR-4: Manifest Store Boundary

The implementation must define a manifest store boundary.

For SHIP scope, an in-memory or file-based manifest store is acceptable if it is dependency-injectable and covered by tests.

Production database persistence may be deferred unless already supported by existing tables.

### FR-5: Backfill Orchestration Boundary

The implementation must define a dependency-injectable backfill orchestration boundary.

It should accept explicit document inputs and use the vector indexing result from Feature 016 to update manifest state.

### FR-6: Safe Reporting

The backfill result must report safe counts such as:

- documents considered
- documents indexed
- documents skipped
- documents failed
- documents stale/reindexed

The result must not include secrets, raw provider endpoints, database URLs, authorization headers, or API keys.

### FR-7: Offline Tests

Tests must run offline without hosted provider calls or a live database.

Tests should inject fake indexing functions and fake manifest stores.

## Quality Requirements

### QR-1: Determinism

Reindex decisions must be deterministic for identical inputs and manifest state.

### QR-2: Backward Compatibility

Existing server routes, vector indexing CLI behavior, retrieval behavior, and answer policy must remain unchanged.

### QR-3: Security

No secret values may be persisted into the manifest or printed in backfill output.

### QR-4: Minimal Scope

Prefer a narrow manifest and reindex-decision feature over a broad corpus platform.

## Acceptance Criteria

The feature can move to review when:

1. A manifest record model exists.
2. A manifest store boundary exists.
3. Reindex decision logic exists.
4. Backfill orchestration can process explicit document inputs.
5. Manifest records are written after successful indexing.
6. Changed content/version/model/dimension results in reindex decision.
7. Unchanged documents can be skipped.
8. Failed indexing updates manifest state safely.
9. Offline tests cover indexed, skipped, stale/reindex, and failed paths.
10. No hosted provider calls occur in tests.
11. `npm run typecheck` passes.
12. `npm run build` passes.
13. `npm run test` passes.
