import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = new URL("../../db/migrations/014_catalog_api.sql", import.meta.url);

const migration = async (): Promise<string> => readFile(migrationPath, "utf8");

describe("catalog API runtime migration", () => {
  it("creates tenant-owned unreviewed sources and prevents client authority promotion", async () => {
    const sql = await migration();
    assert.match(sql, /^BEGIN;/m);
    assert.match(sql, /CREATE TABLE rag\.sources/);
    assert.match(sql, /validation_state TEXT NOT NULL DEFAULT 'unreviewed'/);
    assert.match(sql, /official_source BOOLEAN NOT NULL DEFAULT false/);
    assert.match(sql, /official_for_target_jurisdiction BOOLEAN NOT NULL DEFAULT false/);
    assert.match(sql, /acquisition_state TEXT NOT NULL DEFAULT 'not_acquired'/);
    assert.match(sql, /ingestion_state TEXT NOT NULL DEFAULT 'not_ingested'/);
    assert.match(sql, /retrieval_state TEXT NOT NULL DEFAULT 'not_indexed'/);
    assert.match(sql, /CHECK \(NOT official_for_target_jurisdiction OR official_source\)/);
    assert.match(sql, /CHECK \(validation_state = 'validated' OR NOT official_source\)/);
    assert.match(sql, /ALTER TABLE rag\.sources FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /CREATE POLICY sources_tenant_isolation/);
  });

  it("binds documents to tenant sources without accepting artifact or scan claims", async () => {
    const sql = await migration();
    assert.match(sql, /ALTER TABLE rag\.documents\s+ALTER COLUMN status SET DEFAULT 'draft'/);
    assert.match(sql, /ALTER TABLE rag\.documents\s+ADD COLUMN source_id UUID/);
    assert.match(sql, /ADD COLUMN confidentiality TEXT NOT NULL DEFAULT 'internal'/);
    assert.match(sql, /ADD COLUMN registered_by_principal_id UUID/);
    assert.match(sql, /documents_source_tenant_fk/);
    assert.match(sql, /documents_registered_principal_tenant_fk/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION rag\.bind_catalog_document_source/);
    assert.match(sql, /NEW\.official_source := inherited_official/);
    assert.match(sql, /NEW\.status := 'draft'::rag\.document_status/);
    assert.doesNotMatch(sql, /ALTER TABLE rag\.artifact_objects.*DISABLE ROW LEVEL SECURITY/is);
    assert.match(sql, /documents_public_source_url_chk/);
    assert.match(sql, /document_versions_public_source_url_chk/);
    assert.match(sql, /access_token\|token\|sig\|signature\|x-amz-/);
    assert.doesNotMatch(sql, /signed_url|lease_token\s+TEXT|fencing_token\s+TEXT/i);
  });

  it("stores digest-only replay, bounded rate state and minimized auth failures", async () => {
    const sql = await migration();
    assert.match(sql, /CREATE TABLE rag\.catalog_api_idempotency/);
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/);
    assert.match(sql, /response_sha256 BYTEA/);
    assert.match(sql, /response_body TEXT/);
    assert.match(sql, /CREATE TABLE rag\.catalog_api_rate_limits/);
    assert.match(sql, /CHECK \(request_count BETWEEN 1 AND 1000000\)/);
    assert.match(sql, /CREATE TABLE identity\.catalog_auth_failure_buckets/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION identity\.record_catalog_auth_failure/);
    assert.match(sql, /REVOKE ALL ON FUNCTION identity\.record_catalog_auth_failure/);
    assert.doesNotMatch(sql, /authorization_header|bearer_token|raw_request|idempotency_key TEXT/i);
  });

  it("keeps all catalog persistence forced-RLS and public-revoked", async () => {
    const sql = await migration();
    for (const table of ["sources", "catalog_api_idempotency", "catalog_api_rate_limits"]) {
      assert.match(sql, new RegExp(`ALTER TABLE rag\\.${table} ENABLE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`ALTER TABLE rag\\.${table} FORCE ROW LEVEL SECURITY`));
    }
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*rag\.sources[\s\S]*FROM PUBLIC/);
    assert.match(sql, /COMMIT;\s*$/);
  });
});
