# Progress History

## 018-file-backed-corpus-manifest

State: spec_ready  
Mode: SHIP

Opened Feature 018 as a specification-only SHIP feature.

The feature will define a JSON file-backed corpus manifest store for persistent backfill state across local/operator runs without adding migrations, scheduler, UI, package changes, or runtime answer changes.

No runtime code was changed in this step.

## 017-corpus-backfill-manifest

State: done  
Mode: SHIP

Implemented a manifest-driven corpus backfill state model to track indexed documents, content hashes, document versions, embedding metadata, chunk counts, timestamps, statuses, and deterministic reindex decisions.

Completed:

- Added `CorpusManifestRecord`.
- Added `CorpusManifestStatus`.
- Added `CorpusManifestStore`.
- Added `InMemoryCorpusManifestStore`.
- Added `CorpusBackfillDocumentInput`.
- Added `CorpusBackfillResult`.
- Added `CorpusBackfillDecision`.
- Added `computeCorpusContentSha256()`.
- Added `decideCorpusBackfill()`.
- Added `backfillCorpusManifest()`.
- Added offline tests for first-time indexing.
- Added offline tests for unchanged skip.
- Added offline tests for stale/reindex due to content hash.
- Added offline tests for stale/reindex due to embedding metadata.
- Added offline tests for retry after failed prior record.
- Added offline tests for failed indexing manifest update.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No new source extractors.
- No env or secret files.
- No migrations.
- No package changes.
- No production scheduler.
- No full corpus management UI.
- No evidence policy changes.
- No vector ranking changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 017: 135 passing, 0 failing.

## 016-ingestion-cli-vector-indexing

State: done  
Mode: SHIP

Implemented an operational CLI-ready path to ingest supported source documents, plan deterministic chunks, generate embeddings through the configured provider, and persist vectors into pgvector with safe reporting.

Completed:

- Added `indexVectorSource()` orchestration boundary.
- Added `VectorIndexingInput`.
- Added `VectorIndexingResult`.
- Added `VectorIndexingDependencies`.
- Added `queryProviderToEmbeddingProvider()` adapter.
- Added safe failure redaction for formatted output.
- Added direct CLI entry point at `src/cli/indexVector.ts`.
- Added offline success test for vector indexing.
- Added offline tests for missing input, missing provider config, missing vector store config, provider failure, write failure, and no secret leakage.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No new source extractors.
- No env or secret files.
- No migrations.
- No package changes.
- No bulk production scheduling.
- No full corpus management UI.
- No evidence policy changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 016: 125 passing, 0 failing.

## 015-runtime-vector-observability

State: done  
Mode: SHIP

Implemented safe runtime vector observability for enabled, disabled, and degraded states without exposing secrets or changing answer policy.

Completed:

- Added `RuntimeVectorStatus`.
- Added `RuntimeVectorState`.
- Added safe runtime vector reason codes.
- Added `createRuntimeEvidenceDependencyContext()`.
- Preserved backward-compatible `createRuntimeEvidenceDependencies()`.
- Added sanitized `/health.vectorRuntime` status.
- Added offline tests for disabled, degraded, and enabled states.
- Added offline tests for secret leakage prevention.
- Added server integration test for health status shape.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No unrelated ingestion changes.
- No env or secret files.
- No hosted provider health checks.
- No external provider calls in tests.
- No migrations.
- No package changes.
- No evidence policy changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 015: 118 passing, 0 failing.

## 014-runtime-vector-wiring

State: done  
Mode: SHIP

Implemented runtime composition for the query embedding provider, pgvector repository, and hybrid evidence dependencies with safe fallback.

Completed:

- Added `createRuntimeEvidenceDependencies()`.
- Added safe query embedding provider construction at runtime.
- Added safe pgvector repository construction at runtime.
- Wired server hybrid retrieval through `findEvidenceWithDependencies()`.
- Added dependency-aware agent evaluation.
- Added dependency-aware deterministic answer generation.
- Added dependency-aware chat processing.
- Added offline tests for runtime dependency construction.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No unrelated ingestion changes.
- No env or secret files.
- No external provider calls in tests.
- No migrations.
- No package changes.
- No evidence policy changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 014: 114 passing, 0 failing.

## 013-production-query-embedding-provider

State: done  
Mode: SHIP

Implemented a production query embedding provider behind the existing `QueryEmbeddingProvider` boundary.

Completed:

- Added `HttpQueryEmbeddingProvider`.
- Added fetch-compatible transport boundary.
- Added provider response mapping.
- Added stable provider error mapping.
- Added query embedding dimension validation through the existing boundary.
- Added `loadQueryEmbeddingProviderConfig()`.
- Added `createQueryEmbeddingProvider()`.
- Added configuration-safe provider construction.
- Added offline tests for provider behavior.
- Added offline tests for factory behavior.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No unrelated ingestion changes.
- No env or secret files.
- No external API calls in tests.
- No migrations.
- No package changes.
- No evidence policy changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 013: 111 passing, 0 failing.

## 012-vector-query-integration

State: done  
Mode: SHIP

Implemented query-time vector integration for hybrid evidence.

Completed:

- Added `QueryEmbeddingProvider` boundary.
- Added query embedding dimension validation.
- Added `findEvidenceWithDependencies()` for explicit dependency injection.
- Added optional vector candidate retrieval in hybrid mode.
- Added optional keyword and phrase search injection for offline tests.
- Added safe fallback when vector dependencies are missing.
- Added safe fallback when query embedding fails.
- Added offline tests for query embedding boundary.
- Added offline tests for hybrid vector integration.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No unrelated ingestion changes.
- No env or secret changes.
- No external API calls in tests.
- No migrations.
- No package changes.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 012: 102 passing, 0 failing.

## 011-production-vector-store

State: done  
Mode: SHIP

Implemented production vector storage and retrieval foundations for persisted embedding chunks behind the existing retrieval boundary.

Completed:

- Added production pgvector migration for `rag.embedding_vectors`.
- Added `PgVectorEmbeddingRepository`.
- Added mapping from `EmbeddingVectorRecord` to pgvector upsert values.
- Added mapping from pgvector result rows to `VectorCandidateInput`.
- Added vector literal formatting.
- Added vector dimension validation.
- Added citation-label rejection at write/search mapping boundaries.
- Added offline unit tests for mapping and validation.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No unrelated ingestion changes.
- No env or secret changes.
- No external API calls in tests.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 011: 94 passing, 0 failing.

## 010-hybrid-retrieval-integration

State: done  
Mode: SHIP

Implemented controlled integration of the hybrid retrieval layer into the evidence and API flows.

Completed:

- Added `hybrid` as an evidence mode.
- Added mapping from keyword search results into hybrid candidates.
- Added mapping from phrase search results into hybrid candidates.
- Added mapping from hybrid candidates back into citable evidence items.
- Added API validation support for keyword, phrase, and hybrid modes.
- Added `/api/search?mode=hybrid` support through the evidence integration.
- Added offline unit tests for hybrid evidence mapping.

Preserved non-goals:

- No LLM answer generation.
- No LLM reranking.
- No UI changes.
- No auth changes.
- No ingestion extractor changes.
- No migrations.
- No package changes.
- No env or secret changes.
- No external API calls in tests.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 010: 88 passing, 0 failing.

## 009-hybrid-retrieval-ranking

State: done  
Mode: SHIP

Implemented deterministic hybrid retrieval ranking.

Completed:

- Added normalized hybrid retrieval candidate types.
- Added deterministic hybrid score composition.
- Added deterministic deduplication across phrase, keyword, and vector candidates.
- Added phrase-priority ranking behavior.
- Added vector retrieval boundary through an interface.
- Added hybrid retrieval orchestration.
- Added offline tests for scoring, dedupe, vector boundary, and orchestration.

Preserved non-goals:

- No LLM answer generation.
- No UI changes.
- No auth changes.
- No ingestion extractor changes.
- No migrations.
- No package changes.
- No env or secret changes.
- No external API calls in tests.
- No `/api/answer` policy change.

Local verification passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after 009: 83 passing, 0 failing.

## 008-embedding-indexing-pipeline

State: done  
Mode: SHIP

Implemented the embedding indexing pipeline foundation.

Completed:

- normalized section to embedding chunk planning
- provider-agnostic embedding boundary
- deterministic chunk identity
- repository boundary
- in-memory repository for tests
- idempotent indexing orchestration
- citation/provenance preservation
- failure handling for provider failure and dimension mismatch

No external API calls were added. No dependencies, migrations, env files,
secrets, search, evidence, answer, chat, or ingestion behavior were modified.

Validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result: 70 passing, 0 failing.

Review changes requested were addressed:

- Chunk identity now includes `sectionType` and `citationLabel`.
- Vector count mismatch is validated before writes and fails with
  `embedding_vector_count_mismatch`.
- Planned chunk metadata now preserves selected document-level provenance:
  `documentMetadata`, `sourcePath`, and `sourceFormat`.

Review-fix validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after review fixes: 74 passing, 0 failing.

## 007-docx-extractor-mammoth

State: done  
Mode: SHIP

Replaced the DOCX ingestion stub with a real `mammoth` extractor.

Completed:

- Added approved `mammoth` dependency.
- Extracts plain text from DOCX buffers and paths.
- Emits `NormalizedDocument` and `NormalizedSection` output.
- Infers title from first heading-like line, explicit input title, or filename.
- Reuses existing heading and article-number detection helpers.
- Preserves Markdown, TXT, PDF adapter, retrieval, evidence, answer, chat, and
  server behavior.

Validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result: 58 passing, 0 failing.

Review changes requested were addressed in the same feature:

- PDF registry routing now uses the existing JSONL adapter.
- Invalid and empty DOCX inputs now raise stable `IngestionError` code
  `docx_extraction_failed` with the Mammoth/ZIP error preserved as `cause`.
- The package-lock root license metadata was retained as npm metadata sync
  because it matches `package.json`.

Review-fix validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result after review fixes: 61 passing, 0 failing.

## 006-document-ingestion-multiformat

State: review  
Mode: SHIP

Implemented a normalized ingestion foundation for non-PDF source documents.

Completed:

- Added shared normalized ingestion types.
- Added source format detection.
- Added Markdown extraction.
- Added TXT extraction.
- Added citation label helpers.
- Added extractor registry.
- Added PDF adapter around the existing reviewed JSONL output from
  `scripts/extract_pdf_sections.py`.
- Registered DOCX as a known format, but blocked extraction with an explicit
  dependency error because no DOCX parser dependency is installed.

Package files were not modified.

Validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result: 56 passing, 0 failing.

## 005-server-test-hang-fix

State: review  
Mode: SHIP

Fixed the server test hang by separating request handler creation, API server
creation, and production listener startup.

The test server now uses the real production handler, handles listen errors
explicitly, awaits server shutdown, and closes the PostgreSQL pool.

Validation passed:

- `npm run typecheck`
- `npm run build`
- `npm run test`

Full suite result: 47 passing, 0 failing.

## 004-deterministic-answer-endpoint

State: review  
Mode: SHIP

Added `GET /api/answer` as a deterministic grounded-answer endpoint.

The endpoint calls the evidence layer, returns `draft_grounded` with citations
when evidence exists, and returns `not_found` without citations when the corpus
does not support an answer.

Non-goals preserved:

- No LLM calls.
- No embeddings.
- No database mutation.
