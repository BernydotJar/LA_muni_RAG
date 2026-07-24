# Feature 074 traceability

| Requirement | Implementation | Verification |
|---|---|---|
| Zero-resource default | `allow_billable_resources`, exact confirmation, approvals and cost review | offline project-specific default plan asserts zero resource changes |
| Narrow approved plan | one API service resource plus one Cloud SQL instance | offline approved plan asserts exact two-address set |
| Supplied project inputs | disabled `rag-municipalidades.pilot.tfvars.example` | hard eval checks project ID, number, region and connectivity |
| Bounded pilot | USD 1 Terraform planning envelope, COP 4,000 live budget, reviewed hourly rate and four-hour maximum | offline output estimates USD 0.2702; authenticated Cloud Shell verifies the recurring budget and thresholds |
| Named emergency operator | non-sensitive owner label plus out-of-repository contact handling | `owner=eduardo-sacahui`; runbook names Eduardo Sacahui without publishing personal contact data |
| Live billing and alerts | guarded Cloud Shell bootstrap and exact budget verification | linked COP account, Billing Account Administrator and 50/90/100 current-spend alerts observed out of band |
| Live residency | effective `constraints/gcp.resourceLocations` check | `allValues: ALLOW`; `us-central1` permitted |
| Protected Terraform state | dedicated GCS bucket, PAP, UBLA, versioning, soft delete and labels | bucket properties observed; IAM recovery commit `ce01163` must still complete successfully |
| Bucket IAM recovery | temporary project-level Storage Admin only on lockout, bucket-scoped Storage Admin before legacy cleanup, exit-trap cleanup | static hard eval plus required live rerun |
| Owner redundancy | owner enumeration and warning | one owner observed; second-owner decision remains human-gated |
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
