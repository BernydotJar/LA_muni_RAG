# Requirements — Procedure Query Understanding

## Goal

Add an explicit query-understanding layer above the existing Procedure Workflow Advisor so the runtime can distinguish documentary, legal, procedural, case-specific, planning/project, and closure/liquidation questions before retrieval and composition.

## Functional Requirements

1. Classify every query into one primary intent:
   - `documentary`
   - `legal`
   - `procedural`
   - `case_specific`
   - `planning_project`
   - `closure_liquidation`
   - `unknown`
2. Preserve the existing `procedureType` classification and all current fields.
3. Mark whether case-context retrieval is required.
4. Mark whether normative/procedural retrieval is required.
5. Produce deterministic retrieval queries that keep the original query first and add intent-specific terms without duplicates.
6. Case-specific and closure questions must preserve detected case/community context.
7. External-municipality questions remain references and must not become official Antigua procedure.
8. No LLM call, dependency, migration, database write, deployment, or public UI change is introduced.

## Safety Requirements

- Do not infer current project status from query wording.
- Do not infer deadlines, approvals, responsible roles, or legal effect.
- Query intent is routing metadata, not evidence.
- Unknown or ambiguous queries fail conservatively to `unknown` or `documentary` without fabricating procedure.

## Acceptance Criteria

- Existing Procedure Workflow Advisor tests continue to pass.
- Focused tests cover all six requested intent families plus unknown.
- Retrieval query order and deduplication are deterministic.
- Typecheck, build, domain evaluation, full tests, Pages build, and artifact verification pass locally before closure.
