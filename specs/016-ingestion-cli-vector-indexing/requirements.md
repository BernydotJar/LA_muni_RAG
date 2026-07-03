# Requirements: Ingestion CLI Vector Indexing

Feature: 016-ingestion-cli-vector-indexing  
Mode: SHIP  
Status: spec_ready

## Problem

The project now has normalized ingestion, deterministic chunk planning, an embedding boundary, an HTTP embedding provider, a pgvector repository, hybrid retrieval, runtime vector wiring, and vector observability.

The missing operational link is a CLI path that can take supported source documents, normalize them, plan embedding chunks, generate embeddings through the configured provider, and persist vectors into pgvector.

Without this feature, the vector runtime path exists but operators still lack a repeatable command to populate the vector index.

## Goal

Define an operational CLI for vector indexing.

The command should ingest one document or a small set of documents, generate deterministic chunks, call the configured embedding provider, persist vector records into pgvector, and report a safe indexing summary.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions changes.
5. New source extractors.
6. New migrations.
7. Package changes unless separately approved.
8. Secrets or env files.
9. Hosted provider calls in tests.
10. Bulk production scheduling.
11. Full corpus management UI.
12. Legal answer policy changes.

## Functional Requirements

### FR-1: CLI Entry Point

The implementation must provide a CLI entry point for indexing source documents into pgvector.

The CLI should support at least a single input path.

Recommended shape:

```bash
npm run index:vector -- --input path/to/document.md
```

or direct tsx invocation if package scripts are not updated in this feature.

### FR-2: Source Normalization

The CLI must use the existing ingestion registry or extractor boundaries.

It must preserve existing supported formats and avoid adding new parser dependencies.

### FR-3: Chunk Planning

The CLI must use the existing deterministic embedding chunk planner and identity rules.

### FR-4: Embedding Generation

The CLI must use the existing embedding provider boundary and configured provider factory.

The production path may call the hosted provider when explicitly executed by an operator with env configured.

Tests must not call hosted providers.

### FR-5: Vector Persistence

The CLI must persist vector records using the existing pgvector repository boundary.

It must not bypass validation or write malformed vector records.

### FR-6: Safe Reporting

The CLI must print a safe summary including counts such as:

- documents processed
- chunks planned
- chunks indexed
- unchanged or skipped records if available
- failures

The output must not print API keys, database URLs, authorization headers, or raw provider endpoints.

### FR-7: Failure Handling

The CLI must fail clearly when required configuration is missing.

Examples:

- missing database config
- missing embedding provider config
- unsupported source format
- extractor failure
- embedding provider failure
- vector dimension mismatch

### FR-8: Offline Testability

The indexing orchestration must be testable without external provider calls or a live database.

Use dependency injection around:

- file reading if needed
- extractor/normalized document input
- embedding provider
- vector repository
- stdout/stderr reporting

## Quality Requirements

### QR-1: Backward Compatibility

Existing server routes, runtime vector wiring, search behavior, evidence behavior, and answer policy must remain unchanged.

### QR-2: Determinism

Chunk identity and write behavior must remain deterministic for unchanged source content.

### QR-3: Security

No secrets may be printed in CLI output or committed to the repo.

### QR-4: Operational Clarity

CLI output should be useful enough for an operator to determine whether indexing succeeded, partially failed, or failed before writes.

### QR-5: Minimal Scope

Prefer a narrow SHIP feature over a broad ingestion platform.

## Acceptance Criteria

The feature can move to review when:

1. A vector indexing CLI or CLI-ready entry point exists.
2. It uses existing ingestion/extractor boundaries.
3. It uses existing chunk planning.
4. It uses existing embedding provider boundary.
5. It uses existing pgvector repository boundary.
6. It has offline tests for successful indexing.
7. It has offline tests for missing configuration or provider failure.
8. It has tests or assertions for safe output/no secret leakage.
9. Existing server behavior remains unchanged.
10. `npm run typecheck` passes.
11. `npm run build` passes.
12. `npm run test` passes.
