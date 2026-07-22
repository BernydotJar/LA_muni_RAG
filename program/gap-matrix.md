# LA Muni RAG — Gap Matrix

Updated: 2026-07-22T00:35:00Z

| Capability | Repository evidence | State | Remaining production gap |
|---|---|---|---|
| Governed Source/Document catalog | Feature 067, migration 014, source/document evals | verified_with_limits | Human validation, durable acquisition, real pipeline and deployment |
| Dedicated Search API | Feature 068 `42d2fda`, 24/24 named eval, PostgreSQL/HTTP smoke | verified_with_limits | Real corpus relevance/latency/load, provider operations and human review |
| Dedicated EvidenceBundle API | Feature 068 `42d2fda`, 24/24 named eval, exact replay/corrupt cleanup | verified_with_limits | Real-corpus conflict review, consumer contracts and human resolution workflow |
| Corpus acquisition | Source inventory only; 0 durable bytes and 0 ingested | missing | Rights, durable storage, current scan, immutable manifest and ingestion |
| Retrieval quality | Synthetic fixtures and deterministic provider only | missing_real_evidence | Judged Antigua-first keyword/phrase/semantic/hybrid eval and performance |
| Procedure workflow/case lifecycle | Existing tenant APIs and gates | verified_with_limits | Authenticated human UX, organizational policy and deployment |
| Human authentication/SaaS shell | Architecture notes only | missing | IdP/OIDC/BFF/session, provisioning, cookies/CSRF, recovery and role UI |
| Production object/scanner/dispatcher | Contracts and local gates only | missing | Managed services, workload identity, secrets, scanner updates and operator UI |
| Observability/SLOs | Runbooks/foundations only | missing_operational_evidence | Metrics/traces/logs, alerts, staging exercises and error budgets |
| Load/HA/recovery | Disposable logical restore only | partial | Capacity, failover, coordinated object+DB restore, PITR and RPO/RTO |
| Privacy lifecycle | Documentation foundations | missing_operations | Retention, deletion, legal hold, DSAR and audit evidence |
| Consumer interoperability | Provider contracts only | missing_external_evidence | Version-pinned consumer tests in OS Electoral and Content Agency repos |
| Release | Feature branch published; CI success; no PR | incomplete | CI success, reviewed PR, protected merge, deployment and observation |
