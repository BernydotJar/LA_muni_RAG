# Current Progress

## Active Feature

020-corpus-backfill-cli

## State

review

## Summary

Feature 020 has been implemented in SHIP mode.

The implementation adds an operator-facing corpus backfill CLI that composes existing foundations:

- `JsonFileCorpusManifestStore`
- `backfillCorpusManifest()`
- `indexVectorSource()`

This turns the manifest-aware indexing flow into a repeatable local command for explicit source documents.

## Completed Implementation

020 added:

- `src/cli/backfillCorpus.ts`
- `src/__tests__/backfill-corpus-cli.test.ts`
- required argument parsing for `--manifest`, `--input`, `--document-key`, and `--document-version`
- optional support for `--title`, `--source-format`, and `--dry-run`
- unknown argument validation
- missing argument validation
- runtime embedding metadata resolution from existing query embedding config
- persistent manifest integration through `JsonFileCorpusManifestStore`
- normal-mode execution through `backfillCorpusManifest()` and `indexVectorSource()`
- dry-run decision flow through `computeCorpusContentSha256()` and `decideCorpusBackfill()`
- stable human-readable output formatting
- CLI error formatting with redaction for database URLs, HTTP URLs, bearer tokens, and obvious key/value secrets
- offline tests for parsing, validation, formatting, redaction, dry-run behavior, and no manifest write on invalid args

## Preserved Non-Goals

020 did not introduce:

- production scheduler
- admin UI
- new server routes
- package changes
- migrations
- LLM answer generation changes
- LLM reranking
- retrieval ranking changes
- evidence policy changes
- auth changes
- remote document fetching
- directory crawling
- parallel backfills

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

Manual CLI smoke tests recommended:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1 \
  --dry-run
```

Normal mode should only be used when provider and vector store config are available:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1
```

## Review Focus

Review should confirm:

- CLI entry point exists
- required args are supported
- missing and unknown args fail safely
- dry-run does not write manifest or vectors
- normal mode uses existing backfill/indexing orchestration
- safe output does not leak secrets
- no server route was added
- no package file was changed
- no retrieval/answer/evidence policy was changed
- test suite remains green

## Next Gate

Run local verification and review the implementation before moving 020 to done.
