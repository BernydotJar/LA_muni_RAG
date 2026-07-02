# Tasks: Vector Query Integration

Feature: 012-vector-query-integration  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/009-hybrid-retrieval-ranking/**
- specs/010-hybrid-retrieval-integration/**
- specs/011-production-vector-store/**
- src/evidence.ts
- src/embeddings/**
- src/retrieval/**
- src/search.ts
- src/server.ts
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/012-vector-query-integration/requirements.md
- specs/012-vector-query-integration/design.md
- specs/012-vector-query-integration/tasks.md

## Files You May Touch During Implementation After Approval

- src/evidence.ts
- src/embeddings/**
- src/retrieval/**
- src/__tests__/**
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- public UI
- LLM answer generation
- unrelated ingestion extractors
- migrations unless separately approved
- package files unless separately approved

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement runtime code until explicit human approval.

## Task 3: Add Query Embedding Boundary

After approval, add a query embedding provider interface or equivalent boundary.

## Task 4: Add Vector Dependency Wiring

Allow hybrid retrieval to receive a vector repository and query embedding provider through explicit dependencies.

## Task 5: Preserve Graceful Degradation

If vector dependencies are absent, hybrid retrieval must continue using phrase and keyword candidates only.

## Task 6: Add Deterministic Tests

Add tests for:

- hybrid retrieval with fake vector provider and repository
- hybrid retrieval without vector dependencies
- vector candidate citation filtering
- keyword mode unchanged
- phrase mode unchanged
- no evidence still returns not_found

## Task 7: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- query embedding boundary exists
- vector retrieval can feed hybrid candidates
- graceful degradation is tested
- no external API calls exist in tests
- deterministic answer policy is preserved
- verification passes
