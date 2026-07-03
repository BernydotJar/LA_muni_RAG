# Tasks: Ingestion CLI Vector Indexing

Feature: 016-ingestion-cli-vector-indexing  
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
- specs/011-production-vector-store/**
- specs/013-production-query-embedding-provider/**
- specs/014-runtime-vector-wiring/**
- src/ingestion/**
- src/embeddings/**
- src/runtime/**
- src/db.ts
- src/__tests__/**
- package.json

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/016-ingestion-cli-vector-indexing/requirements.md
- specs/016-ingestion-cli-vector-indexing/design.md
- specs/016-ingestion-cli-vector-indexing/tasks.md

## Files You May Touch During Implementation After Approval

- src/cli/**
- src/ingestion/**
- src/embeddings/** only if needed for composition, not provider behavior changes
- src/__tests__/**
- package.json only if adding a narrow script is approved by implementation review
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- migrations unless separately approved
- public UI
- LLM answer generation
- search/evidence ranking policy unless separately approved
- unrelated ingestion extractors

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement runtime or CLI code until explicit human approval.

## Task 3: Inspect Existing Primitives

After approval, inspect existing:

- source extractor registry
- normalized document types
- chunk planner
- indexing orchestration from prior embedding features
- embedding provider factory
- pgvector repository adapter

## Task 4: Add Vector Indexing Orchestrator

Add a dependency-injectable indexing orchestration boundary.

It should support offline tests without hosted provider or live database.

## Task 5: Add CLI Entry Point

Add a minimal CLI entry point for explicit file indexing.

Keep output safe and stable.

## Task 6: Add Safe Reporting

Report safe counts and failure codes.

Do not print secrets, raw database URLs, API keys, authorization headers, or raw provider endpoints.

## Task 7: Add Tests

Add offline tests for:

- successful indexing
- missing input
- missing provider config or injected provider
- provider failure
- vector write failure
- safe output/no secret leakage

## Task 8: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- CLI-ready vector indexing path exists
- existing ingestion/chunking/provider/repository boundaries are reused
- offline tests cover success and failure
- no hosted provider calls occur in tests
- output is sanitized
- existing server behavior is unchanged
- verification passes
