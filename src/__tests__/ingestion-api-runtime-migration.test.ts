import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../../db/migrations/006_ingestion_api_runtime.sql",
  import.meta.url
);
const migration = await readFile(migrationUrl, "utf8");

describe("ingestion API runtime migration", () => {
  it("adds bounded tenant/principal rate state with forced row security", () => {
    assert.match(migration, /CREATE TABLE integration\.ingestion_api_rate_limits/i);
    assert.match(migration, /ingestion_job_enqueue_v1/);
    assert.match(migration, /ingestion_job_get_v1/);
    assert.match(
      migration,
      /ALTER TABLE integration\.ingestion_api_rate_limits FORCE ROW LEVEL SECURITY/i
    );
    assert.match(
      migration,
      /WITH CHECK \(tenant_id = identity\.current_tenant_id\(\)\)/i
    );
    assert.match(
      migration,
      /REVOKE ALL ON TABLE integration\.ingestion_api_rate_limits FROM PUBLIC/i
    );
  });

  it("keeps pre-tenant authentication failures in a narrow unreadable aggregate", () => {
    assert.match(migration, /CREATE TABLE audit\.ingestion_authentication_failures/i);
    assert.match(migration, /route = '\/api\/v1\/ingestion-jobs'/i);
    assert.match(migration, /identity\.authentication_failed/i);
    assert.match(migration, /credential_rejected/);
    assert.match(migration, /authentication_dependency_failure/);
    assert.match(
      migration,
      /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog, audit/i
    );
    assert.match(
      migration,
      /REVOKE ALL ON FUNCTION audit\.record_ingestion_authentication_failure\(UUID, UUID, TEXT\)[\s\S]*FROM PUBLIC/i
    );
  });

  it("does not persist raw request, credential, artifact, idempotency, worker, or lease material", () => {
    const tableDefinitions = migration.match(
      /CREATE TABLE integration\.ingestion_api_rate_limits[\s\S]*?;[\s\S]*?CREATE TABLE audit\.ingestion_authentication_failures[\s\S]*?;/i
    )?.[0] ?? "";
    assert.doesNotMatch(
      tableDefinitions,
      /bearer|authorization|request_body|artifact_bytes|idempotency_key|worker_id|lease_token/i
    );
  });
});
