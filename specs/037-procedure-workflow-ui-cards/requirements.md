# Feature 037 — Procedure Workflow UI Cards

## Mode

MVP

## Objective

Add a frontend view for the Procedure Workflow Advisor introduced in Feature 036. The UI must call `/api/procedure` and render the structured workflow as readable cards: summary, workflow steps, documents, citations, gaps, and validation warning.

## User Goal

A municipal user should be able to ask:

- ¿Qué hay que hacer para construir un estadio municipal?
- ¿Qué falta para cerrar la obra de la escuela de San Mateo?
- ¿Cómo funciona una contratación de obra según un manual externo como Mixco?

and see a procedure flow rather than a generic chat answer.

## Requirements

1. Add a public procedure workflow page.
2. The page must call `/api/procedure?q=<query>&mode=<mode>&limit=<limit>`.
3. Render workflow summary and metadata.
4. Render one card per workflow step.
5. Each step card must show:
   - step number;
   - title;
   - action;
   - confidence;
   - required documents;
   - output documents;
   - citations/evidence labels;
   - notes or validation-required text when present.
6. Render gaps separately with severity.
7. Render final validation warning.
8. Add a copy checklist control for the workflow.
9. Keep all text in Spanish.
10. Preserve evidence-first language; do not hide gaps or low confidence.
11. Support GitHub Pages demo mode with a static `/api/procedure` response through the Pages bridge.
12. Do not change the Feature 036 backend procedure logic.
13. Do not touch generated `dist-pages/` artifacts.

## Non-goals

- No backend schema changes.
- No PDF viewer.
- No export-to-PDF.
- No editing or saving workflow state.
- No replacing the existing chat widget.
