# Requirements: Corpus Backfill CLI

Feature: 020-corpus-backfill-cli  
Mode: SHIP  
Status: spec_ready

## Product Intent

Create an operator-facing CLI for corpus backfills that connects the existing manifest and vector indexing foundations into a repeatable command.

The system already has:

- `indexVectorSource()` for source document vector indexing
- `backfillCorpusManifest()` for deterministic index / skip / reindex / retry decisions
- `JsonFileCorpusManifestStore` for persistent manifest state across runs

Feature 020 should make those capabilities usable from the command line without introducing a scheduler, admin UI, server route, package change, or new runtime answer behavior.

## Problem

Operators can index individual documents through the existing vector indexing path and the system can track manifest state, but there is no single CLI that performs a manifest-aware backfill operation.

Without this CLI, backfill behavior is still too manual:

- the operator must know lower-level implementation details
- manifest state is not naturally wired into indexing execution
- skip/reindex/retry behavior is not exposed as a simple command
- repeated local runs are harder to audit

## Goal

Add a CLI entry point that can backfill one explicit document using the existing persistent manifest store and indexing orchestration.

Recommended command shape:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1
```

## Functional Requirements

### FR-1: CLI Entrypoint

Add a direct CLI entry point:

```text
src/cli/backfillCorpus.ts
```

### FR-2: Required Arguments

The CLI must accept:

```text
--manifest <path>
--input <path>
--document-key <key>
--document-version <version>
```

### FR-3: Optional Arguments

The CLI may accept:

```text
--title <title>
--source-format <format>
--dry-run
```

If `--source-format` is omitted, the implementation should infer format through existing ingestion/source detection behavior if available, or use the same supported-source behavior as `indexVectorSource()`.

### FR-4: Manifest Store Integration

The CLI must use:

```text
JsonFileCorpusManifestStore
```

The manifest must persist across CLI runs.

### FR-5: Backfill Orchestration

The CLI must call:

```text
backfillCorpusManifest()
```

It must pass a document input containing:

- input path
- title if provided
- document key
- document version
- source format if provided/inferred
- file content
- embedding provider metadata
- embedding model metadata
- embedding dimension metadata

### FR-6: Indexing Integration

For non-dry-run mode, the backfill must use existing indexing orchestration:

```text
indexVectorSource()
```

The feature must not duplicate vector indexing logic.

### FR-7: Dry Run

If `--dry-run` is implemented, it must:

- compute the document content hash
- inspect the existing manifest record
- determine whether the document would index, skip, reindex, or retry
- avoid vector writes
- avoid manifest writes

Dry run is useful but not required if it makes the SHIP implementation too broad. If omitted, document as future work.

### FR-8: Safe Output

The CLI output must include:

- documents considered
- documents indexed
- documents skipped
- documents stale/reindexed
- documents failed
- per-document decision
- per-document status
- failure codes if any

The CLI output must not leak:

- provider API keys
- database URLs
- raw env values
- stack traces by default
- secrets

### FR-9: Failure Behavior

Missing required arguments must produce:

- non-zero exit code
- stable error message
- no manifest write
- no vector write

Missing file must produce:

- non-zero exit code
- stable error message
- no manifest write
- no vector write

Runtime provider or vector store failures must be reported through the existing indexing/backfill result model.

### FR-10: Tests

Add offline tests for CLI helpers or extracted pure functions. Tests must not require:

- hosted embedding provider
- live database
- external network
- secrets

At minimum, test:

- argument parsing
- required argument validation
- dry-run decision if implemented
- safe output formatting
- no secret leakage in formatted output

## Non-Goals

This feature must not add:

1. Production scheduler.
2. Admin UI.
3. New server route.
4. New package dependency.
5. New migration.
6. LLM answer generation change.
7. LLM reranking.
8. Retrieval ranking change.
9. Evidence policy change.
10. Auth change.
11. Corpus management dashboard.
12. Bulk directory crawling unless separately approved.
13. Parallel backfills.
14. Remote document fetching.

## Acceptance Criteria

The feature can move to review when:

1. `src/cli/backfillCorpus.ts` exists.
2. The CLI accepts required arguments.
3. The CLI uses `JsonFileCorpusManifestStore`.
4. The CLI uses `backfillCorpusManifest()`.
5. Non-dry-run mode uses `indexVectorSource()` rather than duplicating indexing.
6. Missing required args fail safely.
7. Missing input file fails safely.
8. CLI output is stable and safe.
9. Offline tests cover parsing/validation/output behavior.
10. `npm run typecheck` passes.
11. `npm run build` passes.
12. `npm run test` passes.
13. Harness state is updated.
