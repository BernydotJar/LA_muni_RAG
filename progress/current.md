# Current Progress

## Active Feature

020-corpus-backfill-cli

## State

spec_ready

## Summary

Feature 020 has been opened in SHIP mode as a specification-only change.

The goal is to add an operator-facing corpus backfill CLI that composes existing foundations:

- `JsonFileCorpusManifestStore`
- `backfillCorpusManifest()`
- `indexVectorSource()`

This will turn the manifest-aware indexing flow into a repeatable local command for explicit source documents.

## Product Direction

The CLI should support a command shape like:

```bash
node --import tsx src/cli/backfillCorpus.ts \
  --manifest .rag/corpus-manifest.json \
  --input corpus/document.md \
  --document-key document-key \
  --document-version v1
```

Optional support may include:

```text
--title
--source-format
--dry-run
```

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

## Current Feature Scope

020 must define and then implement, after approval:

- `src/cli/backfillCorpus.ts`
- required argument parsing
- missing/unknown argument validation
- manifest file path support
- single-document backfill from explicit input path
- persistent manifest integration
- safe result formatting
- offline tests for CLI helpers

## Non-Goals

020 must not introduce:

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
- directory crawling unless separately approved
- parallel backfills

## Next Gate

Human approval is required before implementation.

Approval phrase:

`Approved: 020-corpus-backfill-cli for implementation in SHIP mode.`
