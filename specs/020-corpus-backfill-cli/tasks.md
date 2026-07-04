# Tasks: Corpus Backfill CLI

Feature: 020-corpus-backfill-cli  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/020-corpus-backfill-cli/**
- src/cli/indexVector.ts
- src/ingestion/corpusManifest.ts
- src/ingestion/vectorIndexing.ts
- src/ingestion/types.ts
- src/ingestion/registry.ts
- src/embeddings/queryProvider.ts
- src/runtimeEvidenceDependencies.ts
- src/__tests__/corpus-manifest.test.ts
- src/__tests__/vector-indexing.test.ts

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/020-corpus-backfill-cli/requirements.md
- specs/020-corpus-backfill-cli/design.md
- specs/020-corpus-backfill-cli/tasks.md

## Files You May Touch During Implementation After Approval

- src/cli/backfillCorpus.ts
- src/__tests__/backfill-corpus-cli.test.ts
- feature_list.json
- progress/current.md
- progress/history.md

Optional if needed for clean testability:

- src/cli/backfillCorpusCli.ts

## Files You Must Not Touch

- env files
- secrets
- package files unless separately approved
- migrations
- public UI files
- widget files
- LLM answer generation
- LLM reranking
- retrieval ranking policy
- vector ranking policy
- evidence policy
- auth
- server routes
- corpus manifest core logic unless a small compatibility fix is explicitly required
- vector indexing core logic unless a small compatibility fix is explicitly required

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement the CLI until explicit human approval.

Approval phrase:

```text
Approved: 020-corpus-backfill-cli for implementation in SHIP mode.
```

## Task 3: Inspect Existing Boundaries

After approval, inspect:

- `src/cli/indexVector.ts`
- `src/ingestion/corpusManifest.ts`
- `src/ingestion/vectorIndexing.ts`
- relevant provider/config helpers

Confirm how to safely reuse existing behavior.

## Task 4: Build CLI

Create:

```text
src/cli/backfillCorpus.ts
```

The CLI should:

- parse explicit flags
- validate required arguments
- read the input file
- use `JsonFileCorpusManifestStore`
- call `backfillCorpusManifest()`
- use `indexVectorSource()` for indexing
- output safe summaries

## Task 5: Add Tests

Create:

```text
src/__tests__/backfill-corpus-cli.test.ts
```

Test at least:

- arg parsing
- missing required args
- unknown args
- safe result formatting
- secret redaction / non-leakage
- dry-run behavior if implemented

## Task 6: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- CLI entry point exists
- required args are supported
- manifest file store is used
- existing backfill orchestration is used
- existing vector indexing orchestration is used
- no new server route is added
- no package change is added
- no secret leakage is introduced
- offline tests are added
- typecheck/build/test pass
- harness is updated
