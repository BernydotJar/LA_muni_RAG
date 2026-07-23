# Feature 074 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Accidental cloud spend | critical | zero-resource default, exact phrase, independent approvals and bounded cost/runtime review | a human can still approve or leave running an expensive resource |
| USD 5 treated as a hard cap | critical | docs and outputs state that budgets/estimates are planning controls; four-hour stop/teardown owner required | GCP billing and alerts may be delayed and do not automatically stop spend |
| Stale price estimate | high | reviewed hourly rate is explicit and must be refreshed before a resource-bearing plan | taxes, storage, backups and network remain outside the compute estimate |
| Database exposed to the internet | critical | private IP default; public pilot has no authorized networks and requires connectors | public endpoint metadata exists in pilot mode |
| Shared or production instance targeted | critical | dedicated-instance preflight rejects unrelated databases; runbook forbids production | operator controls the supplied project/instance |
| Credential committed or emitted | critical | IAM auth, no SQL user/password resource, ignored tfvars/state/plans | IAM token exists transiently in proxy memory |
| Staging operator remains privileged | high | dedicated IAM user; temporary `cloudsqlsuperuser`; explicit revocation step | revocation is a human operational action |
| Accidental instance removal | critical | Terraform and Cloud SQL deletion protection plus separate exact confirmation | approved protection removal remains destructive |
| Query/document content retained in telemetry | high | no statement-duration flag, client address disabled, minimized review | Query Insights configuration still requires privacy review |
| Synthetic managed staging mistaken for production | critical | ADR/runbook/non-goals and blocked browser journeys | stakeholder interpretation remains a governance risk |
| BigQuery suggested as a drop-in replacement | high | ADR preserves PostgreSQL/RLS/transactional source of truth and treats alternatives as separate architecture work | future cost pressure may reopen the decision without equivalent security evidence |
