import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const readMigration = (): Promise<string> => readFile("db/migrations/016_public_query_gateway.sql", "utf8");

describe("public query gateway migration 016", () => {
  it("is transactional and creates a tenant-scoped HMAC rate table", async () => {
    const sql = await readMigration();
    assert.match(sql, /^BEGIN;/);
    assert.match(sql, /COMMIT;\s*$/);
    assert.match(sql, /CREATE TABLE rag\.public_query_rate_limits/);
    assert.match(sql, /client_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /octet_length\(client_key_sha256\) = 32/);
    assert.match(sql, /operation TEXT NOT NULL CHECK \(operation IN \('public_query_client_v1', 'public_query_global_v1'\)\)/);
    assert.match(sql, /FOREIGN KEY \(tenant_id\) REFERENCES identity\.tenants/);
  });

  it("forces RLS with the current tenant on every rate-limit row", async () => {
    const sql = await readMigration();
    assert.match(sql, /ALTER TABLE rag\.public_query_rate_limits ENABLE ROW LEVEL SECURITY/);
    assert.match(sql, /ALTER TABLE rag\.public_query_rate_limits FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /CREATE POLICY public_query_rate_limits_tenant_isolation/);
    assert.match(sql, /USING \(tenant_id = identity\.current_tenant_id\(\)\)/);
    assert.match(sql, /WITH CHECK \(tenant_id = identity\.current_tenant_id\(\)\)/);
  });

  it("does not create a PostgreSQL login role or store raw network identity", async () => {
    const sql = await readMigration();
    assert.doesNotMatch(sql, /CREATE (?:USER|ROLE)/i);
    assert.doesNotMatch(sql, /ip_address|user_agent|query_text|request_body|source_url/i);
    assert.match(sql, /REVOKE ALL ON TABLE rag\.public_query_rate_limits FROM PUBLIC/);
  });
});
