# Tasks: Hybrid Retrieval Ranking

Feature: 009-hybrid-retrieval-ranking  
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
- src/search.ts
- src/evidence.ts
- src/answer.ts
- src/chat.ts
- src/embeddings/**
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/009-hybrid-retrieval-ranking/requirements.md
- specs/009-hybrid-retrieval-ranking/design.md
- specs/009-hybrid-retrieval-ranking/tasks.md

## Files You May Touch During Implementation After Approval

- src/retrieval/**
- src/__tests__/retrieval-*.test.ts
- src/search.ts only if needed to call the hybrid layer without breaking existing behavior
- src/evidence.ts only if needed to support hybrid result mapping
- docs/http-api.md only if endpoint behavior is explicitly documented
- progress/current.md
- progress/history.md
- feature_list.json

## Files You Must Not Touch

- migrations unless separately approved
- package files unless separately approved
- env files
- secrets
- public UI
- ingestion extractors
- LLM answer generation
- deployment files

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement runtime code until explicit human approval.

## Task 3: Add Hybrid Types

After approval, create normalized retrieval candidate types.

## Task 4: Add Deduplication

Implement deterministic candidate deduplication.

## Task 5: Add Hybrid Scoring

Implement explainable score composition.

## Task 6: Add Vector Retrieval Boundary

Add vector retrieval through a test-safe interface.

## Task 7: Preserve Evidence Compatibility

Ensure hybrid results can still flow into evidence responses and deterministic answer behavior.

## Task 8: Tests

Add tests for:

- phrase priority
- keyword/vector score composition
- deduplication
- provenance preservation
- vector candidate handling
- no behavior drift in answer/evidence contracts

## Task 9: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- hybrid types exist
- hybrid ranking exists
- deduplication is tested
- phrase priority is tested
- vector retrieval boundary is tested
- no LLM calls exist
- existing answer behavior remains evidence-first
- verification passes
