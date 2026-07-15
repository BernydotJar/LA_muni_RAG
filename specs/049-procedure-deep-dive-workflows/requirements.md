# Requirements — Procedure Deep-Dive Workflows

## Objective

Extend the existing Procedure Workflow Advisor so a procedural or case-specific question produces an auditable structured workflow rather than prose-only guidance.

## Functional requirements

A `ProcedureWorkflow` response must expose:

1. Executive summary.
2. Ordered steps.
3. Responsible role or unit only when supported by evidence.
4. Required and output documents per step.
5. Documentary or legal basis per step.
6. Dependencies and decision points.
7. Deadlines only when explicitly supported by a citation.
8. Missing-document and evidence gaps.
9. Workflow and step confidence.
10. Citations per step.
11. A clear warning for inferred or unproven procedure content.

Each step must explicitly declare its evidence status:

- `proven`: directly supported by one or more acceptable citations.
- `inferred`: assembled from relationships among cited documents and requiring human validation.
- `insufficient_evidence`: the corpus does not prove the step.

## Query behavior

The advisor must distinguish at least:

- documentary lookup;
- legal question;
- procedural question;
- case-specific question;
- planning/project question;
- closure or liquidation question.

Case-specific questions must trigger case-context retrieval in addition to procedural retrieval.

## Source authority contract

Supported municipal source classes include:

- `national_law`
- `municipal_code`
- `municipal_manual`
- `mof`
- `organigram`
- `pdm_ot`
- `pom_poa`
- `budget`
- `council_minutes`
- `community_file`
- `case_file`
- `war_room`
- `external_reference`

External municipal sources are comparative only. They must not establish an official Antigua procedure unless the same step is independently supported by national law or official Antigua evidence.

`war_room` material is operational context, never normative authority.

## Safety requirements

- Never invent procedure steps, deadlines, approvals, organizations, responsible roles, signatures, dependencies, or current case status.
- An unsupported step must say: `No encontré base documental suficiente para afirmar este paso.`
- An inferred step must say: `Este paso es inferido por relación entre documentos y requiere validación humana.`
- A deadline may be populated only when the same step carries a citation whose excerpt explicitly supports that deadline.
- Responsible role/unit fields remain absent when not evidenced.
- The response is not definitive legal advice.

## Compatibility requirements

- Preserve the existing retrieval and RAG behavior.
- Extend the current `ProcedureWorkflow` contract additively where possible.
- Preserve existing API routes and current Pages behavior.
- Domain packs remain the source of workflow templates and governance rules.

## Acceptance criteria

- Public works, procurement, project closure, case-specific status, COCODE, and council-approval questions are represented as structured workflows.
- Every generated step has an explicit evidence status.
- Unsupported deadlines and responsible roles are absent.
- External-only evidence cannot produce a proven Antigua step.
- Case-specific questions surface missing case-file evidence.
- Focused tests cover evidence states, dependencies, deadlines, source authority, and insufficient-evidence language.
- Typecheck, build, domain evaluation, full tests, Pages build, and Pages verification pass before closure.
