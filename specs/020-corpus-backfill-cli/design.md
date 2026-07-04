# Design: Corpus Backfill CLI

Feature: 020-corpus-backfill-cli  
Mode: SHIP

## Design Summary

Feature 020 adds a manifest-aware backfill CLI by composing existing boundaries:

```text
CLI args
  -> parse/validate
  -> read source file
  -> resolve source metadata
  -> JsonFileCorpusManifestStore
  -> backfillCorpusManifest()
  -> indexVectorSource()
  -> safe formatted output
```

The implementation should be thin. The CLI should not reimplement ingestion, indexing, manifest decisions, or vector persistence.

## Proposed Files

```text
src/cli/backfillCorpus.ts
src/__tests__/backfill-corpus-cli.test.ts
```

If the CLI grows too large, extract helper functions into:

```text
src/cli/backfillCorpusCli.ts
```

However, for SHIP scope, a single CLI file with exported pure helpers is acceptable.

## CLI Contract

Recommended command:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1
```

Optional:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1 \
  --title "Document Title" \
  --source-format markdown \
  --dry-run
```

## Argument Parsing

Avoid adding a dependency. Use a small local parser for explicit flags.

Supported flags:

```text
--manifest
--input
--document-key
--document-version
--title
--source-format
--dry-run
--help
```

Unknown flags should fail safely.

## Source Format

Preferred behavior:

- if `--source-format` is provided, validate it against supported source formats
- if omitted, allow existing indexing/extractor behavior to resolve supported source type from path

The CLI should not invent a new source-type system.

## Manifest Metadata

The CLI must supply the metadata needed by `backfillCorpusManifest()`:

```text
embeddingProvider
embeddingModel
embeddingDimension
```

Preferred source:

- existing runtime/provider configuration helpers, if available
- otherwise a thin config resolution helper that reads the same environment variables used by the existing provider factory

The CLI must not print raw environment values.

## Execution Flow

### Normal Mode

1. Parse args.
2. Validate required args.
3. Read input file content.
4. Construct `JsonFileCorpusManifestStore` using `--manifest`.
5. Build a single `CorpusBackfillDocumentInput`.
6. Call `backfillCorpusManifest()`.
7. Inject `indexVectorSource()` as the indexer dependency.
8. Print formatted safe result.
9. Exit 0 if no document failed, else exit non-zero.

### Dry Run Mode

If implemented:

1. Parse args.
2. Validate required args.
3. Read input file content.
4. Load manifest store.
5. Compute content hash.
6. Read existing manifest record.
7. Call `decideCorpusBackfill()`.
8. Print decision.
9. Do not write manifest.
10. Do not call `indexVectorSource()`.

## Output Shape

Human-readable output should be stable and concise:

```text
Corpus backfill result
- considered: 1
- indexed: 1
- skipped: 0
- stale: 0
- failed: 0

Documents
- document-key: status=indexed decision=index failureCodes=[]
```

For failures:

```text
Corpus backfill result
- considered: 1
- indexed: 0
- skipped: 0
- stale: 0
- failed: 1

Documents
- document-key: status=failed decision=index failureCodes=[missing_embedding_provider_config]
```

Do not print stack traces by default.

## Safety

The CLI output must not include:

- API keys
- passwords
- database URLs
- raw env values
- stack traces by default

Use failure codes and sanitized messages.

## Testing Strategy

Use offline tests.

Recommended test targets:

- `parseBackfillCorpusArgs()`
- `validateBackfillCorpusArgs()`
- `formatBackfillCorpusResult()`
- `formatBackfillCorpusError()`
- optional dry-run decision helper

Avoid tests that require:

- real database
- hosted provider
- network
- secrets

## Future Work

Out of SHIP scope:

- directory crawling
- batch backfill from manifest input list
- concurrency
- scheduler
- admin UI
- JSON output mode
- DB-backed corpus manifest
- progress bar
- resumable multi-document backfill
