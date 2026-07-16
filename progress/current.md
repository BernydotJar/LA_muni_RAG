# Current Progress

## Active Feature

049-procedure-query-understanding

## Last Completed Feature

048-template-bootstrap-cli

## State

in_progress

## Mode

MVP

## Summary

Feature 049 makes Query Understanding an explicit deterministic layer above the existing Procedure Workflow Advisor. It distinguishes documentary, legal, procedural, case-specific, planning/project, closure/liquidation, and unknown intent while preserving domain-pack procedure classification, case/community context, external-reference handling, and conservative workflow composition.

## Completed Increment

- Added `ProcedureQueryIntent` and routing metadata to the classification contract.
- Added deterministic intent precedence and bounded intent signals.
- Added explicit `requiresCaseContext` and `requiresNormativeRetrieval` flags.
- Added intent-specific retrieval hints with original-query-first ordering and normalized deduplication.
- Added focused coverage for all intent families, precedence, flags, retrieval order, and existing workflow scenarios.
- Added requirements, design, task ledger, and tracking issue #5.

## Verification Pending

- Focused Procedure Workflow Advisor tests.
- Typecheck and build.
- Domain-pack evaluation.
- Complete test suite.
- GitHub Pages build and artifact verification.
- Clean working tree confirmation.

## Next Increment After Gate

050-procedure-retrieval-routing, using the new flags to separate normative/procedural retrieval from case-context retrieval without weakening source authority rules.
