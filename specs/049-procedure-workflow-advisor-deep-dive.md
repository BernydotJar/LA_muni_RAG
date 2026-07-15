# Feature 049 — Procedure Workflow Advisor Deep Dive

## Objective

Extend the existing evidence-first Procedure Workflow Advisor with an explicit deep-dive response mode. The RAG and overview procedure response remain backward compatible.

## User outcome

For procedural, legal, project, case-specific, closure, procurement, COCODE, budget, and council questions, the deep-dive response must provide:

1. Executive summary.
2. Ordered steps.
3. Responsible role or unit only when supported.
4. Required and output documents.
5. Documentary/legal basis per step.
6. Dependencies and decision gates.
7. Deadlines only when explicit evidence supports them.
8. Missing evidence and case documents.
9. Confidence.
10. Step citations.
11. Human-validation warning.

## Safety contract

- Never invent a procedure, role, approval, deadline, current project status, or legal conclusion.
- A step with no matching evidence must say: `No encontré base documental suficiente para afirmar este paso.`
- A relationship inferred across evidence must say: `Este paso es inferido por relación entre documentos y requiere validación humana.`
- External municipal sources are comparative only unless corroborated by Guatemala national law or official Antigua evidence.
- Case status requires case-file evidence.
- Deadlines require an explicit duration expression in cited evidence.

## API contract

`GET /api/procedure` accepts optional `depth=overview|deep_dive`.

- Default: `overview` to preserve existing clients.
- `deep_dive`: returns the same workflow contract plus structured depth metadata, per-step evidence status, dependencies, decision gates, and explicit missing-evidence statements.
- Unsupported depth returns HTTP 400 with `invalid_depth`.

## Data model additions

- `ProcedureWorkflowDepth = "overview" | "deep_dive"`.
- `ProcedureStepEvidenceStatus = "supported" | "inferred" | "insufficient"`.
- `ProcedureDependency` with source step, target step, type, statement, evidence status, and citations.
- Optional step fields: `dependsOn`, `decisionGate`, `evidenceStatus`, `evidenceStatement`.
- Workflow metadata includes `depth` and generator version.

## Retrieval and composition

- Reuse the existing evidence retrieval boundary.
- Do not add a second ungoverned retrieval path.
- Match citations to each template step using evidence patterns.
- Do not silently fall back to unrelated citations in deep-dive mode.
- Overview mode keeps current fallback behavior.
- Build sequential dependencies conservatively from the workflow template; these are marked inferred unless evidence matches both adjacent steps.

## Scope

Included:
- Types and deep-dive composition.
- API depth parsing.
- Focused tests.
- Documentation and harness records.

Excluded:
- Database migrations.
- Corpus ingestion or production writes.
- LLM-generated legal interpretation.
- Deployment, release, merge, or production activation.
- Public UI redesign.

## Verification

- `npm run typecheck`
- `npm run build`
- focused procedure deep-dive tests
- `npm run domain:evaluate`
- `npm run test`
- `npm run build:pages`
- `node scripts/verify-pages-artifact.mjs`
- `git diff --check`
- clean generated Pages state

## Definition of Done

The branch contains a backward-compatible, evidence-governed deep-dive mode with focused tests and documentation. All executable local gates pass, or unresolved gates are documented as concrete blockers. No merge or deployment occurs.