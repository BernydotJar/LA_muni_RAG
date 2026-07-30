# Feature 074 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Accidental cloud spend | critical | zero-resource Terraform default, verified live zero-resource plan, exact phrase, independent approvals, COP 4,000 budget alerts and bounded cost/runtime review | budgets and alerts do not stop spend; a human can still authorize or leave a resource running |
| COP 4,000 treated as a hard cap | critical | docs distinguish the live COP budget from the USD planning envelope; Eduardo Sacahui is the four-hour stop/teardown owner | billing data and notifications may be delayed |
| Stale price estimate | high | reviewed hourly rate is explicit and must be refreshed before a resource-bearing plan | storage, backups, network, taxes and other charges remain outside the compute estimate |
| State-bucket IAM lockout | high | live `--apply`/`--check` recovery established bucket-scoped `roles/storage.admin`, removed legacy bindings and cleaned up the temporary project grant | future IAM changes or interrupted administration can still require recovery from an authorized project owner |
| Excessive state-bucket privilege | high | `roles/storage.admin` is scoped to the dedicated state bucket; project-level recovery grant is temporary | the current operator can administer state objects and bucket IAM; a separate deployment identity remains preferable |
| Single project owner | high | temporary pilot-only governance exception accepted; exact hash-bound plan, 09:00-13:00 Guatemala window, billing controls, deletion protection and named teardown owner | no second approved human IAM principal exists; exception expires at teardown or 13:00 and is invalid for production or later execution |
| Plan metadata drift | high | reusable JSON verifier asserts required owner label and all critical instance controls; plan JSON/text derivatives are ignored | the first exact live plan was rejected because address-only validation did not detect a missing owner label |
| Database exposed to the internet | critical | private IP default; public pilot has no authorized networks and requires connectors | public endpoint metadata exists in pilot mode |
| Shared or production instance targeted | critical | dedicated-instance preflight rejects unrelated databases; runbook forbids production | operator controls the supplied project and instance |
| Credential committed or emitted | critical | IAM auth, no SQL user/password resource, ignored tfvars/state/plans | IAM tokens exist transiently in proxy memory |
| Staging operator remains privileged | high | dedicated IAM user; temporary `cloudsqlsuperuser`; explicit revocation step | revocation is a human operational action |
| Accidental instance removal | critical | Terraform and Cloud SQL deletion protection plus separate exact confirmation | approved protection removal remains destructive |
| Query/document content retained in telemetry | high | no statement-duration flag, client address disabled, minimized review | Query Insights configuration still requires privacy review |
| Synthetic managed staging mistaken for production | critical | ADR/runbook/non-goals and blocked browser journeys | stakeholder interpretation remains a governance risk |
| BigQuery suggested as a drop-in replacement | high | ADR preserves PostgreSQL/RLS/transactional source of truth and treats alternatives as separate architecture work | future cost pressure may reopen the decision without equivalent security evidence |

| Stopped instance retained | high | activation policy is `NEVER`, instance state is `STOPPED`, deletion protection remains enabled | storage, backups and related charges may continue until separately authorized teardown |
