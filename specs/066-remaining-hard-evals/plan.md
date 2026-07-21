# Plan — Remaining named hard evals

1. Map each missing named eval to existing implementation and tests.
2. Add one non-tautological scope test per family.
3. Compose each named command from the scope test plus relevant behavioral tests.
4. Execute Source/Missing/RBAC as code and contract gates.
5. Execute Ingest against fresh PostgreSQL/pgvector, including non-owner RLS,
   exact artifact acceptance, leases/fencing, vector rollback and compiled HTTP.
6. Record honest status strings and explicit limitations.
7. Run critic, full regression, detached verification and remote CI.

Rollback is code-only: remove the named wrappers and docs if they prove invalid.
No production data or infrastructure is changed.
