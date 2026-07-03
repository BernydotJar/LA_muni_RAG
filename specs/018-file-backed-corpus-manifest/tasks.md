# Tasks: File-Backed Corpus Manifest

Feature: 018-file-backed-corpus-manifest  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/017-corpus-backfill-manifest/**
- src/ingestion/corpusManifest.ts
- src/__tests__/corpus-manifest.test.ts
- src/__tests__/**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/018-file-backed-corpus-manifest/requirements.md
- specs/018-file-backed-corpus-manifest/design.md
- specs/018-file-backed-corpus-manifest/tasks.md

## Files You May Touch During Implementation After Approval

- src/ingestion/corpusManifest.ts
- src/__tests__/corpus-manifest.test.ts
- src/__tests__/corpus-manifest-file-store.test.ts if a separate test file is cleaner
- feature_list.json
- progress/current.md
- progress/history.md

## Files You Must Not Touch

- env files
- secrets
- migrations
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

Do not implement file-backed manifest code until explicit human approval.

## Task 3: Inspect Existing Manifest Boundary

After approval, inspect:

- `src/ingestion/corpusManifest.ts`
- existing corpus manifest tests

## Task 4: Add File-Backed Store

Add `JsonFileCorpusManifestStore` implementing `CorpusManifestStore`.

## Task 5: Add Manifest File Validation

Validate:

- top-level object
- `schemaVersion: 1`
- `records` array
- record document keys

## Task 6: Add Atomic-ish Write

Implement temp-file write followed by rename.

## Task 7: Add Offline Tests

Cover:

- missing file behavior
- read existing record
- persist across store instances
- replace existing document key
- deterministic list order
- invalid JSON
- invalid manifest shape

## Task 8: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- JSON file-backed store exists
- missing file behaves as empty manifest
- records persist to disk
- list order is deterministic
- invalid file states fail clearly
- existing in-memory manifest tests still pass
- existing server/vector indexing behavior is unchanged
- verification passes
