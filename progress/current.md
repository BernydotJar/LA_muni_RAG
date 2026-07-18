# Current Progress

## Active Feature

053-municipal-source-corpus-foundation

## State

review

## Mode

SHIP

## Dependency Resolution

- PR #17 passed the complete reconciliation gate.
- Human approval was received.
- PR #17 was merged externally; this session did not perform the merge.
- Reconciled base: `stack-base/052-case-portfolio-dashboard-reconciled`.
- Reconciled merge commit: `ed2fa98427e2857956c0ed30b6a7813043ab1bfe`.

## Summary

Feature 053 establishes a declarative, versioned source inventory separate from the operational corpus manifest. It records authority, jurisdiction, discovery, acquisition, extraction and ingestion claims without treating a URL or registration as proof of ingestion.

## Implemented

- source inventory specification and lifecycle contract
- strict source record and manifest validation
- explicit target/source jurisdiction and authority metadata
- declarative-to-operational manifest reconciliation
- duplicate version and conflicting hash detection
- Antigua-specific evidence boundary
- external municipality comparison boundary
- valid domain-pack authority mapping
- initial Antigua, national and Mixco inventory
- validation CLI and npm command
- deterministic and adversarial tests
- acquisition and ingestion runbook
- decision log, risk register and requirements traceability
- Feature 053 CI gate
- draft PR #18

## Current Inventory Truth

- acquired documents: 0
- ingested documents: 0
- Mixco records are comparative for Antigua
- priority Antigua documents without confirmed official URLs are `missing_source`
- verified portal records do not imply acquired individual documents

## Critic Result

The Critic found that declarative authority classes were initially being passed directly as domain-pack authority IDs. The implementation now maps each inventory authority/category to a valid domain-pack ID while preserving the original declarative authority in audit tags. Focused coverage verifies the mapping.

## Independent Verification

GitHub Actions run `29660134062` completed successfully after the Critic fix:

- source inventory validation
- TypeScript typecheck
- build
- source inventory tests
- authority boundary tests
- existing source attribution tests
- domain evaluation
- complete test suite
- Pages build
- Pages artifact verification
- diff integrity
- bounded generated artifact cleanup
- clean generated state

## Non-Goals Preserved

- no document upload UI
- no background acquisition
- no corpus or database write
- no migrations
- no deployment
- no War Room changes
- no workflow publication lifecycle
- no water-project workflow
- no tenant/auth/RBAC work
- no political profiling or targeting

## Review Artifacts

- `specs/053-municipal-source-corpus-foundation.md`
- `docs/municipal-source-inventory.md`
- `docs/decisions/053-source-inventory-boundaries.md`
- `docs/risks/053-source-inventory-risk-register.md`
- `docs/traceability/053-requirements-traceability.md`
- `tasks/053-municipal-source-corpus-foundation.md`

## Next Gate

Human review of PR #18. Do not merge automatically.
