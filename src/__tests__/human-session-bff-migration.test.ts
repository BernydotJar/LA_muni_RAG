import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const readMigration = (): Promise<string> =>
  readFile("db/migrations/017_human_session_bff.sql", "utf8");

const readRuntimeGate = (): Promise<string> =>
  readFile("db/tests/human_session_bff_runtime_gate.sql", "utf8");

describe("human session BFF migration 017", () => {
  it("is transactional and keeps human identity separate from API credentials", async () => {
    const sql = await readMigration();
    assert.match(sql, /^-- LA Muni RAG[\s\S]*\nBEGIN;/);
    assert.match(sql, /COMMIT;\s*$/);
    assert.match(sql, /CREATE TABLE identity\.human_subjects/);
    assert.match(sql, /CREATE TABLE identity\.human_login_transactions/);
    assert.match(sql, /CREATE TABLE identity\.human_authorization_code_claims/);
    assert.match(sql, /CREATE TABLE identity\.human_sessions/);
    assert.doesNotMatch(sql, /ALTER TABLE identity\.api_credentials/);
    assert.doesNotMatch(sql, /CREATE (?:USER|ROLE)/i);
  });

  it("stores only digests or protected login material", async () => {
    const sql = await readMigration();
    for (const digest of [
      "issuer_sha256",
      "subject_sha256",
      "state_sha256",
      "browser_binding_sha256",
      "code_sha256",
      "session_token_sha256",
      "csrf_sha256",
    ]) {
      assert.match(sql, new RegExp(`${digest} BYTEA`));
      assert.match(sql, new RegExp(`octet_length\\(${digest}\\) = 32`));
    }
    assert.match(sql, /protected_challenge TEXT NOT NULL/);
    assert.doesNotMatch(sql, /email|display_name|access_token|refresh_token|id_token|raw_cookie/i);
  });

  it("forces RLS on tenant-owned subjects and sessions", async () => {
    const sql = await readMigration();
    for (const table of ["human_subjects", "human_sessions"]) {
      assert.match(sql, new RegExp(`ALTER TABLE identity\\.${table} ENABLE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`ALTER TABLE identity\\.${table} FORCE ROW LEVEL SECURITY`));
      assert.match(sql, new RegExp(`${table}_tenant_isolation`));
    }
    assert.match(sql, /tenant_id = identity\.current_tenant_id\(\)/);
  });

  it("implements atomic state, code, rotation, revocation, and local membership functions", async () => {
    const sql = await readMigration();
    for (const functionName of [
      "consume_human_login_transaction",
      "claim_human_authorization_code",
      "resolve_human_membership",
      "create_human_session",
      "authenticate_human_session",
      "rotate_human_session",
      "revoke_human_session",
    ]) {
      assert.match(sql, new RegExp(`CREATE FUNCTION identity\\.${functionName}`));
      assert.match(sql, new RegExp(`REVOKE ALL ON FUNCTION identity\\.${functionName}`));
    }
    assert.match(sql, /principal\.principal_kind = 'user'/);
    assert.match(sql, /array_agg\(membership\.role::text/);
    assert.match(sql, /FOR UPDATE/);
    assert.match(sql, /replaced_by_session_id/);
  });

  it("minimizes audit and pre-tenant failure state", async () => {
    const sql = await readMigration();
    assert.match(sql, /CREATE FUNCTION identity\.record_human_session_audit/);
    assert.match(sql, /CREATE FUNCTION identity\.record_human_auth_failure/);
    assert.match(sql, /jsonb_build_object\([\s\S]*'reasonCode'[\s\S]*'requestId'[\s\S]*'sessionId'/);
    assert.match(sql, /human_auth_failure_buckets/);
    const auditFunction = sql.slice(
      sql.indexOf("CREATE FUNCTION identity.record_human_session_audit"),
      sql.indexOf("CREATE FUNCTION identity.record_human_auth_failure")
    );
    assert.match(
      auditFunction,
      /jsonb_build_object\(\s*'reasonCode', requested_reason_code,\s*'requestId', requested_request_id::text,\s*'sessionId', requested_session_id::text\s*\)/
    );
    assert.doesNotMatch(
      auditFunction,
      /requested_(?:authorization_code|session_token|csrf|issuer|subject|protected_challenge)/i
    );
  });

  it("has a non-owner executable runtime gate for replay, RLS, rotation and leakage", async () => {
    const gate = await readRuntimeGate();
    assert.match(gate, /NOSUPERUSER/);
    assert.match(gate, /NOBYPASSRLS/);
    assert.match(gate, /runtime role owns protected table/);
    assert.match(gate, /authorization code replay protection failed/);
    assert.match(gate, /human subjects were visible without tenant context/);
    assert.match(gate, /rotation did not revoke old token/);
    assert.match(gate, /audit was absent or leaked forbidden material/);
  });
});
