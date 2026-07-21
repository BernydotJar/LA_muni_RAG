import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = new URL("../../db/migrations/008_claim_pack_api.sql", import.meta.url);
const persistencePath = new URL("../api/v1/claimPackPersistence.ts", import.meta.url);
const handlerPath = new URL("../api/v1/claimPackHandler.ts", import.meta.url);

describe("ClaimPack provider persistence and security boundary", () => {
  it("defines dedicated tenant-RLS idempotency and rate state without Content Agency artifacts", async () => {
    const sql = await readFile(migrationPath, "utf8");
    assert.match(sql, /CREATE TABLE integration\.claim_pack_idempotency/);
    assert.match(sql, /CREATE TABLE integration\.claim_pack_rate_limits/);
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/);
    assert.match(sql, /response_status INTEGER CHECK \(response_status = 200\)/);
    assert.match(sql, /response_body TEXT CHECK \(octet_length\(response_body\) <= 4194304\)/);
    assert.match(sql, /claim_pack_idempotency FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /claim_pack_rate_limits FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /tenant_id = identity\.current_tenant_id\(\)/g);
    assert.match(sql, /FOREIGN KEY \(principal_id, tenant_id\)/);
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*claim_pack_idempotency[\s\S]*FROM PUBLIC/);

    const table = sql.match(
      /CREATE TABLE integration\.claim_pack_idempotency \(([\s\S]*?)\n\);/
    )?.[1];
    assert.ok(table);
    assert.doesNotMatch(
      table,
      /request_body|authorization|bearer|credential_secret|content_brief|copy|asset|channel|publication/i
    );
  });

  it("provides a sanitized pre-tenant authentication sink without fake tenant attribution", async () => {
    const sql = await readFile(migrationPath, "utf8");
    const table = sql.match(
      /CREATE TABLE audit\.claim_pack_authentication_failures \(([\s\S]*?)\n\);/
    )?.[1];
    assert.ok(table);
    assert.doesNotMatch(table, /tenant_id|bearer|authorization|body|token|ip_address/i);
    assert.match(sql, /CREATE FUNCTION audit\.record_claim_pack_authentication_failure/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /SET search_path = pg_catalog, audit/);
    assert.match(sql, /UNIQUE \(bucket_started_at, reason_code\)/);
    assert.match(
      sql,
      /failure_count = audit\.claim_pack_authentication_failures\.failure_count \+ 1/
    );
    assert.match(sql, /created_at < statement_timestamp\(\) - interval '30 days'/);
    assert.match(
      sql,
      /REVOKE ALL ON FUNCTION[\s\S]*record_claim_pack_authentication_failure\(UUID, UUID, TEXT\)[\s\S]*FROM PUBLIC/
    );
  });

  it("persists only allowlisted audit details and validates stored replay identity and expiry", async () => {
    const source = await readFile(persistencePath, "utf8");
    const details = source.match(/const details = \{([\s\S]*?)\n    \};/)?.[1];
    assert.ok(details);
    assert.doesNotMatch(
      details,
      /question|facts|case_context|authorization|bearer|response_body|content_brief|copy/i
    );
    assert.match(details, /idempotency_key_sha256/);
    assert.match(source, /record_claim_pack_authentication_failure/);
    assert.match(source, /expires_at <= statement_timestamp\(\)/);
    assert.match(source, /Corrupt ClaimPack replay could not be invalidated/);

    const handler = await readFile(handlerPath, "utf8");
    assert.match(handler, /validUntil <= dependencies\.now\(\)\.getTime\(\)/);
    assert.match(handler, /invalidateCompletedIdempotency/);
    assert.match(handler, /authenticateBearer[\s\S]*readJsonBody/);
    assert.match(handler, /requirePermission\(principal, "integration:query"\)/);
    assert.doesNotMatch(handler, /generated_content|content_calendar|publication_tasks/);
  });
});
