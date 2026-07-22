# GCP infrastructure target

This directory is intentionally non-executable in Feature 071. It records the
approved target without creating a project, enabling billing, downloading a
model, applying Terraform or provisioning a billable resource.

Before infrastructure code is activated, humans must provide:

- GCP organization/project and billing approval;
- region and data-residency decision;
- DNS/domain ownership;
- staging and production budgets;
- workload identity owners;
- approved Cloud SQL size/HA/PITR/RPO/RTO;
- object retention/legal-hold policy;
- public query gateway contract and abuse-control thresholds;
- named security, database, release and incident approvers.

The next infrastructure slice should add Terraform with an explicit
`allow_billable_resources = false` default and CI limited to format/validate and
plan. `terraform apply` must remain outside automated repository workflows.
