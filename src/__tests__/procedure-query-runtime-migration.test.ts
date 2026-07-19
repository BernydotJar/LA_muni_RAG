import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = new URL("../../db/migrations/004_procedure_query_api.sql", import.meta.url);
const persistencePath = new URL("../api/v1/persistence.ts", import.meta.url);

describe("procedure query runtime persistence migration", () => {
  it("defines tenant-RLS idempotency and rate-limit state with digest-only request identity", async () => {
    const sql = await readFile(migrationPath, "utf8");
    assert.match(sql, /CREATE TABLE integration\.procedure_query_idempotency/);
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/);
    assert.match(sql, /blocked_audit_id UUID/);
    assert.match(sql, /metadata ->> 'seed_batch' = 'core_documents_v1'/);
    assert.match(sql, /jsonb_set\(metadata, '\{confidentiality\}', '"public"'::jsonb/);
    assert.match(sql, /response_body TEXT/);
    assert.match(sql, /response_status INTEGER CHECK \(response_status = 200\)/);
    assert.doesNotMatch(sql, /\n\s*(?:raw_)?request_body\s+/i);
    assert.doesNotMatch(sql, /\n\s*(?:bearer|authorization|credential_secret)\s+/i);
    assert.match(sql, /procedure_query_idempotency FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /procedure_query_rate_limits FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /tenant_id = identity\.current_tenant_id\(\)/g);
    assert.match(sql, /FOREIGN KEY \(principal_id, tenant_id\)/);
    const persistence = await readFile(persistencePath, "utf8");
    assert.match(persistence, /blocked_audit_id = CASE/);
    assert.match(persistence, /blocked_audit_id = \$6::uuid AS should_audit/);
    assert.match(persistence, /DELETE_OLD_RATE_LIMITS_SQL/);
    assert.match(persistence, /COMPLETE_IDEMPOTENCY_SQL[\s\S]*RETURNING audit_id/);
    assert.match(persistence, /Idempotency completion did not update the reserved claim/);
    assert.match(persistence, /Corrupt idempotency replay could not be invalidated/);
    assert.match(
      persistence,
      /expires_at <= statement_timestamp\(\)[\s\S]*keyValues\.slice\(0, 3\)/
    );
  });

  it("provides a real sanitized pre-tenant auth-failure sink without fake tenant attribution", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const table = sql.match(
      /CREATE TABLE audit\.authentication_failures \(([\s\S]*?)\n\);/
    )?.[1];
    assert.ok(table);
    assert.doesNotMatch(table, /tenant_id/i);
    assert.doesNotMatch(table, /bearer|authorization|body|token|ip_address/i);
    assert.match(sql, /CREATE FUNCTION audit\.record_authentication_failure/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /SET search_path = pg_catalog, audit/);
    assert.match(sql, /RETURNS UUID/);
    assert.match(sql, /UNIQUE \(bucket_started_at, reason_code\)/);
    assert.match(sql, /failure_count = audit\.authentication_failures\.failure_count \+ 1/);
    assert.match(sql, /created_at < statement_timestamp\(\) - interval '30 days'/);
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION audit\.record_authentication_failure\(UUID, UUID, TEXT\) FROM PUBLIC/
    );
    assert.match(sql, /reason_code IN \('credential_rejected', 'authentication_dependency_failure'\)/);
  });

  it("persists only allowlisted audit detail fields and calls the sanitized auth function", async () => {
    const source = await readFile(persistencePath, "utf8");
    const details = source.match(/const details = \{([\s\S]*?)\n    \};/)?.[1];
    assert.ok(details);
    assert.doesNotMatch(details, /question|facts|case_context|authorization|bearer|response_body/i);
    assert.match(details, /idempotency_key_sha256/);
    assert.match(source, /audit\.record_authentication_failure/);
  });
});
