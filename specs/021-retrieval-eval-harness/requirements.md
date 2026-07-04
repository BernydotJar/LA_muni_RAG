# Requirements: Retrieval Eval Harness

Feature: 021-retrieval-eval-harness  
Mode: SHIP  
Status: spec_ready

## Product Intent

Add an offline retrieval evaluation harness that makes retrieval quality measurable and repeatable.

The project already has ingestion, embeddings, hybrid retrieval, runtime vector wiring, corpus manifest state, and corpus backfill CLI. The next risk is quality drift: retrieval may change in subtle ways as corpus, ranking, or runtime dependencies evolve.

Feature 021 should introduce a small but durable evaluation harness for golden retrieval cases.

## Problem

Current tests validate mechanics and safety, but they do not yet provide a simple retrieval-quality regression loop.

Without a retrieval eval harness, it is harder to answer:

- Did this query return the expected evidence?
- Did a `not_found` query incorrectly retrieve weak evidence?
- Did hybrid ranking regress after a scoring change?
- Did citation-bearing evidence remain reachable?
- Did top-k results still contain the required document/chunk/citation?

## Goal

Define and implement an offline harness that runs retrieval cases against injected retrieval dependencies and produces stable pass/fail metrics.

The harness must support:

- golden queries
- expected evidence checks
- expected `not_found` checks
- minimum match thresholds
- stable report formatting
- offline unit tests

## Functional Requirements

### FR-1: Eval Case Model

Add a typed eval case model.

Each case should support:

```text
id
query
mode
expectedStatus
expectedEvidence
minimumMatches
notes
```

`expectedStatus` should support at least:

```text
evidence_found
not_found
```

### FR-2: Expected Evidence Checks

Each expected evidence item should support one or more of:

```text
citationLabel
sourceType
documentTitle
textIncludes
```

The harness should pass an expected evidence item if at least one returned evidence item matches the required fields.

### FR-3: Not Found Checks

For `expectedStatus=not_found`, the harness should pass only when no qualifying evidence is returned.

The harness should not use an LLM judge.

### FR-4: Offline Execution

The harness must run offline in tests by using injected retrieval functions or in-memory evidence providers.

It must not require:

- database
- hosted embedding provider
- network
- secrets

### FR-5: Stable Metrics

The harness must return stable metrics:

```text
totalCases
passedCases
failedCases
passRate
```

Optional useful metrics:

```text
evidenceCases
notFoundCases
averageMatches
```

### FR-6: Stable Report Formatting

Add a formatter that outputs a deterministic text report.

Example:

```text
Retrieval eval report
- total: 3
- passed: 2
- failed: 1
- passRate: 66.67%

Cases
- municipal-basic: passed matches=1 expected=1
- unsupported-question: passed matches=0 expected=0
- citation-regression: failed matches=0 expected=1
```

### FR-7: Failure Reasons

Each failed case should include stable failure reasons such as:

```text
expected_evidence_not_found
unexpected_evidence_found
retrieval_error
invalid_eval_case
```

### FR-8: Minimal Fixture Set

Add a minimal eval fixture set in code or JSON.

Preferred SHIP scope:

```text
src/evals/retrievalEvalCases.ts
```

The fixture set can be synthetic and small. It should test the harness, not claim production corpus coverage.

### FR-9: Tests

Add offline tests for:

- matching expected citation label
- matching expected document title
- matching expected text include
- expected `not_found`
- unexpected evidence for `not_found`
- report formatting
- metrics calculation
- retrieval error handling

## Non-Goals

This feature must not add:

1. LLM judge.
2. Hosted provider calls.
3. Database calls in tests.
4. New package dependency.
5. New server route.
6. UI changes.
7. Production scheduler.
8. Corpus backfill changes.
9. Retrieval ranking changes.
10. Evidence policy changes.
11. Answer generation changes.
12. Auth changes.
13. CI gate enforcement unless separately approved.
14. Large benchmark corpus.
15. Manual QA spreadsheet generation.

## Acceptance Criteria

The feature can move to review when:

1. Retrieval eval types exist.
2. Eval runner exists.
3. Expected evidence matching exists.
4. Expected not_found checks exist.
5. Stable metrics are returned.
6. Stable report formatting exists.
7. Offline tests cover pass/fail cases.
8. No database, network, provider, or secret is required for tests.
9. No retrieval ranking or answer policy is changed.
10. `npm run typecheck` passes.
11. `npm run build` passes.
12. `npm run test` passes.
13. Harness state is updated.
