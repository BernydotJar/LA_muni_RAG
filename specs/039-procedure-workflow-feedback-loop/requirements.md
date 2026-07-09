# Feature 039 — Procedure Workflow Feedback Loop

## Mode

MVP

## Objective

Turn the `ProcedureWorkflow` from a one-time answer into an improvement artifact. The UI should let users capture feedback about generated municipal workflows so the team can later improve the corpus, prompts, procedure templates, and validation process.

This feature implements the feedback loop as a frontend/local-export MVP. It does not persist feedback to the backend yet.

## User Need

After generating a workflow, a municipal user or team member should be able to mark:

- missing document;
- wrong or unclear step;
- unclear responsible role;
- missing legal basis;
- missing deadline;
- case-specific evidence missing;
- other correction.

The captured feedback should be exportable/copyable as JSON for review.

## Requirements

1. Add a frontend feedback module for the procedure workflow page.
2. The module must activate only after a `ProcedureWorkflow` is rendered.
3. The module must not change `src/procedure/*` backend logic.
4. The module must store feedback locally in `localStorage` under a namespaced key.
5. The module must allow selecting a workflow step or overall workflow.
6. The module must allow selecting a feedback type.
7. The module must capture free-text feedback.
8. The module must preserve workflow metadata: workflow id, title, procedure type, jurisdiction, confidence, query, and selected step.
9. The module must include a copy/export JSON action.
10. The module must avoid sending data to any network endpoint in this MVP.
11. The module must escape all dynamic text before rendering.
12. The procedure page must dispatch a workflow-rendered event after rendering.
13. GitHub Pages build/verification must include the feedback script.
14. Do not touch generated `dist-pages/` artifacts.

## AI-Native Principle

This feature implements the attached AI-native operating model principle: the product should capture user signal and improve an outcome object. Here the outcome object is `ProcedureWorkflow`, and the feedback signal identifies where the workflow needs better evidence, clearer steps, or human validation.

## Non-goals

- No backend database table.
- No POST API.
- No authentication.
- No dashboard.
- No automatic model retraining.
- No automatic corpus ingestion.
