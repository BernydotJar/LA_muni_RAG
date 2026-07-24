# Feature 074 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Accidental cloud spend | critical | zero-resource Terraform default, exact phrase, independent approvals, COP 4,000 budget alerts and bounded cost/runtime review | budgets and alerts do not stop spend; a human can still leave a resource running |
| COP 4,000 treated as a hard cap | critical | docs distinguish the live COP budget from the USD planning envelope; Eduardo Sacahui is the four-hour stop/teardown owner | billing data and notifications may be delayed |
| Stale price estimate | high | reviewed hourly rate is explicit and must be refreshed before a resource-bearing plan | storage, backups, network, taxes and other charges remain outside the compute estimate |
| State-bucket IAM lockout | high | recovery establishes bucket-scoped `roles/storage.admin` before legacy bindings are removed; temporary project grant is cleaned up with an exit trap | IAM propagation or interrupted recovery can require a rerun from an authorized project owner |
| Excessive state-bucket privilege | high | `roles/storage.admin` is scoped to the dedicated state bucket; project-level recovery grant is temporary | the current operator can administer state objects and bucket IAM; a separate deployment identity remains preferable |
| Single project owner | high | bootstrap enumerates owners and warns when fewer than two exist | no second appropriate human principal has been supplied or approved |
| Database exposed to the internet | critical | private IP default; public pilot has no authorized networks and requires connectors | public endpoint metadata exists in pilot mode |
| Shared or production instance targeted | critical | dedicated-instance preflight rejects unrelated databases; runbook forbids production | operator controls the supplied project and instance |
| Credential committed or emitted | critical | IAM auth, no SQL user/password resource, ignored tfvars/state/plans | IAM tokens exist transiently in proxy memory |
| Staging operator remains privileged | high | dedicated IAM user; temporary `cloudsqlsuperuser`; explicit revocation step | revocation is a human operational action |
| Accidental instance removal | critical | Terraform and Cloud SQL deletion protection plus separate exact confirmation | approved protection removal remains destructive |
| Query/document content retained in telemetry | high | no statement-duration flag, client address disabled, minimized review | Query Insights configuration still requires privacy review |
| Synthetic managed staging mistaken for production | critical | ADR/runbook/non-goals and blocked browser journeys | stakeholder interpretation remains a governance risk |
| BigQuery suggested as a drop-in replacement | high | ADR preserves PostgreSQL/RLS/transactional source of truth and treats alternatives as separate architecture work | future cost pressure may reopen the decision without equivalent security evidence |
