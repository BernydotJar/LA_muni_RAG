# Tasks: Production Vector Store

Feature: 011-production-vector-store  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/008-embedding-indexing-pipeline/**
- specs/009-hybrid-retrieval-ranking/**
- specs/010-hybrid-retrieval-integration/**
- src/embeddings/**
- src/retrieval/**
- src/evidence.ts
- src/search.ts
- src/db.ts
- src/__tests__/**
- migrations/** if present

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/011-production-vector-store/requirements.md
- specs/011-production-vector-store/design.md
- specs/011-production-vector-store/tasks.md

## Files You May Touch During Implementation After Approval

- src/embeddings/**
- src/retrieval/**
- src/__tests__/**
- migrations/** only if explicitly approved by this feature
- docs/http-api.md only if API behavior changes
- progress/current.md
- progress/history.md
- feature_list.json

## Files You Must Not Touch

- env files
- secrets
- public UI
- LLM answer generation
- unrelated ingestion extractors
- deployment files unless separately approved

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement runtime code until explicit human approval.

## Task 3: Define Production Vector Store Schema

After approval, define the production vector table or storage model.

## Task 4: Add Repository Adapter

Add a repository adapter behind the existing embedding/vector retrieval boundary.

## Task 5: Add Vector Result Mapping

Map persisted vector rows to `VectorCandidateInput`.

## Task 6: Preserve Idempotent Upsert

Ensure repeated writes of unchanged chunks remain stable and do not duplicate records.

## Task 7: Add Dimension Validation

Reject wrong-dimension search vectors predictably.

## Task 8: Tests

Add tests for:

- row mapping
- idempotent upsert behavior
- citation filtering
- vector candidate mapping
- dimension mismatch
- no external API calls

## Task 9: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- production vector storage is defined
- repository boundary exists
- vector candidates map into hybrid retrieval
- citation/provenance is preserved
- dimension validation is tested
- idempotent behavior is tested
- no LLM calls exist
- verification passes
