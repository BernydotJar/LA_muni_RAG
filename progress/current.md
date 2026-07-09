# Current Progress

## Active Feature

036-municipal-procedure-workflow-advisor

## State

review

## Mode

MVP

## Summary

Feature 036 adds a Procedure Workflow Advisor layer on top of evidence retrieval. The goal is to answer municipal procedural questions with structured workflows: steps, roles, documents, decision points, gaps, confidence, and citations. It must not invent missing procedures, current project status, deadlines, signatures, COCODE steps, or approval routes when the corpus does not support them.

## Acceptance Focus

- Detect procedural questions such as public works, procurement, project execution, project closure, budget, community request, COCODE, and council approval.
- Retrieve evidence using the existing evidence layer without changing ranking behavior.
- Compose workflow steps with citations and confidence per step.
- Mark unsupported items as gaps or validation-required notes.
- Treat external municipal manuals as comparative references, not Antigua-specific authority.
- Expose a bounded `/api/procedure` endpoint for procedure workflow responses.
- Add regression tests for stadium construction, San Mateo closure, external Mixco reference handling, and missing deadlines.

## Verification Required

Run before closing if local environment is available:

- npm run typecheck
- npm run build
- npm run test
