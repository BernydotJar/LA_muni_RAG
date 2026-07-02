# Tasks: Runtime Vector Observability

Feature: 015-runtime-vector-observability  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/014-runtime-vector-wiring/**
- src/runtime/evidenceDependencies.ts
- src/server.ts
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/015-runtime-vector-observability/requirements.md
- specs/015-runtime-vector-observability/design.md
- specs/015-runtime-vector-observability/tasks.md

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

## Task 3: Add Status Model

After approval, add a sanitized runtime vector status model.

## Task 4: Add Context Factory

Add a context factory that returns both dependencies and vector runtime status.

Keep the existing dependency-only factory available.

## Task 5: Add Server Exposure

Expose sanitized vector runtime status through `/health` or equivalent minimal operational surface.

## Task 6: Add Tests

Add offline tests for:

- missing query embedding configuration
- missing database configuration
- complete runtime vector configuration
- secret leakage prevention
- health route status shape

## Task 7: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- runtime vector status model exists
- status contains only safe metadata
- server can expose sanitized status
- no hosted provider calls occur in tests
- existing routes remain stable
- verification passes
