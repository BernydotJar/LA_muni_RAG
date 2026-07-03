# Design: File-Backed Corpus Manifest

Feature: 018-file-backed-corpus-manifest  
Mode: SHIP

## Overview

Feature 018 persists the corpus manifest state introduced in Feature 017 to a local JSON file.

This keeps the system operationally useful for repeatable local/operator backfills without introducing database migrations, server routes, UI, or scheduling.

## Proposed Architecture

Recommended module placement:

```text
src/ingestion/corpusManifest.ts
```

Feature 017 already owns the manifest model and store boundary. Feature 018 can extend that module with a file-backed store implementation.

Recommended class:

```text
JsonFileCorpusManifestStore
```

## JSON Shape

Recommended file format:

```json
{
  "schemaVersion": 1,
  "records": [
    {
      "documentKey": "...",
      "documentTitle": "...",
      "sourcePath": "...",
      "sourceFormat": "markdown",
      "documentVersion": "v1",
      "contentSha256": "...",
      "chunkCount": 3,
      "embeddingProvider": "http",
      "embeddingModel": "text-embedding-model",
      "embeddingDimension": 768,
      "status": "indexed",
      "indexedAt": "2026-01-01T00:00:00.000Z",
      "failureCount": 0,
      "failureCodes": []
    }
  ]
}
```

## Store Behavior

### Missing File

Missing file should behave as:

```json
{
  "schemaVersion": 1,
  "records": []
}
```

### Reads

`get(documentKey)` should read from disk and return the matching record or null.

`list()` should return all records sorted by `documentKey` ascending.

### Writes

`put(record)` should:

1. read the current file state
2. replace or insert the record by `documentKey`
3. sort records by `documentKey`
4. write JSON to a temp file
5. rename temp file to the final manifest path

## Validation

The store should validate at least:

- top-level object exists
- schemaVersion is 1
- records is an array
- each record has a string documentKey

Full deep schema validation can be deferred.

## Error Handling

Use a stable error class or stable error message for invalid manifest files.

Recommended error code:

```text
corpus_manifest_file_invalid
```

Error output must not include secrets or environment values.

## Tests

Offline tests should use temporary directories under the OS temp directory.

Required test cases:

- missing file returns empty list and null get
- existing file record can be read
- put persists a record across new store instances
- put replaces an existing document key
- list returns deterministic order
- invalid JSON fails clearly
- invalid schemaVersion or records shape fails clearly

## Scope Control

Do not add:

- package scripts
- CLI changes
- database persistence
- server routes
- UI
- production scheduler
- answer policy changes
- vector ranking changes

## Future Features

Likely follow-ups after 018:

- 019-corpus-backfill-cli
- 020-retrieval-eval-harness
- 021-api-contract-docs
- 022-production-runbook
