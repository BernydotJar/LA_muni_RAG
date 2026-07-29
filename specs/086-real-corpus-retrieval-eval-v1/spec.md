# Feature 086 - Real corpus retrieval evaluation v1

## Goal

Evaluate LA Muni RAG retrieval against the controlled real corpus and replace the current zero-evidence statement with measured, reproducible results.

## Requirements

- Use only chunks produced by Feature 085 from exact verified public municipal bytes.
- Define judged queries with expected document, citation/page constraints, and explicit no-answer cases.
- Measure at minimum hit rate at 5, mean reciprocal rank, citation identity accuracy, unsupported-answer rate, and cross-document leakage.
- Include keyword, phrase, and configured vector/hybrid modes only when each mode is genuinely available.
- Fail closed when a capability is unavailable; never relabel lexical results as semantic or hybrid.
- Persist the query set, result receipt, environment identity, corpus hashes, model/provider identity, and limitations.
- Do not generalize measured results beyond this corpus and query set.

## Non-goals

- Claiming complete legal coverage.
- Claiming legal correctness or institutional approval.
- Setting a production SLO from a local run.

## Gate

The node is complete only after judged real-corpus evaluation, adversarial review, regression, and exact-SHA remote CI pass.
