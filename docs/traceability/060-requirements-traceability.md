# Feature 060 requirements traceability

| Requirement | Implementation | Verification | State |
|---|---|---|---|
| Exact immutable object/hash | migrations 007/011; `ArtifactAcceptanceService` | EVAL-ARTIFACT-001; PostgreSQL wrong-hash gate | verified local |
| Current clean scan/generation | trigger, lookup, lease, final lock function | migration test; SQL gate; tenant smoke | verified local |
| Bounded expiry/revocation | max seven-day trigger and predicates | SQL oversized-window rejection; resolver tests | verified local |
| Accepted identity immutable | all-update trigger | object-key/generation SQL rejection | verified local |
| Scan evidence append-only | scan update trigger | SQLSTATE 55000 gate | verified local |
| Least-privilege completion lock | tenant-bound security-definer function | PUBLIC revoke, no UPDATE, own/foreign tenant SQL gate | verified local |
| Tenant vector identity | `TenantPgVectorRepository` | EVAL-VECTOR-001; non-owner smoke | verified local |
| Atomic replacement/rollback | completion transaction and generation replacement | rollback zero rows; stale deletion smoke | verified local |
| Single lease/fencing/retry | `PostgresIngestionJobService` | EVAL-JOB-LEASE-001; 50-submit/two-claimer smoke | verified local |
| Clean migration path | migrations 001–007 + DB 011 | disposable PostgreSQL 15.18/pgvector 0.8.5 | verified local |
| Supported legacy path | root vector 011 before tenancy, then canonical migrations | legacy upgrade gate | verified local |
| Remote CI | Backend CI wiring | exact remote run | pending |
| Production storage/scanner/worker | external runtime | staging/operations evidence | missing |
