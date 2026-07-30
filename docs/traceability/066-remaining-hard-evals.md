# Traceability — Feature 066

| Eval | Core implementation | Behavioral proof | Remaining boundary |
|---|---|---|---|
| EVAL-SOURCE-001 | source inventory validator/manifest | source inventory suites | durable bytes, ingestion, ongoing freshness |
| EVAL-MISSING-001 | procedure mapper and EvidenceGap | procedure API/mapper/gap suites | real-corpus research and resolution |
| EVAL-RBAC-001 | RBAC, auth, tenant transaction, RLS | identity, case and PostgreSQL tests | human IdP/provisioning/access review |
| EVAL-INGEST-001 | artifacts, durable jobs, vectors, worker/API | focused suites plus PostgreSQL/HTTP gates | production storage/scanner/dispatcher/load/HA |
