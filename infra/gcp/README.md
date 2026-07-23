# GCP infrastructure target

No GCP project, billing account or resource has been created by this repository.
Infrastructure creation, spending, DNS and deployment remain human-gated.

This plan records the target without creating a project, enabling billing, applying
Terraform or provisioning a billable resource.

`terraform apply` remains outside automated repository workflows and requires a
separate human authorization.

## Current plan-only slice

`cloudsql-staging/` defines a guarded PostgreSQL 16 Enterprise target. Its committed
defaults produce zero resources, while CI validates the default plan and an exact
approved shape consisting only of SQL Admin API enablement and one protected instance.

The supplied project inputs are recorded in a disabled example:

```text
project_id: rag-municipalidades
project_number: 1059368783280
region: us-central1
connectivity: AUTH_PROXY_PUBLIC pilot
proposed_budget: USD 5 for a maximum four-hour pilot
```

Supplying those values is not billing approval or spend authorization. The current tier
would exceed USD 5 if left running for a month, so persistent staging is not approved.
The cost gate is a planning control; GCP budget alerts are not a hard cap.

Before any billable plan or provisioning action, humans must still approve billing,
budget/alerts, residency, IAM owners, state backend, stop/teardown ownership, retention,
PITR, incident response and synthetic-only data classification.

Cloud Run, Cloud Storage, queues, Secret Manager, Artifact Registry, edge controls and
observability remain architecture targets only and are not created by Feature 074.
