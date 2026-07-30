# Implementation plan

1. Reconstruct the service credential, tenant, RBAC, audit, server, migration, staging, and browser blocker baseline.
2. Define provider-neutral interfaces for provider exchange, protected login state, human membership, session persistence, audit, and test-only adapters.
3. Implement login, callback, session bootstrap/rotation, explicit rotation, and logout routes with no Bearer support or cross-origin CORS.
4. Add migration 017 with digest-only human identity/session state, forced tenant RLS, fixed-search-path security-definer functions, replay protection, and minimized audit.
5. Add an in-memory deterministic HTTP harness, migration assertions, a non-owner PostgreSQL runtime gate, and a compiled PostgreSQL smoke.
6. Run producer, critic/red-team, fixer, independent verifier, and release-gate passes; persist findings and limitations.
7. Update security, privacy, staging, program, release, and PR evidence without claiming an approved IdP, authenticated UI, or production readiness.

## Intended files

- `src/humanSession/*`
- `src/server.ts`
- `db/migrations/017_human_session_bff.sql`
- `db/tests/human_session_bff_runtime_gate.sql`
- `scripts/human-session-bff-postgres-smoke.mjs`
- `src/__tests__/human-session-bff-v1.test.ts`
- `src/__tests__/human-session-bff-migration.test.ts`
- `src/__tests__/eval-human-session-bff-001.test.ts`
- `docs/security/human-session-bff.md`
- `docs/decisions/077-provider-neutral-human-session-bff-foundation.md`
- `docs/risks/077-human-session-bff-risk-register.md`
- `docs/traceability/077-human-session-bff-v1.md`
- `docs/reviews/077-human-session-bff-independent-review.md`
