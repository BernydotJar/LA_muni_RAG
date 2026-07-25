# Feature 074 traceability

| Requirement | Implementation | Verification |
| Live apply and bounded stop | exact four-hash authorization plus fail-closed applicator and manual stop control | remote state contains exactly two approved addresses; CREATE, BACKUP_VOLUME and stop UPDATE completed; final state `STOPPED` with activation policy `NEVER` |
|---|---|---|
| Zero-resource default | `allow_billable_resources`, exact confirmation, approvals and cost review | offline project-specific default plan asserts zero resource changes |
| Narrow approved plan | one API service resource plus one Cloud SQL instance and reusable JSON verifier | corrected live plan from `e7c4393b0655` passed exact create-only address, region, tier, transport, IAM auth, backup, deletion-protection, label and output checks |
| Supplied project inputs | disabled `rag-municipalidades.pilot.tfvars.example` | hard eval checks project ID, number, region and connectivity |
| Bounded pilot | USD 1 Terraform planning envelope, COP 4,000 live budget, reviewed hourly rate and four-hour maximum | official 2026-07-24 review: USD 0.08775/hour compute+memory, USD 0.351 for four hours, and USD 0.38826024 including 20 GiB SSD before backups/network/taxes |
| Named emergency operator | non-sensitive owner label plus out-of-repository contact handling | first plan was rejected; corrected immutable plan includes `owner=eduardo-sacahui` and passed the reusable verifier |
| Live billing and alerts | guarded Cloud Shell bootstrap and exact budget verification | linked COP account, Billing Account Administrator and 50/90/100 current-spend alerts observed out of band |
| Live residency | effective `constraints/gcp.resourceLocations` check | `allValues: ALLOW`; `us-central1` permitted |
| Protected Terraform state | dedicated GCS bucket, PAP, UBLA, versioning, soft delete, labels and externalized backend configuration | live bucket properties verified; bootstrap generates ignored `backend.tf` and `backend.gcs.hcl` files |
| Live zero-resource plan | authenticated backend initialization with committed billable gates disabled | Terraform 1.15.8 plan reported zero resource changes and `resources_enabled=false`; plan artifacts removed |
| Bucket IAM recovery | temporary project-level Storage Admin only on lockout, propagation retry, bucket-scoped Storage Admin before legacy cleanup, exit-trap cleanup | authenticated `--apply` and `--check` both succeeded; final policy has no legacy bindings |
| Owner redundancy | owner enumeration, warning and scoped exception record | one owner observed; temporary pilot-only exception accepted through teardown or 2026-07-25 13:00 America/Guatemala |
| Budget is not a hard cap | output descriptions, ADR, runbook and risk register | static hard eval and documentation review |
| PostgreSQL 16 + pgvector target | pinned instance version and preflight extension check | Terraform validation and preflight unit tests |
| Private-first connectivity | `PRIVATE` default and required VPC self link | hard eval static assertions |
| Safe public pilot | no authorized networks, connector enforcement, proxy-only runbook | hard eval and workflow checks |
| IAM database authentication | Cloud SQL flag plus proxy preflight | hard eval and preflight unit tests |
| Bounded staging storage and recovery | SSD, autoresize ceiling, backups and PITR | Terraform provider validation |
| Deletion safeguards | Terraform/API protection and separate confirmation | hard eval assertions |
| No password/state/plan in Git | no SQL user resource; module-local ignore covers binary plans and JSON/text derivatives | hard eval sensitive-material checks |
| Existing journey matrix reused | Feature 073 runner invoked after proxy preflight | runbook and future approved execution receipt |
| Named repository eval | root scripts and Backend CI step | `npm run eval:gcp-cloudsql-staging` |
| Exact human-gated mutation | one manually invoked applicator bound to four hashes, plan source commit and closed time window | static hard eval asserts phrase, hashes, time window, state/module drift checks and exact saved-plan apply |
| No automatic infrastructure mutation | validation-only workflow; applicator is never invoked by CI | workflow hard eval |
