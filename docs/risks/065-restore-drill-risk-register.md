# Feature 065 risk register

| Risk | Severity | Control | Residual limitation |
|---|---:|---|---|
| Restore overwrites active data | Critical | Distinct service aliases; target must be empty; no `--clean` | Production provisioning/approval remains human-gated |
| Backup artifact leaks data | Critical | `umask 077`, files `0600`, directory `0700`, no Git artifact | Approved encrypted remote destination remains absent |
| Corrupt/incomplete backup accepted | High | SHA-256, manifest inspection, transactional restore, catalog/data comparison | Physical/PITR corruption not covered |
| Restored ACLs grant excess access | Critical | `--no-owner --no-acl`; reviewed post-restore grants | Production IAM/provisioning not exercised |
| Forced RLS lost | Critical | Catalog fingerprint plus restored runtime RLS/cross-tenant gate | Full production topology not exercised |
| Hashing is too expensive at scale | Medium | Configured bounded deep-hash threshold | Large-corpus load/capacity test remains open |
| Database-only recovery appears complete | High | Result hard-codes object/PITR/RPO/RTO/human review false | Object recovery and staging drill remain open |
