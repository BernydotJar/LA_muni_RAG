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
    assert.match(variables, /variable "declared_pilot_budget_usd"[\s\S]*default\s+= 0/);
    assert.match(variables, /variable "reviewed_hourly_compute_usd"[\s\S]*default\s+= 0/);
    assert.match(variables, /variable "max_pilot_runtime_hours"[\s\S]*default\s+= 4/);
    assert.match(main, /estimated_pilot_compute_usd = var\.reviewed_hourly_compute_usd \* var\.max_pilot_runtime_hours/);
    assert.match(main, /pilot_cost_review_complete/);
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
    const [main, workflow, livePlanScript, approvedApplyScript, managedRunScript] = await Promise.all([
      read("infra/gcp/cloudsql-staging/main.tf"),
      read(".github/workflows/gcp-cloudsql-terraform.yml"),
      read("infra/gcp/generate-cloudsql-live-plan.sh"),
      read("infra/gcp/apply-approved-cloudsql-live-plan.sh"),
      read("infra/gcp/run-approved-cloudsql-managed-staging.sh"),
    ]);
    assert.doesNotMatch(main, /google_sql_user|password\s*=|secret_data/i);
    assert.doesNotMatch(workflow, /terraform\s+(?:apply|destroy)/i);
    assert.match(workflow, /default plan created resources/);
    assert.match(workflow, /gcp:cloudsql:verify-plan/);
    assert.ok(workflow.includes('owner\":\"eduardo-sacahui'));
    assert.match(livePlanScript, /set -euo pipefail/);
    assert.match(livePlanScript, /SCRIPT_DIR=.*BASH_SOURCE/);
    assert.match(livePlanScript, /git -C "\$REPO_ROOT" fetch/);
    assert.match(livePlanScript, /-lock-timeout=60s/);
    assert.match(livePlanScript, /verifyGcpCloudSqlPlan\.ts/);
    assert.match(livePlanScript, /-s "\$artifact"/);
    assert.match(livePlanScript, /SHA256SUMS/);
    assert.doesNotMatch(livePlanScript, /^\s*terraform\s+(?:apply|destroy)\b/im);
    const nonEmptyGate = livePlanScript.indexOf('if [[ ! -s "$artifact" ]]');
    const atomicPublish = livePlanScript.indexOf('mv -- "$TMP_DIR" "$artifact_dir"');
    assert.ok(nonEmptyGate >= 0 && atomicPublish > nonEmptyGate, "publish must occur only after non-empty validation");
    assert.match(approvedApplyScript, /FINAL_AUTHORIZATION/);
    assert.match(approvedApplyScript, /2026-07-25 09:00:00/);
    assert.match(approvedApplyScript, /2026-07-25 13:00:00/);
    assert.match(approvedApplyScript, /America\/Guatemala/);
    assert.match(approvedApplyScript, /a9c16848cc89d68ad56de2d1344f3e6e20da0a4faca753a060d9a726aa09fe1e/);
    assert.match(approvedApplyScript, /8e7a01cbc29bbce63c9d05b4a0935765cb6779afd05c7514cb8b7c0d8c0e106a/);
    assert.match(approvedApplyScript, /efd8f22358385c94f49f2edca40d141e38a274cbc10c47c0a7df1694577cc3e2/);
    assert.match(approvedApplyScript, /d6b6a840b05b8ade30e1fca5408ec06d7f4f6ae923607c02b9f819a7baa1adce/);
    assert.match(approvedApplyScript, /diff --quiet "\$PLAN_SOURCE_HEAD\.\.HEAD"/);
    assert.match(approvedApplyScript, /sha256sum -c/);
    assert.match(approvedApplyScript, /state list/);
    assert.match(approvedApplyScript, /No state file was found!/);
    assert.match(approvedApplyScript, /unable to read the remote Terraform state/);
    assert.match(approvedApplyScript, /terraform -chdir="\$MODULE_DIR" apply/);
    assert.match(approvedApplyScript, /-auto-approve/);
    assert.doesNotMatch(approvedApplyScript, /^\s*terraform\s+destroy\b/im);
    assert.match(managedRunScript, /GCP-CLOUDSQL-MANAGED-RUN-20260725-1325-1725-GT/);
    assert.match(managedRunScript, /2026-07-25 13:25:00/);
    assert.match(managedRunScript, /2026-07-25 17:25:00/);
    assert.match(managedRunScript, /less than one hour remains/);
    assert.match(managedRunScript, /activation-policy=ALWAYS/);
    assert.match(managedRunScript, /activation-policy=NEVER/);
    assert.match(managedRunScript, /nohup bash -c/);
    assert.match(managedRunScript, /gcloud sql users create/);
    assert.match(managedRunScript, /gcloud sql users delete/);
    assert.match(managedRunScript, /cloud-sql-proxy\.linux/);
    assert.match(managedRunScript, /sha256sum -c/);
    assert.match(managedRunScript, /GCP_CLOUDSQL_CONFIRM_STAGING=true/);
    assert.match(managedRunScript, /STAGING_CONFIRM_EPHEMERAL=true/);
    assert.match(managedRunScript, /\.cleanup\.databases_destroyed == 4/);
    assert.match(managedRunScript, /\.cleanup\.roles_destroyed == 3/);
    assert.match(managedRunScript, /Managed staging run completed and instance returned to STOPPED/);
    assert.doesNotMatch(managedRunScript, /terraform\s+(?:apply|destroy)/i);
  });

  it("keeps state, plans, tfvars and crash material local", async () => {
    const ignore = await read("infra/gcp/cloudsql-staging/.gitignore");
    for (const marker of [".terraform/", "*.tfstate", "*.tfplan", "*.tfplan.json", "*.tfplan.txt", "plan-artifacts/", "terraform.tfvars", "*.auto.tfvars", "backend.tf", "backend.gcs.hcl", "crash.log"]) {
      assert.ok(ignore.includes(marker), `missing ignore marker ${marker}`);
    }
  });

  it("reuses the exact twenty-journey runner and preserves browser and human gates", async () => {
    const runbook = await read("docs/operations/gcp-cloudsql-staging-runbook.md");
    assert.match(runbook, /npm run staging:run/);
    assert.match(runbook, /20\/20 API\/system journeys/);
    assert.match(runbook, /twelve browser journeys remain blocked/i);
    assert.match(runbook, /Billing Account Administrator access/i);
    assert.match(runbook, /Eduardo Sacahui is the confirmed emergency stop\/teardown owner/i);
    assert.match(runbook, /billable_authorization: consumed for the exact 2026-07-25 bounded pilot; expired on stop/i);
    assert.match(runbook, /authorized plan was applied/i);
    assert.match(runbook, /remote Terraform state and Cloud SQL operation history/i);
    assert.match(runbook, /Budget alerts do not\nstop spend automatically/i);
    assert.match(runbook, /instance now reports `STOPPED` with activation policy\s+`NEVER`/i);
    assert.match(runbook, /Managed synthetic execution and\s+destructive teardown remain pending/i);
    assert.match(runbook, /single-owner exception expired on stop/i);
    assert.match(runbook, /live_monthly_budget_cop: 4000/);
    assert.match(runbook, /bucket-scoped `roles\/storage\.admin`/i);
    assert.match(runbook, /zero resource changes, `resources_enabled=false`/i);
    assert.match(runbook, /2026-07-24 review estimates USD 0\.351/i);
    assert.match(runbook, /-lock-timeout=60s/);
  });
  it("records the supplied project as a disabled cost-bounded pilot", async () => {
    const [pilot, outputs, workflow, pkg, ci] = await Promise.all([
      read("infra/gcp/cloudsql-staging/rag-municipalidades.pilot.tfvars.example"),
      read("infra/gcp/cloudsql-staging/outputs.tf"),
      read(".github/workflows/gcp-cloudsql-terraform.yml"),
      read("package.json"),
      read(".github/workflows/ci.yml"),
    ]);
    assert.match(pilot, /Project number: 1059368783280/);
    assert.match(pilot, /project_id\s+= "rag-municipalidades"/);
    assert.match(pilot, /region\s+= "us-central1"/);
    assert.match(pilot, /connectivity_mode\s+= "AUTH_PROXY_PUBLIC"/);
    assert.match(pilot, /declared_pilot_budget_usd\s+= 1/);
    assert.match(pilot, /owner\s+= "eduardo-sacahui"/);
    assert.match(pilot, /reviewed_hourly_compute_usd\s+= 0\.08775/);
    assert.match(pilot, /max_pilot_runtime_hours\s+= 4/);
    assert.match(pilot, /allow_billable_resources\s+= false/);
    assert.match(outputs, /not a GCP hard spending cap/i);
    assert.match(workflow, /declared_pilot_budget_usd=1/);
    assert.match(workflow, /reviewed_hourly_compute_usd=0\.08775/);
    assert.match(pkg, /eval:gcp-cloudsql-staging/);
    assert.match(pkg, /gcp:cloudsql:preflight/);
    assert.match(pkg, /gcp:cloudsql:verify-plan/);
    assert.ok(workflow.includes('owner\":\"eduardo-sacahui'));
    assert.match(ci, /Run EVAL-GCP-CLOUDSQL-STAGING-001/);
  });

  it("recovers and preserves bucket IAM administration before removing legacy bindings", async () => {
    const bootstrap = await read("infra/gcp/bootstrap-controls.sh");
    assert.match(bootstrap, /DEPLOYMENT_PRINCIPAL is required in --apply mode/);
    assert.match(bootstrap, /placeholders are not accepted/);
    assert.match(bootstrap, /must use user:, serviceAccount: or group:/);
    const principalValidation = bootstrap.indexOf("placeholders are not accepted");
    const cloudAuthentication = bootstrap.indexOf("gcloud auth list");
    assert.ok(principalValidation >= 0 && cloudAuthentication > principalValidation, "principal validation must run before GCP calls");
    assert.match(bootstrap, /Temporarily granting project-level Storage Admin/);
    assert.match(bootstrap, /gcloud projects add-iam-policy-binding[\s\S]*--role=roles\/storage\.admin/);
    assert.match(bootstrap, /gcloud projects remove-iam-policy-binding[\s\S]*--role=roles\/storage\.admin/);
    assert.match(bootstrap, /gcloud storage buckets add-iam-policy-binding[\s\S]*--role=roles\/storage\.admin/);
    assert.doesNotMatch(bootstrap, /roles\/storage\.objectAdmin/);
    assert.match(bootstrap, /for _ in \{1\.\.60\}; do/);
    assert.match(bootstrap, /Waiting for Storage Admin to propagate and establishing bucket-scoped administration/);
    assert.match(bootstrap, /cloudsql-staging\/backend\.tf/);
    assert.match(bootstrap, /backend "gcs"/);
    assert.match(bootstrap, /cloudsql-staging\/backend\.gcs\.hcl/);
    const projectAdmin = bootstrap.indexOf("gcloud projects add-iam-policy-binding");
    const bucketAdmin = bootstrap.indexOf("gcloud storage buckets add-iam-policy-binding");
    const bucketUpdate = bootstrap.indexOf("gcloud storage buckets update");
    const legacyRemoval = bootstrap.indexOf("legacy_bindings=(");
    assert.ok(projectAdmin >= 0 && bucketAdmin > projectAdmin, "project recovery must precede bucket administration");
    assert.ok(bucketUpdate > bucketAdmin, "bucket administration must be established before bucket updates");
    assert.ok(bucketAdmin >= 0 && legacyRemoval > bucketAdmin, "bucket admin must be established before legacy bindings are removed");
    assert.match(bootstrap, /trap cleanup_temporary_project_storage_admin EXIT/);
    assert.match(bootstrap, /cleanup_temporary_project_storage_admin\ntrap - EXIT/);
  });

});
