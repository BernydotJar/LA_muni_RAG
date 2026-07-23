# Cloud SQL staging Terraform

This module is plan-only by default. With committed defaults it creates **zero** resources.

It targets PostgreSQL 16 Enterprise with a bounded custom staging tier, SSD storage,
autoresize ceiling, backups, PITR, Query Insights, IAM database authentication,
connector enforcement and deletion protection. `PRIVATE` connectivity is the default.
A reviewed pilot may use `AUTH_PROXY_PUBLIC`; that mode assigns a public endpoint but
configures no authorized networks and must be reached through Cloud SQL Auth Proxy or a
supported language connector.

## Project-specific disabled pilot

`rag-municipalidades.pilot.tfvars.example` records the supplied project ID, project
number, `us-central1`, the Auth Proxy pilot and a proposed USD 5/four-hour envelope. All
approval and billable gates remain disabled. The estimate is not a GCP hard cap and must
be refreshed before any billable plan.

## Safe validation

```bash
npm run eval:gcp-cloudsql-staging
terraform -chdir=infra/gcp/cloudsql-staging fmt -check -recursive
terraform -chdir=infra/gcp/cloudsql-staging init -backend=false
terraform -chdir=infra/gcp/cloudsql-staging validate
```

## Human-gated plan

Copy an example outside version control. Planning resources requires billable-resource
enablement, exact confirmation, billing approval, budget approval, data-residency
approval and a cost-bounded runtime review.

```hcl
allow_billable_resources    = true
billable_confirmation       = "CREATE_LA_MUNI_GCP_STAGING"
billing_approved            = true
budget_approved             = true
data_residency_approved     = true
declared_pilot_budget_usd   = 5
reviewed_hourly_compute_usd = 0.06755
max_pilot_runtime_hours     = 4
```

Repository workflows perform formatting, provider initialization, validation and two
offline plans only. They contain no infrastructure mutation command. A human platform
owner must review current pricing, estimated and non-estimated charges, IAM principals,
state backend, deletion protection and data classification before provisioning.

To intentionally remove deletion protection, a separate reviewed plan must set:

```hcl
allow_destroy        = true
destroy_confirmation = "DESTROY_LA_MUNI_GCP_STAGING"
```

The protection change and any later removal operation are separate human-controlled
steps. Never use this module against production or with unreviewed retention obligations.
