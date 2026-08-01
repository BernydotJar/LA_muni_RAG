# Feature 089 implementation plan

## Lifecycle

### 1. Producer

- Add the successor node and release gate to the persistent Graph Harness project.
- Expand the national source inventory and source-pack connectors.
- Implement source-pack/inventory binding validation.
- Replace generic water-workflow evidence requirements with concrete evidence classes.
- Add academy fallback parity and rendering.
- Add focused tests and documentation.

### 2. Critic / Red Team

Attempt to falsify the implementation with these attacks:

- Treat a MARN Category C page as proof that every water project is Category C.
- Promote a verified discovery URL to acquired or ingested status.
- Treat MAFIM, SNIP, MSPAS or procurement rules as proof that a particular Antigua act occurred.
- Reference a nonexistent inventory record from a source pack.
- Bind an inventory record to a connector whose host is not allowlisted.
- Leave a required coverage tag unimplemented.
- Emit a generic evidence placeholder for any of the 47 categories.
- Allow the static academy to omit the exact source class required.

### 3. Fixer

Repair every reproducible failure without weakening authority, provenance, security or ingestion gates.

### 4. Independent verifier

Verify the functional commit from a clean detached worktree. Run focused validation, full regression, typecheck, build, package audit, diff checks and Graph Harness replay.

### 5. Release gate

The gate requires these persistent evidence kinds:

- `official_source_verification`
- `configuration_validation`
- `adversarial_review`
- `independent_regression`
- `remote_ci`

### 6. Persistent evidence

Store source-verification metadata, critic findings, independent-verifier output, gate evaluation, exact commit and remaining human-gated blockers under `program/` and `docs/`.

## Intended commits

1. Functional implementation and tests.
2. Evidence/checkpoint reconciliation after exact-head CI.

## Branch and publication

- Branch: `feature/official-source-coverage-pack-v1`
- Base: `fix/procedure-evidence-coverage-saas` / PR #33
- Publication: push and create a stacked draft PR.
- Merge and deployment: not authorized by repository policy.
