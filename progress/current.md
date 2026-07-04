# Current Progress

## Active Feature

021-retrieval-eval-harness

## State

review

## Summary

Feature 021 has been implemented in SHIP mode.

The implementation adds an offline retrieval evaluation harness that makes retrieval quality measurable and repeatable without requiring a database, hosted provider, network, secrets, LLM judge, or production corpus.

## Completed Implementation

021 added:

- `src/evals/retrievalEval.ts`
- `src/evals/retrievalEvalCases.ts`
- `src/__tests__/retrieval-eval.test.ts`
- typed retrieval eval case model
- typed retrieval evidence model compatible with current evidence fields
- expected evidence matcher for citation label, source type, document title, and text/excerpt inclusion
- expected `not_found` checks
- retrieval error failure handling
- invalid eval case handling
- stable failure reason codes
- aggregate metrics
- deterministic text report formatting
- minimal synthetic eval cases
- offline tests using injected retrieval fixtures

## Preserved Non-Goals

021 did not introduce:

- LLM judge
- hosted provider calls
- database calls in tests
- new package dependency
- new server route
- UI changes
- production scheduler
- corpus backfill changes
- retrieval ranking changes
- evidence policy changes
- answer generation changes
- auth changes
- CI threshold gate
- large benchmark corpus

## Verification

GitHub file edits were applied directly through the repository API, so local verification is required before marking this feature done.

Required local verification:

- npm run typecheck
- npm run build
- npm run test

## Review Focus

Review should confirm:

- eval case types exist
- eval runner exists
- expected evidence matcher exists
- not_found checks exist
- failure reasons are stable
- metrics are deterministic
- report formatting is stable
- tests run offline
- no database/provider/network/secrets are required
- no retrieval ranking changed
- no evidence policy changed
- no answer generation changed
- no server route was added
- no package file was changed

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

## Next Gate

Run local verification and review the implementation before moving 021 to done.
