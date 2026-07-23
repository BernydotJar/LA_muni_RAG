# Cloud SQL staging Terraform

This module is plan-only by default. With committed defaults it creates **zero** resources.

It targets PostgreSQL 16 Enterprise with a bounded custom staging tier, SSD storage,
autoresize ceiling, backups, PITR, Query Insights, IAM database authentication,
connector enforcement and deletion protection. `PRIVATE` connectivity is the default.
A reviewed pilot may use `AUTH_PROXY_PUBLIC`; that mode assigns a public endpoint but
configures no authorized networks and must be reached through Cloud SQL Auth Proxy or a
supported language connector.

## Safe validation

```bash
terraform -chdir=infra/gcp/cloudsql-staging fmt -check -recursive
terraform -chdir=infra/gcp/cloudsql-staging init -backend=false
terraform -chdir=infra/gcp/cloudsql-staging validate
```

## Human-gated plan

Copy `terraform.tfvars.example` outside version control. Planning resources requires all
five controls: billable-resource enablement, exact confirmation, billing approval,
budget approval and data-residency approval.

```hcl
allow_billable_resources = true
billable_confirmation    = "CREATE_LA_MUNI_GCP_STAGING"
billing_approved         = true
budget_approved          = true
data_residency_approved  = true
```

Repository workflows perform formatting, provider initialization, validation and two
offline plans only. They contain no infrastructure mutation command. A human platform
owner must review the plan, estimated cost, IAM principals, state backend, deletion
protection and data classification before provisioning.

To intentionally remove deletion protection, a separate reviewed plan must set:

```hcl
allow_destroy        = true
destroy_confirmation = "DESTROY_LA_MUNI_GCP_STAGING"
```

The protection change and any later removal operation are separate human-controlled
steps. Never use this module against production or with unreviewed retention obligations.
