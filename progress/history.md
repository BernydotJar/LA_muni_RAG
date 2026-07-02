# Progress History

## 008-embedding-indexing-pipeline

State: done  
Mode: SHIP

Implemented the embedding indexing foundation for LA_muni_RAG.

Added:

- embedding chunk planning
- deterministic chunk identity
- provider-agnostic embedding interface
- deterministic local test provider
- repository boundary
- idempotent indexing orchestration
- vector dimension validation
- vector count validation
- provider failure handling
- provenance preservation

Review fixes addressed:

- chunk identity now includes `sectionType` and `citationLabel`
- vector count mismatch now fails before persistence
- fewer-vector and extra-vector provider results write zero records
- planned chunk metadata now includes document metadata, source path, source format, section metadata, and planner marker

Validation passed:

- npm run typecheck
- npm run build
- npm run test

Full suite result: 74 passing, 0 failing.

No package files, migrations, env/secrets, public UI, API routes, search/evidence/answer/chat behavior, or ingestion extractors were changed.
