import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeCloudSqlProxyUrl,
  buildCloudSqlStagingSummary,
  validateCloudSqlPreflightRows,
} from "../gcp/cloudSqlStaging.js";
import { verifyCloudSqlTerraformPlan } from "../gcp/cloudSqlTerraformPlan.js";

describe("GCP Cloud SQL staging v1", () => {
  it("accepts only loopback PostgreSQL proxy URLs targeting postgres", () => {
    assert.doesNotThrow(() => assertSafeCloudSqlProxyUrl(
      "postgresql://staging_admin:REDACTED@127.0.0.1:5433/postgres"
    ));
    for (const value of [
      "postgresql://staging_admin:REDACTED@cloudsql.example.com:5432/postgres",
      "postgresql://staging_admin:REDACTED@127.0.0.1:5433/application",
      "postgresql://127.0.0.1:5433/postgres",
      "https://staging_admin:REDACTED@127.0.0.1/postgres",
      "postgresql://staging_admin:REDACTED@127.0.0.1:5433/postgres?sslmode=disable",
    ]) assert.throws(() => assertSafeCloudSqlProxyUrl(value));
  });

  it("accepts a Cloud SQL PostgreSQL 16 target with pgvector and admin capabilities", () => {
    assert.deepEqual(validateCloudSqlPreflightRows({
      database_name: "postgres",
      user_name: "staging-admin@example.com",
      version_num: 160014,
      vector_available: true,
      can_admin: true,
      cloudsql_marker: "on",
      unrelated_databases: [],
    }), {
      postgresMajor: 16,
      vectorAvailable: true,
      adminCapabilities: true,
      cloudSqlDetected: true,
      unrelatedDatabases: 0,
    });
  });

  it("fails closed for non-Cloud-SQL, old PostgreSQL, missing vector, weak admin or dirty target", () => {
    const valid = {
      database_name: "postgres",
      user_name: "staging-admin@example.com",
      version_num: 160014,
      vector_available: true,
      can_admin: true,
      cloudsql_marker: "on",
      unrelated_databases: [],
    };
    for (const mutation of [
      { cloudsql_marker: null },
      { version_num: 150014 },
      { vector_available: false },
      { can_admin: false },
      { unrelated_databases: ["shared_app"] },
    ]) assert.throws(() => validateCloudSqlPreflightRows({ ...valid, ...mutation }));
  });

  it("emits a non-sensitive plan-only staging summary", () => {
    const summary = buildCloudSqlStagingSummary({
      projectId: "la-muni-staging-123",
      region: "us-central1",
      instanceName: "la-muni-rag-staging",
      connectionName: "la-muni-staging-123:us-central1:la-muni-rag-staging",
      databaseVersion: "POSTGRES_16",
      connectivityMode: "PRIVATE",
      deletionProtection: true,
    });
    assert.equal(summary.readyForApply, false);
    assert.equal(summary.requiresHumanApproval, true);
    assert.equal(summary.executionMode, "plan_only");
    assert.doesNotMatch(JSON.stringify(summary), /password|token|credential/i);

    const validPlan = {
      resource_changes: [
        {
          address: "google_project_service.sqladmin[0]",
          change: {
            actions: ["create"],
            after: {
              project: "la-muni-staging-123",
              service: "sqladmin.googleapis.com",
              disable_on_destroy: false,
            },
          },
        },
        {
          address: "google_sql_database_instance.staging[0]",
          change: {
            actions: ["create"],
            after: {
              project: "la-muni-staging-123",
              name: "la-muni-rag-staging",
              region: "us-central1",
              database_version: "POSTGRES_16",
              deletion_protection: true,
              root_password: null,
              root_password_wo: null,
              settings: [{
                activation_policy: "ALWAYS",
                availability_type: "ZONAL",
                connector_enforcement: "REQUIRED",
                data_api_access: "DISALLOW_DATA_API",
                deletion_protection_enabled: true,
                disk_autoresize: true,
                disk_autoresize_limit: 100,
                disk_size: 20,
                disk_type: "PD_SSD",
                edition: "ENTERPRISE",
                pricing_plan: "PER_USE",
                tier: "db-custom-1-3840",
                user_labels: {
                  application: "la-muni-rag",
                  environment: "staging",
                  "managed-by": "terraform",
                  "data-class": "synthetic-only",
                  owner: "eduardo-sacahui",
                },
                backup_configuration: [{
                  enabled: true,
                  point_in_time_recovery_enabled: true,
                  start_time: "03:00",
                  transaction_log_retention_days: 3,
                  backup_retention_settings: [{ retained_backups: 7, retention_unit: "COUNT" }],
                }],
                database_flags: [{ name: "cloudsql.iam_authentication", value: "on" }],
                insights_config: [{
                  query_insights_enabled: true,
                  query_string_length: 1024,
                  record_application_tags: true,
                  record_client_address: false,
                }],
                ip_configuration: [{
                  authorized_networks: [],
                  enable_private_path_for_google_cloud_services: false,
                  ipv4_enabled: true,
                  private_network: null,
                  ssl_mode: "ENCRYPTED_ONLY",
                }],
                maintenance_window: [{ day: 7, hour: 6, update_track: "stable" }],
              }],
            },
          },
        },
      ],
      planned_values: {
        outputs: {
          connectivity_mode: { value: "AUTH_PROXY_PUBLIC" },
          declared_pilot_budget_usd: { value: 1 },
          deletion_protection_enabled: { value: true },
          estimated_pilot_compute_usd: { value: 0.351 },
          max_pilot_runtime_hours: { value: 4 },
          resources_enabled: { value: true },
        },
      },
    };
    const expectations = {
      projectId: "la-muni-staging-123",
      ownerLabel: "eduardo-sacahui",
      expectedComputeUsd: 0.351,
    };
    assert.equal(verifyCloudSqlTerraformPlan(validPlan, expectations).status, "valid");
    const missingOwner = structuredClone(validPlan);
    const instanceChange = missingOwner.resource_changes[1];
    assert.ok(instanceChange);
    const instanceSettings = (instanceChange.change.after as { settings: Array<{ user_labels: { owner: string } }> }).settings[0];
    assert.ok(instanceSettings);
    instanceSettings.user_labels.owner = "wrong-owner";
    const rejected = verifyCloudSqlTerraformPlan(missingOwner, expectations);
    assert.equal(rejected.status, "invalid");
    assert.ok(rejected.issues.includes('label owner must be "eduardo-sacahui"'));
  });
});
