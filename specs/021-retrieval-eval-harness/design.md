# Design: Retrieval Eval Harness

Feature: 021-retrieval-eval-harness  
Mode: SHIP

## Design Summary

Feature 021 adds an offline retrieval evaluation harness for deterministic retrieval-quality checks.

The harness should evaluate retrieval output, not answer generation. It should avoid LLM judging and instead use explicit expected-evidence assertions.

```text
Eval cases
  -> injected retrieval function
  -> evidence results
  -> expected evidence matcher
  -> case result
  -> aggregate metrics
  -> stable report
```

## Proposed Files

```text
src/evals/retrievalEval.ts
src/evals/retrievalEvalCases.ts
src/__tests__/retrieval-eval.test.ts
```

Optional if needed:

```text
src/evals/index.ts
```

## Core Types

Recommended types:

```ts
export type RetrievalEvalExpectedStatus = "evidence_found" | "not_found";

export interface RetrievalEvalExpectedEvidence {
  citationLabel?: string;
  sourceType?: string;
  documentTitle?: string;
  textIncludes?: string;
}

export interface RetrievalEvalCase {
  id: string;
  query: string;
  mode?: string;
  expectedStatus: RetrievalEvalExpectedStatus;
  expectedEvidence?: RetrievalEvalExpectedEvidence[];
  minimumMatches?: number;
  notes?: string;
}

export interface RetrievalEvalEvidence {
  citationLabel?: string | null;
  sourceType?: string | null;
  documentTitle?: string | null;
  text?: string | null;
  excerpt?: string | null;
}
```

## Retrieval Function Boundary

Use dependency injection:

```ts
export type RetrievalEvalRetriever = (
  query: string,
  options: { mode?: string; limit?: number }
) => Promise<RetrievalEvalEvidence[]>;
```

This allows tests to run offline with in-memory fixtures.

A future CLI or adapter can wire the harness to real retrieval, but SHIP scope should remain offline and deterministic.

## Matching Semantics

An expected evidence item matches a returned evidence item when all specified fields match:

- `citationLabel`: exact match
- `sourceType`: exact match
- `documentTitle`: exact match
- `textIncludes`: substring match against `text` or `excerpt`

If an expected field is omitted, it is not checked.

Case pass behavior:

- `expectedStatus=evidence_found`: pass when number of matched expected items >= `minimumMatches` or expected evidence count
- `expectedStatus=not_found`: pass when retrieval returns zero evidence items

## Failure Reasons

Use stable reason codes:

```text
expected_evidence_not_found
unexpected_evidence_found
retrieval_error
invalid_eval_case
```

## Metrics

Recommended aggregate result:

```ts
export interface RetrievalEvalSummary {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  evidenceCases: number;
  notFoundCases: number;
  averageMatches: number;
}
```

Use deterministic rounding in the text report.

## Report Format

Stable text report:

```text
Retrieval eval report
- total: 3
- passed: 2
- failed: 1
- passRate: 66.67%
- averageMatches: 0.67

Cases
- municipal-basic: passed matches=1 expected=1 reasons=[]
- unsupported-question: passed matches=0 expected=0 reasons=[]
- citation-regression: failed matches=0 expected=1 reasons=[expected_evidence_not_found]
```

## Tests

Offline tests should cover:

1. exact citation match
2. document title match
3. text include match
4. not_found pass
5. not_found fail when evidence is returned
6. retrieval error failure
7. report formatting
8. metrics calculation
9. invalid case behavior

## Future Work

Out of SHIP scope:

- CLI command for eval execution
- JSON report output
- real retrieval adapter
- CI threshold gate
- large benchmark corpus
- dashboard
- per-source recall metrics
- query category metrics
- LLM-based semantic grading
