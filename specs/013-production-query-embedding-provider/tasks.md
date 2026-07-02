# Tasks: Production Query Embedding Provider

Feature: 013-production-query-embedding-provider  
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
- src/embeddings/**
- src/retrieval/**
- src/evidence.ts
- src/server.ts
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/013-production-query-embedding-provider/requirements.md
- specs/013-production-query-embedding-provider/design.md
- specs/013-production-query-embedding-provider/tasks.md

## Files You May Touch During Implementation After Approval

- src/embeddings/**
- src/__tests__/**
- docs/** only if documenting env names
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- public UI
- migrations
- package files unless separately approved
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

## Task 3: Add Provider Adapter

After approval, add a production query embedding provider adapter behind the `QueryEmbeddingProvider` boundary.

## Task 4: Add Configuration Factory

Add a safe factory that creates a provider only when configuration is complete.

Missing configuration must not crash imports or tests.

## Task 5: Add Transport Injection

The provider must accept an injected transport for deterministic tests.

## Task 6: Add Tests

Add offline tests for:

- successful response mapping
- dimension mismatch
- provider failure
- missing configuration
- no external calls

## Task 7: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- provider adapter exists
- factory is configuration-safe
- tests are offline
- no secrets are committed
- evidence policy is unchanged
- verification passes
