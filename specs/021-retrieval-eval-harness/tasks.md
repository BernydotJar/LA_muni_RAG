# Tasks: Retrieval Eval Harness

Feature: 021-retrieval-eval-harness  
Mode: SHIP  
Status: spec_ready

## Files You May Read

- AGENTS.md
- RTK.md
- CLAUDE.md
- feature_list.json
- progress/current.md
- progress/history.md
- specs/021-retrieval-eval-harness/**
- src/retrieval/**
- src/evidence.ts
- src/server.ts
- src/__tests__/**retrieval**
- src/__tests__/**evidence**

## Files You May Touch During Spec Phase

- feature_list.json
- progress/current.md
- progress/history.md
- specs/021-retrieval-eval-harness/requirements.md
- specs/021-retrieval-eval-harness/design.md
- specs/021-retrieval-eval-harness/tasks.md

## Files You May Touch During Implementation After Approval

- src/evals/retrievalEval.ts
- src/evals/retrievalEvalCases.ts
- src/__tests__/retrieval-eval.test.ts
- feature_list.json
- progress/current.md
- progress/history.md

Optional if useful:

- src/evals/index.ts

## Files You Must Not Touch

- env files
- secrets
- package files unless separately approved
- migrations
- public UI files
- widget files
- CLI files from previous features unless separately approved
- LLM answer generation
- LLM reranking
- retrieval ranking policy
- evidence policy
- auth
- server routes
- corpus manifest logic
- vector indexing logic

## Task 1: Create Spec Package

Create:

- requirements.md
- design.md
- tasks.md

## Task 2: Approval Gate

Stop after spec package.

Do not implement the eval harness until explicit human approval.

Approval phrase:

```text
Approved: 021-retrieval-eval-harness for implementation in SHIP mode.
```

## Task 3: Inspect Existing Retrieval/Evidence Boundaries

After approval, inspect:

- retrieval types
- evidence result shape
- existing retrieval tests
- existing evidence tests

Confirm how to create a minimal adapter-compatible evidence shape without changing production retrieval behavior.

## Task 4: Build Eval Harness

Create:

```text
src/evals/retrievalEval.ts
```

Include:

- types
- matcher
- runner
- metrics calculation
- report formatter
- stable failure reasons

## Task 5: Add Minimal Eval Cases

Create:

```text
src/evals/retrievalEvalCases.ts
```

Include a small synthetic set that documents intended use. Do not claim production benchmark coverage.

## Task 6: Add Tests

Create:

```text
src/__tests__/retrieval-eval.test.ts
```

Cover:

- citation label match
- document title match
- text include match
- not_found pass
- not_found fail
- retrieval error
- metrics
- report formatting
- invalid case

## Task 7: Verification

Run:

```bash
npm run typecheck
npm run build
npm run test
```

## Done Criteria

The feature can move to review when:

- eval case types exist
- eval runner exists
- matcher exists
- metrics exist
- report formatter exists
- minimal fixture cases exist
- offline tests exist
- tests require no database/provider/network/secrets
- no ranking/evidence/answer policy changed
- typecheck/build/test pass
- harness is updated
