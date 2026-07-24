import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeCloudSqlProxyUrl,
  buildCloudSqlStagingSummary,
  validateCloudSqlPreflightRows,
} from "../gcp/cloudSqlStaging.js";

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
  });
});
