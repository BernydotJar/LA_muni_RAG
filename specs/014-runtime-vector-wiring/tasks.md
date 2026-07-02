# Tasks: Runtime Vector Wiring

Feature: 014-runtime-vector-wiring  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/011-production-vector-store/**
- specs/012-vector-query-integration/**
- specs/013-production-query-embedding-provider/**
- src/evidence.ts
- src/server.ts
- src/embeddings/**
- src/retrieval/**
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/014-runtime-vector-wiring/requirements.md
- specs/014-runtime-vector-wiring/design.md
- specs/014-runtime-vector-wiring/tasks.md

## Files You May Touch During Implementation After Approval

- src/runtime/**
- src/server.ts
- src/__tests__/**
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- migrations
- package files unless separately approved
- public UI
- LLM answer generation
- unrelated ingestion extractors

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement runtime code until explicit human approval.

## Task 3: Add Runtime Dependency Factory

After approval, add a runtime evidence dependency factory.

The factory must be safe when configuration is missing.

## Task 4: Add Server Wiring

Wire server evidence routes through dependency-aware evidence retrieval without changing public response schemas.

## Task 5: Preserve Fallback

Hybrid mode must keep working with phrase and keyword retrieval when vector runtime dependencies are unavailable.

## Task 6: Add Tests

Add offline tests for:

- missing config returns empty dependencies
- complete config can create vector dependencies through safe factory seams
- server routes remain stable without vector config
- no hosted provider calls

## Task 7: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- runtime dependency factory exists
- server can use dependency-aware evidence retrieval
- missing config is safe
- server tests pass without vector config
- no secrets are committed
- no hosted provider calls occur in tests
- verification passes
