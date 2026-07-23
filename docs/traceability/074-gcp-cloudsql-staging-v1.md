# Feature 074 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Zero-resource default | `allow_billable_resources`, exact confirmation and three approvals | offline default plan asserts zero resource changes |
| Narrow approved plan | one API service resource plus one Cloud SQL instance | offline approved plan asserts exact two-address set |
| PostgreSQL 16 + pgvector target | pinned instance version and preflight extension check | Terraform validation and preflight unit tests |
| Private-first connectivity | `PRIVATE` default and required VPC self link | hard eval static assertions |
| Safe public pilot | no authorized networks, connector enforcement, proxy-only runbook | hard eval and workflow checks |
| IAM database authentication | Cloud SQL flag plus proxy preflight | hard eval and preflight unit tests |
| Bounded staging storage and recovery | SSD, autoresize ceiling, backups and PITR | Terraform provider validation |
| Deletion safeguards | Terraform/API protection and separate confirmation | hard eval assertions |
| No password/state/plan in Git | no SQL user resource; module-local ignore | hard eval sensitive-material checks |
| Existing journey matrix reused | Feature 073 runner invoked after proxy preflight | runbook and future approved execution receipt |
| No automatic infrastructure mutation | validation-only workflow | workflow hard eval |
| Human spending/region gate | billing, budget and residency attestations | zero/approved plan boundary tests |
