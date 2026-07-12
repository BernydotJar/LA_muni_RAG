# Requirements — Domain Pack Evaluation Harness

## Objective

Add a deterministic evaluation harness for domain packs so starter packs can be checked for classification and source-authority expectations without a database or LLM judge.

## Acceptance Criteria

- AC-01: Evaluate every `DomainPack.evaluationCases` entry.
- AC-02: Validate expected workflow classification.
- AC-03: Validate expected source authority class when provided.
- AC-04: Produce stable summary metrics and a human-readable report.
- AC-05: Add a CLI script that evaluates all registered packs.
- AC-06: CLI exits non-zero when any domain pack case fails.
- AC-07: Tests cover passing and failing cases.
- AC-08: No database, network, or generated Pages artifact is required.

## Non-Goals

- Run retrieval against PostgreSQL.
- Judge generated answers with an LLM.
- Score user performance.
- Modify corpus data.
