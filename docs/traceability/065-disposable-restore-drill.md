# Traceability — Feature 065

| Requirement | Implementation | Evidence |
|---|---|---|
| Protected service-based connection | `scripts/postgres-restore-drill.mjs` | EVAL-RESTORE-001 |
| Empty isolated target | restore script preflight | drill 2026-07-21 receipt |
| Custom checksum-bound dump | restore script | dump SHA-256 receipt |
| Transactional restore | `pg_restore` invocation | drill result |
| Catalog/RLS identity | catalog snapshot/fingerprint | equal catalog receipt |
| Data identity | bounded per-table counts/hashes | equal table-data receipt |
| Runtime authorization after restore | `restored_runtime_access_gate.sql` | SQL gate output |
| Application readiness | compiled ProcedureCase smoke | smoke receipt |
| Honest non-proofs | result JSON/runbook/spec | EVAL-RESTORE-001 |
