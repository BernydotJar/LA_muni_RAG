# Design: Ingestion CLI Vector Indexing

Feature: 016-ingestion-cli-vector-indexing  
Mode: SHIP

## Overview

Feature 016 adds the missing operational path between source documents and the pgvector-backed hybrid retrieval path.

The project already contains most primitives needed for indexing:

- source extraction and normalization
- deterministic embedding chunk planning
- embedding provider boundary
- HTTP embedding provider factory
- pgvector repository adapter
- runtime vector observability

This feature should compose those primitives behind a CLI-ready indexing command.

## Proposed Architecture

Recommended new boundary:

```text
src/ingestion/vectorIndexing.ts
```

Recommended CLI entry:

```text
src/cli/indexVector.ts
```

The orchestration boundary should be dependency-injectable for offline tests.

## Proposed Flow

```text
input path
  -> detect source format
  -> extract NormalizedDocument
  -> plan embedding chunks
  -> embed chunk texts
  -> map chunks + vectors to EmbeddingVectorRecord
  -> upsert records with PgVectorEmbeddingRepository
  -> return safe indexing summary
```

## Recommended Types

```text
VectorIndexingInput
VectorIndexingResult
VectorIndexingDependencySet
VectorIndexingReporter
```

Recommended result fields:

```text
documentTitle
sourcePath
sourceFormat
chunksPlanned
recordsWritten
recordsSkipped
failures
status
```

`sourcePath` may be printed as an operator-supplied local path, but no environment values or secrets should be printed.

## CLI Behavior

Recommended minimal command:

```bash
node --import tsx src/cli/indexVector.ts --input path/to/file.md
```

If package scripts are modified in this feature, the command may become:

```bash
npm run index:vector -- --input path/to/file.md
```

Package changes are optional and should be avoided unless the implementation remains narrow.

## Dependency Construction

Production CLI should construct:

- extractor registry from existing ingestion code
- embedding provider from existing embedding config factory
- pgvector repository from existing repository adapter

If configuration is missing, the command should fail with a stable, human-readable error.

## Offline Tests

Tests should avoid live database and hosted providers by injecting:

- normalized document fixture or fake extraction path
- fake embedding provider
- in-memory or fake vector repository
- captured reporter output

## Error Handling

The orchestration should classify failures where practical:

```text
missing_input
unsupported_source_format
extraction_failed
missing_embedding_provider_config
embedding_failed
vector_write_failed
```

Existing domain errors should be preserved when available.

## Secret Handling

CLI output and returned result must not include:

```text
QUERY_EMBEDDING_API_KEY
DATABASE_URL
Authorization
Bearer tokens
raw provider endpoint if it may include sensitive tenant data
connection strings
```

## Scope Control

This feature should not implement a full corpus manager.

It should be enough to index one file or a small explicit list while preserving a clean orchestration boundary for later backfill/bulk features.

## Future Features

After 016, likely follow-ups:

- 017-corpus-backfill-manifest
- 018-retrieval-eval-harness
- 019-api-contract-docs
- 020-production-runbook
