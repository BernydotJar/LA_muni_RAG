# Plan — Feature 068 Search and EvidenceBundle API v1

## Slice 1 — Contracts and red tests

- Define closed request/response schemas and examples.
- Add HTTP harness and RED tests for authentication-before-body, tenant/RBAC, bounded input, explicit retrieval modes and bundle replay.
- Add migration and named-eval RED tests.

## Slice 2 — Retrieval domain and persistence

- Implement a tenant-scoped repository with explicit keyword, phrase and semantic queries.
- Derive authority, temporal and evidence-use state from persisted server-owned fields.
- Enforce public/active/processed/accepted/clean/processed-job/source-indexed eligibility.
- Implement deterministic hybrid ranking and citation-identity deduplication.
- Add forced-RLS rate/idempotency/auth-failure persistence in migration 015.

## Slice 3 — HTTP and artifact mapping

- Implement authenticated Search and EvidenceBundle handlers.
- Add fail-closed semantic/hybrid capability behavior.
- Map search candidates to the closed Search response.
- Map supported documentary excerpts to EvidenceBundle claims; preserve comparative and validation-required evidence without promotion.
- Detect version conflicts and emit human-review contradictions.
- Implement exact replay and committed corrupt-replay invalidation for EvidenceBundle.

## Slice 4 — Contracts, server and PostgreSQL gates

- Register schemas/examples and OpenAPI paths.
- Wire server routes and route-specific CORS.
- Add non-owner PostgreSQL grants/gate and compiled HTTP smoke.
- Add package/CI gates.

## Slice 5 — Critique, regression and publication

- Run producer/critic/fixer review for privilege, replay, authority, temporal and score semantics.
- Run focused tests, named evals, fresh migrations, smoke, typecheck, build, full suite, audits and diff checks.
- Commit the functional slice.
- Verify from a detached clean checkout.
- Push the feature branch and verify the exact remote SHA.
- Reconcile program state in a separate checkpoint commit without claiming merge, deployment, corpus quality or global production readiness.
