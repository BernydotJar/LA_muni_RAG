# Tasks: Hybrid Retrieval Integration

Feature: 010-hybrid-retrieval-integration  
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
- src/retrieval/**
- src/search.ts
- src/evidence.ts
- src/answer.ts
- src/chat.ts
- src/server.ts
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/010-hybrid-retrieval-integration/requirements.md
- specs/010-hybrid-retrieval-integration/design.md
- specs/010-hybrid-retrieval-integration/tasks.md

## Files You May Touch During Implementation After Approval

- src/evidence.ts
- src/search.ts only if needed
- src/server.ts only if mode validation must accept hybrid
- src/chat.ts only if chat mode typing requires hybrid support
- src/answer.ts only if type compatibility requires hybrid support
- src/retrieval/** only for small integration adapters
- src/__tests__/** for integration and contract tests
- docs/http-api.md only if API behavior changes
- feature_list.json
- progress/current.md
- progress/history.md

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

## Task 3: Add Hybrid Evidence Mode

After approval, extend the evidence integration to support hybrid mode while preserving keyword and phrase modes.

## Task 4: Map Existing Search Results Into Hybrid Candidates

Map phrase and keyword results into `HybridCandidate` objects.

## Task 5: Preserve Citation Filtering

Ensure uncitable candidates cannot become evidence.

## Task 6: API Validation

If public endpoints validate retrieval modes, update validation to accept hybrid while preserving invalid-mode rejection.

## Task 7: Tests

Add or update tests for:

- hybrid evidence mode
- keyword mode unchanged
- phrase mode unchanged
- invalid mode still rejected
- deterministic answer behavior unchanged
- no evidence still returns not_found

## Task 8: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- hybrid mode is integrated or exposed through an approved boundary
- existing modes remain backward compatible
- evidence-first policy is preserved
- tests cover hybrid and existing modes
- no LLM calls exist
- verification passes
