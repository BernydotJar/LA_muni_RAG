# Design — Domain Pack Evaluation Harness

## Harness

The harness evaluates the declarative `evaluationCases` stored on each domain pack.

For each case:

- classify the query with `classifyProcedureQuery`;
- compare actual workflow type to `expectedWorkflowType`;
- when `expectedAuthorityClass` is present, classify a synthetic evidence item using the case query as title/citation context and compare the authority class.

This is intentionally deterministic and cheap. It catches regressions in pack vocabulary and source authority taxonomies.

## Report

The report includes:

- total cases;
- passed cases;
- failed cases;
- pass rate;
- per-case status and reasons.

## CLI

`src/cli/evaluateDomainPacks.ts` evaluates all registered packs and exits non-zero on failure.

Package script:

```bash
npm run domain:evaluate
```

## Safety

No database, network, browser automation, or generated artifact is required.
