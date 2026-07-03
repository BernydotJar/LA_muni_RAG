# Tasks: Corpus Backfill Manifest

Feature: 017-corpus-backfill-manifest  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/016-ingestion-cli-vector-indexing/**
- src/ingestion/**
- src/embeddings/**
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/017-corpus-backfill-manifest/requirements.md
- specs/017-corpus-backfill-manifest/design.md
- specs/017-corpus-backfill-manifest/tasks.md

## Files You May Touch During Implementation After Approval

- src/ingestion/**
- src/__tests__/**
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- migrations unless separately approved
- public UI
- server routes unless separately approved
- LLM answer generation
- search/evidence ranking policy
- package files unless separately approved
- unrelated extractors

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement manifest or backfill code until explicit human approval.

## Task 3: Inspect Existing Vector Indexing Boundary

After approval, inspect:

- `src/ingestion/vectorIndexing.ts`
- embedding result types
- existing hashing utilities
- ingestion source metadata patterns

## Task 4: Add Manifest Types and Store Boundary

Add a manifest module with:

- record types
- status values
- store interface
- in-memory implementation for tests

## Task 5: Add Reindex Decision Logic

Implement deterministic decision logic for:

- no prior record
- unchanged indexed record
- changed content hash
- changed document version
- changed embedding provider/model/dimension
- failed prior record

## Task 6: Add Backfill Orchestrator

Add dependency-injectable orchestration over explicit document inputs.

It should call injected vector indexing function only when indexing is required.

## Task 7: Add Safe Summary

Return safe counts and per-document summaries without leaking secrets.

## Task 8: Add Offline Tests

Cover:

- first-time indexing
- unchanged skip
- stale/reindex due to content hash
- stale/reindex due to embedding metadata
- retry after failed prior record
- failed indexing manifest update
- no hosted provider or live database dependency

## Task 9: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- manifest record model exists
- manifest store boundary exists
- reindex decision logic exists
- backfill orchestration exists
- offline tests cover key paths
- existing server/vector indexing behavior is unchanged
- verification passes
