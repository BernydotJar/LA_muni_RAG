# Implementation plan

1. Add a closed staging-plan schema and one canonical manifest.
2. Add RED tests for canonical validation and adversarial drift cases.
3. Implement the plan loader, semantic verifier, OpenAPI checks, RBAC checks, secret/production-data guards, reset coverage, journey-layer policy, and deterministic execution summary.
4. Add CLI/package/CI commands and a named eval.
5. Document identity, fixtures, reset order, journeys, role matrix, mock policy, browser prerequisites, and explicit external-consumer limitations.
6. Run producer, critic, and fixer passes followed by focused and global verification.
7. Commit the functional slice, verify from a detached checkout, publish the exact SHA, observe CI, and reconcile program state separately.

## Files expected

- `contracts/staging/v1/ephemeral-staging-plan.schema.json`
- `contracts/staging/v1/ephemeral-staging-plan.json`
- `src/staging/ephemeralStagingPlan.ts`
- `src/cli/verifyEphemeralStagingPlan.ts`
- `src/__tests__/ephemeral-staging-plan-v1.test.ts`
- `src/__tests__/eval-ephemeral-staging-e2e-001.test.ts`
- `docs/testing/ephemeral-staging-e2e-architecture.md`
- `docs/decisions/070-ephemeral-staging-e2e-architecture-v1.md`
- `docs/risks/070-ephemeral-staging-e2e-risk-register.md`
- `docs/traceability/070-ephemeral-staging-e2e-v1.md`
- `package.json`
- `.github/workflows/ci.yml`
