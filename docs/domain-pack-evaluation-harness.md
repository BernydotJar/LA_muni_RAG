# Domain Pack Evaluation Harness

Feature: `046-domain-pack-evaluation-harness`  
Status: MVP

## Purpose

The domain-pack evaluation harness checks starter packs deterministically. It validates workflow classification and source-authority expectations declared in each pack's `evaluationCases`.

## Run

```bash
npm run domain:evaluate
```

The command evaluates all registered packs and exits non-zero if any case fails.

## What It Checks

- Query classification matches `expectedWorkflowType`.
- Source authority classification matches `expectedAuthorityClass` when provided.
- Aggregate pass/fail metrics are stable and readable.

## What It Does Not Do

- It does not query PostgreSQL.
- It does not run retrieval.
- It does not judge generated answers with an LLM.
- It does not write to corpus data.

## Current Baseline

The starter pack baseline is:

- `municipal-antigua`: 2 cases.
- `hr`: 1 case.
- `finance`: 1 case.
- `sales-sop`: 1 case.
- `custom`: 1 case.

All starter cases are expected to pass.
