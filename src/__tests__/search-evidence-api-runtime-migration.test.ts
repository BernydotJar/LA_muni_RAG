import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationPath = new URL("../../db/migrations/015_search_evidence_api.sql", import.meta.url);
const migration = async (): Promise<string> => readFile(migrationPath, "utf8");

describe("search and evidence API runtime migration", () => {
  it("stores digest-only EvidenceBundle replay under forced tenant RLS", async () => {
    const sql = await migration();
    assert.match(sql, /^BEGIN;/m);
    assert.match(sql, /CREATE TABLE rag\.search_evidence_api_idempotency/);
    assert.match(sql, /operation TEXT NOT NULL CHECK \(operation = 'evidence_bundle_create_v1'\)/);
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/);
    assert.match(sql, /response_sha256 BYTEA/);
    assert.match(sql, /ALTER TABLE rag\.search_evidence_api_idempotency FORCE ROW LEVEL SECURITY/);
    assert.match(sql, /CREATE POLICY search_evidence_api_idempotency_tenant_isolation/);
    assert.doesNotMatch(sql, /idempotency_key TEXT|authorization_header|bearer_token|raw_request/i);
  });

  it("bounds search and bundle rate state without storing query text", async () => {
    const sql = await migration();
    assert.match(sql, /CREATE TABLE rag\.search_evidence_api_rate_limits/);
    assert.match(sql, /operation IN \('search_v1', 'evidence_bundle_create_v1'\)/);
    assert.match(sql, /request_count INTEGER NOT NULL DEFAULT 1/);
    assert.match(sql, /CHECK \(request_count BETWEEN 1 AND 1000000\)/);
    assert.match(sql, /ALTER TABLE rag\.search_evidence_api_rate_limits FORCE ROW LEVEL SECURITY/);
    assert.doesNotMatch(sql, /query_text|request_body|response_headers/i);
  });

  it("minimizes unauthenticated failure persistence", async () => {
    const sql = await migration();
    assert.match(sql, /CREATE TABLE identity\.search_evidence_auth_failure_buckets/);
    assert.match(sql, /CREATE OR REPLACE FUNCTION identity\.record_search_evidence_auth_failure/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /REVOKE ALL ON FUNCTION identity\.record_search_evidence_auth_failure/);
    assert.doesNotMatch(sql, /remote_addr|user_agent|authorization/i);
  });

  it("revokes public access and commits atomically", async () => {
    const sql = await migration();
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*rag\.search_evidence_api_idempotency[\s\S]*FROM PUBLIC/);
    assert.match(sql, /REVOKE ALL ON TABLE[\s\S]*rag\.search_evidence_api_rate_limits[\s\S]*FROM PUBLIC/);
    assert.match(sql, /COMMIT;\s*$/);
  });
});
