# Procedure Workflow Advisor — Deep Dive

Feature 049 adds an evidence-aware deep-dive response over the existing Procedure Workflow Advisor. It does not replace retrieval or the default procedure response.

## API

Default backward-compatible overview:

```http
GET /api/procedure?q=...&mode=keyword&limit=8
```

Explicit deep dive:

```http
GET /api/procedure?q=...&mode=hybrid&limit=8&depth=deep_dive
```

Supported depth values:

- `overview` — existing response behavior and no dependency graph.
- `deep_dive` — adds step evidence status, evidence statements, sequential dependencies, and deep-dive generator metadata.

Unknown depth values fail with HTTP 400 and code `invalid_depth`.

## Evidence contract

Every step is classified as:

- `supported`: matching local or national evidence was retrieved for that specific step.
- `inferred`: related or comparative evidence exists, but the step requires human validation.
- `insufficient`: no matching evidence was found for the step.

The composer does not attach unrelated fallback citations to a step. An unsupported step returns:

> No encontré base documental suficiente para afirmar este paso.

An inferred step returns:

> Este paso es inferido por relación entre documentos y requiere validación humana.

## Governance

- External municipal manuals remain comparative references.
- Mixco or another municipality cannot become official Antigua procedure without Antigua or applicable national corroboration.
- Responsible roles, units, approvals, and deadlines remain absent unless evidence supports them.
- Case-specific status is not asserted when the case file is absent.
- Dependencies express workflow structure, not legal proof. Each dependency carries the evidence status and citations of its target step.
- The output is decision support and requires human validation; it is not definitive legal advice.

## Verification

Run:

```bash
npm run typecheck
npm run build
node --import tsx --test src/__tests__/procedure-workflow-deep-dive.test.ts
npm run domain:evaluate
npm run test
npm run build:pages
node scripts/verify-pages-artifact.mjs
git diff --check
git status --short
```
