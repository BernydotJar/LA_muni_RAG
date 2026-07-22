# Plan

1. Add RED coverage, URL safety, failure cleanup and dirty-environment tests.
2. Implement a plan-driven orchestration core independent of PostgreSQL mechanics.
3. Implement a loopback-only PostgreSQL executor with minimal child environments.
4. Compose the existing guarded migrations, runtime gates and compiled smokes into four database scenarios.
5. Add exact persona fixtures and a reset-integrity gate/smoke.
6. Add a closed sanitized receipt schema and validator.
7. Add CLI, package scripts, named eval and final CI execution.
8. Execute locally on the same immutable pgvector image used by CI.
9. Red-team environment ownership, dotenv leakage, persona fidelity, receipt leakage and cleanup.
10. Run detached verification, commit, push, observe CI and reconcile program state.
