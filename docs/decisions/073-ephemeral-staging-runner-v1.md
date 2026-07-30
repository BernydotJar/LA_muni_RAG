# Decision 073 — Execute staging as a plan-driven disposable database set

## Decision

Use one externally managed, dedicated, disposable PostgreSQL/pgvector service per local/CI run and create four fixed databases inside it. Compose the existing non-owner runtime gates and compiled smokes instead of creating a second testing implementation.

The runner owns and destroys the four database names and three runtime role names only after it proves the environment was clean or explicitly cleaned. A pre-existing unapproved environment is preserved and the run fails closed.

## Rationale

- Existing gates already prove RLS, identity, idempotency, artifact, search, workflow, case and ingestion behavior.
- Four databases prevent fixture/role collisions while remaining one bounded staging environment.
- A plan-to-smoke mapping makes all twenty journeys explicit and prevents browser/API concern mixing.
- An externally managed service works with GitHub service containers and local Docker while keeping cloud creation out of scope.
- Sanitized receipts provide auditable execution without persisting connection or corpus material.

## Consequences

The runner proves API/system staging behavior and cleanup. It does not prove browser journeys, external consumer stores, real corpus behavior, cloud networking, edge protection, HA or production operation.
