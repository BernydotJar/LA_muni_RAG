# Feature 066 risk register

| Risk | Severity | Control | Residual limitation |
|---|---:|---|---|
| Named eval launders partial evidence into production readiness | High | Scope-specific status strings and explicit non-proofs | Human release review still required |
| Acquired inventory entry is treated as durable bytes | High | Test confirms bytes absent and zero records ingested | Approved durable object store remains open |
| Missing evidence is hidden by a generic workflow | Critical | Null actor/unit/deadline/system plus explicit blocking gap | Real corpus resolution remains open |
| Role matrix is mistaken for human authentication | High | Separate OIDC/session/provisioning limitation | Human IdP decision remains open |
| Ingestion unit tests hide database defects | Critical | Fresh PostgreSQL/pgvector gates and compiled HTTP smokes | Production topology/load/HA remain open |
