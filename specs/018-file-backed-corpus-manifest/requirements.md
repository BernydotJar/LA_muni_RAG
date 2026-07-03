# Requirements: File-Backed Corpus Manifest

Feature: 018-file-backed-corpus-manifest  
Mode: SHIP  
Status: spec_ready

## Problem

Feature 017 added a corpus manifest model, in-memory store, reindex decisions, and explicit-document backfill orchestration.

That is enough for deterministic tests and internal boundaries, but not enough for real local backfill operations because manifest state disappears between process executions.

The next operational step is a JSON file-backed manifest store that persists corpus state without introducing database migrations, a scheduler, UI, or production corpus platform scope.

## Goal

Implement a JSON file-backed `CorpusManifestStore` so backfill state can persist across local/operator runs.

The store should read and write `CorpusManifestRecord` values using the existing manifest boundary from Feature 017.

## Non-Goals

This feature does not implement:

1. LLM answer generation.
2. LLM reranking.
3. UI changes.
4. Auth or permissions changes.
5. New source extractors.
6. Database migrations.
7. Package changes unless separately approved.
8. Secrets or env files.
9. Hosted provider calls in tests.
10. Full production scheduler.
11. Full corpus management UI.
12. Legal answer policy changes.
13. Vector ranking changes.
14. A remote manifest service.

## Functional Requirements

### FR-1: File-Backed Store

The implementation must provide a file-backed implementation of `CorpusManifestStore`.

Recommended name:

```text
JsonFileCorpusManifestStore
```

### FR-2: Stable JSON Format

The manifest file must have a stable JSON shape.

Recommended top-level shape:

```json
{
  "schemaVersion": 1,
  "records": []
}
```

### FR-3: Missing File Behavior

If the manifest file does not exist, the store should behave as an empty manifest.

### FR-4: Read Existing Records

The store must read existing records by document key.

### FR-5: Write Records

The store must persist `put()` writes so records survive store re-instantiation.

### FR-6: List Records

The store must list all records in deterministic order.

Recommended order: `documentKey` ascending.

### FR-7: Invalid JSON Handling

The store must fail clearly on malformed JSON or incompatible manifest shape.

Error messages must not include secrets or environment values.

### FR-8: Atomic-ish Write

The store should avoid partial writes where practical.

A simple write-to-temp-then-rename approach is sufficient for SHIP scope.

### FR-9: Offline Tests

Tests must run offline using temporary directories and must not call hosted providers or a live database.

## Quality Requirements

### QR-1: Backward Compatibility

Existing server routes, vector indexing, backfill orchestration, retrieval behavior, and answer policy must remain unchanged.

### QR-2: Determinism

The persisted manifest file must be deterministic for identical records.

### QR-3: Security

The manifest store must not persist secrets. It should only persist the fields already present in `CorpusManifestRecord`.

### QR-4: Minimal Scope

Prefer a narrow JSON-backed store over a broader corpus management platform.

## Acceptance Criteria

The feature can move to review when:

1. A JSON file-backed `CorpusManifestStore` exists.
2. Missing manifest files behave as empty stores.
3. Existing records can be read from disk.
4. `put()` writes persist to disk.
5. `list()` returns deterministic order.
6. Invalid JSON or invalid manifest shape fails clearly.
7. Writes use a temp-file-and-rename pattern or equivalent simple safety mechanism.
8. Offline tests cover missing file, read, write, list order, invalid JSON, and invalid shape.
9. Existing in-memory manifest behavior remains unchanged.
10. Existing server/vector indexing behavior remains unchanged.
11. `npm run typecheck` passes.
12. `npm run build` passes.
13. `npm run test` passes.
