# Design: Corpus Backfill Manifest

Feature: 017-corpus-backfill-manifest  
Mode: SHIP

## Overview

Feature 017 adds manifest-driven corpus state to support safe repeatable backfills.

Feature 016 can index explicit documents, but it does not record long-lived corpus state. This feature defines the state model and orchestration boundary required to decide whether each document should be indexed, skipped, retried, or treated as stale.

## Proposed Architecture

Recommended new module:

```text
src/ingestion/corpusManifest.ts
```

Recommended responsibilities:

- manifest record types
- manifest store interface
- in-memory manifest store for tests
- content hash helpers
- reindex decision logic
- backfill orchestration boundary

## Proposed Types

```text
CorpusManifestRecord
CorpusManifestStatus
CorpusManifestStore
CorpusBackfillInput
CorpusBackfillDocumentInput
CorpusBackfillResult
CorpusBackfillDecision
```

## Manifest Record Shape

Recommended fields:

```text
documentKey
documentTitle
sourcePath
sourceFormat
documentVersion
contentSha256
chunkCount
embeddingProvider
embeddingModel
embeddingDimension
status
indexedAt
failureCount
failureCodes
```

The manifest must not store API keys, provider endpoints, authorization headers, or database connection strings.

## Reindex Decision

A document should be indexed when no manifest record exists.

A document should be skipped when all material fields match and prior status is indexed.

A document should be reindexed when any of these fields change:

```text
contentSha256
documentVersion
embeddingProvider
embeddingModel
embeddingDimension
```

A document should be retried when prior status is failed.

## Backfill Flow

```text
document inputs
  -> compute content hash
  -> read manifest record by document key
  -> make reindex decision
  -> skip or call vector indexing orchestration
  -> write updated manifest record
  -> return safe backfill summary
```

## Dependency Injection

Backfill orchestration should accept injected dependencies:

```text
manifestStore
indexVectorSource
now
```

This allows tests to avoid hosted provider calls and live database access.

## Store Scope

For SHIP, an in-memory manifest store is sufficient if the boundary is clear.

A file-backed JSON manifest can be implemented in a later feature if needed. Database persistence can also be deferred unless a table already exists and is explicitly approved.

## Safe Reporting

Backfill result should include counts:

```text
documentsConsidered
documentsIndexed
documentsSkipped
documentsFailed
documentsStale
```

It may include per-document safe summaries:

```text
documentKey
status
decision
failureCodes
```

## Future Features

Likely follow-ups after 017:

- 018-file-backed-corpus-manifest
- 019-retrieval-eval-harness
- 020-api-contract-docs
- 021-production-runbook
