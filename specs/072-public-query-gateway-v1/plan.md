# Plan

1. Add closed public request/response/error contracts and examples.
2. Add migration 016 for tenant-scoped public rate buckets.
3. Implement in-memory and PostgreSQL rate/audit persistence.
4. Reuse SearchEvidence execution under server-set tenant context.
5. Add deterministic public response composition and source minimization.
6. Integrate exact public CORS and route configuration into the server.
7. Run adversarial HTTP, migration, PostgreSQL and compiled smoke gates.
8. Add named eval/CI/docs, global regression, detached verification and publication.
