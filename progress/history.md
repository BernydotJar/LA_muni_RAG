# Progress History

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
