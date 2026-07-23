# Feature 074 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Zero-resource default | `allow_billable_resources`, exact confirmation, approvals and cost review | offline project-specific default plan asserts zero resource changes |
| Narrow approved plan | one API service resource plus one Cloud SQL instance | offline approved plan asserts exact two-address set |
| Supplied project inputs | disabled `rag-municipalidades.pilot.tfvars.example` | hard eval checks project ID, number, region and connectivity |
| Bounded USD 5 pilot | declared budget, reviewed hourly rate and four-hour maximum | offline output estimates USD 0.2702 and remains below declared budget |
| Budget is not a hard cap | output descriptions, ADR, runbook and risk register | static hard eval and documentation review |
| PostgreSQL 16 + pgvector target | pinned instance version and preflight extension check | Terraform validation and preflight unit tests |
| Private-first connectivity | `PRIVATE` default and required VPC self link | hard eval static assertions |
| Safe public pilot | no authorized networks, connector enforcement, proxy-only runbook | hard eval and workflow checks |
| IAM database authentication | Cloud SQL flag plus proxy preflight | hard eval and preflight unit tests |
| Bounded staging storage and recovery | SSD, autoresize ceiling, backups and PITR | Terraform provider validation |
| Deletion safeguards | Terraform/API protection and separate confirmation | hard eval assertions |
| No password/state/plan in Git | no SQL user resource; module-local ignore | hard eval sensitive-material checks |
| Existing journey matrix reused | Feature 073 runner invoked after proxy preflight | runbook and future approved execution receipt |
| Named repository eval | root scripts and Backend CI step | `npm run eval:gcp-cloudsql-staging` |
| No automatic infrastructure mutation | validation-only workflow | workflow hard eval |
