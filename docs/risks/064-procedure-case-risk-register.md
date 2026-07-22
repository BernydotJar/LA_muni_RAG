# Feature 064 risk register

| Risk | Severity | Control | Residual limitation |
|---|---:|---|---|
| Case completion is mistaken for legal compliance | High | Closed schema, explicit limitations and no legal-status field | Human training and legal review remain required |
| Cross-tenant case exposure | Critical | Credential tenant binding, composite FKs, forced RLS, uniform 404 and runtime gate | Production topology still requires staging proof |
| Duplicate cases under concurrent keys | High | Advisory transaction lock, canonical request hash, unique aggregate identity and sealed acknowledgement | Load testing remains open |
| Opaque document ID credited as evidence | High | Tenant document-version FK required for received/reviewed | Human content validation remains required |
| Audit copies private notes | High | Action allowlist; note length only; no blocker description in audit details | Main case text needs approved retention policy |
| Transport replay corruption | High | Exact hash plus immutable aggregate acknowledgement | Storage monitoring and repair runbook remain open |
| Unauthorized validation | High | `procedure:review` separate from `case:write` | Human identity/session system remains open |
