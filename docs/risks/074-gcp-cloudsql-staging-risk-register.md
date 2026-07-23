# Feature 074 risk register

| Risk | Severity | Control | Residual limitation |
|---|---|---|---|
| Accidental cloud spend | critical | zero-resource default, exact phrase and three independent approvals | a human can still approve an expensive plan |
| Database exposed to the internet | critical | private IP default; public pilot has no authorized networks and requires connectors | public endpoint metadata exists in pilot mode |
| Shared or production instance targeted | critical | dedicated-instance preflight rejects unrelated databases; runbook forbids production | operator controls the supplied project/instance |
| Credential committed or emitted | critical | IAM auth, no SQL user/password resource, ignored tfvars/state/plans | IAM token exists transiently in proxy memory |
| Staging operator remains privileged | high | dedicated IAM user; temporary `cloudsqlsuperuser`; explicit revocation step | revocation is a human operational action |
| Accidental instance removal | critical | Terraform and Cloud SQL deletion protection plus separate exact confirmation | approved protection removal remains destructive |
| Query/document content retained in telemetry | high | no statement-duration flag, client address disabled, minimized review | Query Insights configuration still requires privacy review |
| Synthetic managed staging mistaken for production | critical | ADR/runbook/non-goals and blocked browser journeys | stakeholder interpretation remains a governance risk |
| Cost or performance overclaim | high | no resource creation in this slice; actual cost/runtime recorded only after approved run | offline plans do not estimate final invoice or performance |
