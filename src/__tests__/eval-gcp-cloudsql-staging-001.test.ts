import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-GCP-CLOUDSQL-STAGING-001", () => {
  it("pins Terraform, setup action and Google provider with a committed lock", async () => {
    const [versions, lock, workflow] = await Promise.all([
      read("infra/gcp/cloudsql-staging/versions.tf"),
      read("infra/gcp/cloudsql-staging/.terraform.lock.hcl"),
      read(".github/workflows/gcp-cloudsql-terraform.yml"),
    ]);
    assert.match(versions, /required_version = ">= 1\.15\.0, < 2\.0\.0"/);
    assert.match(versions, /version = "7\.40\.0"/);
    assert.match(lock, /registry\.terraform\.io\/hashicorp\/google/);
    assert.match(lock, /version\s+= "7\.40\.0"/);
    assert.match(workflow, /terraform_version: 1\.15\.8/);
    assert.match(workflow, /hashicorp\/setup-terraform@dfe3c3f87815947d99a8997f908cb6525fc44e9e/);
  });

  it("defaults to zero resources and requires exact confirmation plus three approvals", async () => {
    const [variables, main] = await Promise.all([
      read("infra/gcp/cloudsql-staging/variables.tf"),
      read("infra/gcp/cloudsql-staging/main.tf"),
    ]);
    assert.match(variables, /variable "allow_billable_resources"[\s\S]*default\s+= false/);
    assert.match(variables, /variable "billing_approved"[\s\S]*default\s+= false/);
    assert.match(variables, /variable "budget_approved"[\s\S]*default\s+= false/);
    assert.match(variables, /variable "data_residency_approved"[\s\S]*default\s+= false/);
    assert.match(main, /CREATE_LA_MUNI_GCP_STAGING/);
    assert.match(main, /create_resources\s+= var\.allow_billable_resources && local\.creation_confirmed && local\.approvals_complete/);
    assert.match(main, /count = local\.create_resources \? 1 : 0/g);
  });

  it("keeps private IP as default and public pilot behind connectors without authorized networks", async () => {
    const [variables, main] = await Promise.all([
      read("infra/gcp/cloudsql-staging/variables.tf"),
      read("infra/gcp/cloudsql-staging/main.tf"),
    ]);
    assert.match(variables, /variable "connectivity_mode"[\s\S]*default\s+= "PRIVATE"/);
    assert.match(main, /ipv4_enabled\s+= local\.use_public_proxy/);
    assert.match(main, /private_network\s+= local\.use_private_ip/);
    assert.match(main, /connector_enforcement\s+= "REQUIRED"/);
    assert.doesNotMatch(main, /authorized_networks/);
  });

  it("pins PostgreSQL 16 Enterprise with bounded SSD, backups, PITR and IAM auth", async () => {
    const [variables, main] = await Promise.all([
      read("infra/gcp/cloudsql-staging/variables.tf"),
      read("infra/gcp/cloudsql-staging/main.tf"),
    ]);
    assert.match(variables, /default\s+= "POSTGRES_16"/);
    assert.match(variables, /default\s+= "ENTERPRISE"/);
    assert.match(variables, /default\s+= "db-custom-1-3840"/);
    assert.match(variables, /variable "disk_autoresize_limit_gb"[\s\S]*default\s+= 100/);
    assert.match(main, /point_in_time_recovery_enabled = true/);
    assert.match(main, /cloudsql\.iam_authentication/);
    assert.match(main, /record_client_address\s+= false/);
  });

  it("protects deletion at both Terraform and Cloud SQL layers", async () => {
    const [variables, main] = await Promise.all([
      read("infra/gcp/cloudsql-staging/variables.tf"),
      read("infra/gcp/cloudsql-staging/main.tf"),
    ]);
    assert.match(variables, /variable "allow_destroy"[\s\S]*default\s+= false/);
    assert.match(main, /deletion_protection\s+= !var\.allow_destroy/);
    assert.match(main, /deletion_protection_enabled = !var\.allow_destroy/);
    assert.match(main, /DESTROY_LA_MUNI_GCP_STAGING/);
  });

  it("contains no database user, plaintext password or automated infrastructure mutation", async () => {
    const [main, workflow] = await Promise.all([
      read("infra/gcp/cloudsql-staging/main.tf"),
      read(".github/workflows/gcp-cloudsql-terraform.yml"),
    ]);
    assert.doesNotMatch(main, /google_sql_user|password\s*=|secret_data/i);
    assert.doesNotMatch(workflow, /terraform\s+(?:apply|destroy)/i);
    assert.match(workflow, /default plan created resources/);
    assert.match(workflow, /authorized resource set drift/);
  });

  it("keeps state, plans, tfvars and crash material local", async () => {
    const ignore = await read("infra/gcp/cloudsql-staging/.gitignore");
    for (const marker of [".terraform/", "*.tfstate", "*.tfplan", "terraform.tfvars", "*.auto.tfvars", "crash.log"]) {
      assert.ok(ignore.includes(marker), `missing ignore marker ${marker}`);
    }
  });

  it("reuses the exact twenty-journey runner and preserves browser and human gates", async () => {
    const runbook = await read("docs/operations/gcp-cloudsql-staging-runbook.md");
    assert.match(runbook, /npm run staging:run/);
    assert.match(runbook, /20\/20 API\/system journeys/);
    assert.match(runbook, /twelve browser journeys remain blocked/i);
    assert.match(runbook, /project, billing owner, region, budget and approvers/i);
    assert.match(runbook, /no GCP resource has been created/i);
  });
});
