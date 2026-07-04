# Current Progress

## Active Feature

None.

## Last Completed Feature

020-corpus-backfill-cli

## State

done

## Summary

Feature 020 has been completed in SHIP mode.

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

Local verification passed:

- npm run typecheck
- npm run build
- npm run test

Full suite result after 020:

- tests: 160
- suites: 32
- pass: 160
- fail: 0
- cancelled: 0
- skipped: 0
- todo: 0
- duration_ms: 860.864166

## Completed Features

- 007-docx-extractor-mammoth: done
- 008-embedding-indexing-pipeline: done
- 009-hybrid-retrieval-ranking: done
- 010-hybrid-retrieval-integration: done
- 011-production-vector-store: done
- 012-vector-query-integration: done
- 013-production-query-embedding-provider: done
- 014-runtime-vector-wiring: done
- 015-runtime-vector-observability: done
- 016-ingestion-cli-vector-indexing: done
- 017-corpus-backfill-manifest: done
- 018-file-backed-corpus-manifest: done
- 019-rag-glass-wall-easter-egg: done
- 020-corpus-backfill-cli: done

## Next Recommended Feature

021-retrieval-eval-harness

Status: not started
