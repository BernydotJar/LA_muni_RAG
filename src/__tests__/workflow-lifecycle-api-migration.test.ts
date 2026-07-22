import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migrationUrl = new URL(
  "../../db/migrations/010_workflow_lifecycle_api.sql",
  import.meta.url
);
const gateUrl = new URL(
  "../../db/tests/workflow_lifecycle_runtime_gate.sql",
  import.meta.url
);
const repositoryUrl = new URL(
  "../workflowLifecycle/repository.ts",
  import.meta.url
);

describe("workflow lifecycle API migration", () => {
  it("stores only scoped digests and validated replay bytes under forced RLS", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    for (const table of [
      "integration.workflow_lifecycle_idempotency",
      "integration.workflow_lifecycle_rate_limits",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE ${table.replace(".", "\\.")}`));
      assert.match(
        sql,
        new RegExp(`ALTER TABLE ${table.replace(".", "\\.")} FORCE ROW LEVEL SECURITY`)
      );
    }
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/);
    assert.match(sql, /PRIMARY KEY \(tenant_id, principal_id, operation, idempotency_key_sha256\)/);
    assert.match(sql, /response_body TEXT CHECK \(response_body IS NULL OR octet_length\(response_body\) <= 4194304\)/);
    assert.doesNotMatch(sql, /^\s*(bearer_token|credential_secret|request_body|authorization_header)\s+/im);
  });

  it("keeps processing and completed replay states structurally exclusive", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /state IN \('processing', 'completed'\)/);
    assert.match(
      sql,
      /state = 'processing'[\s\S]*response_status IS NULL[\s\S]*audit_id IS NULL[\s\S]*completed_at IS NULL/
    );
    assert.match(
      sql,
      /state = 'completed'[\s\S]*response_status IS NOT NULL[\s\S]*response_body IS NOT NULL[\s\S]*audit_id IS NOT NULL/
    );
  });

  it("aggregates tenantless authentication failures behind a security-definer boundary", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    assert.match(sql, /CREATE TABLE audit\.workflow_lifecycle_authentication_failures/);
    assert.match(sql, /UNIQUE \(bucket_started_at, reason_code\)/);
    assert.match(sql, /CREATE FUNCTION audit\.record_workflow_lifecycle_authentication_failure/);
    assert.match(sql, /SECURITY DEFINER/);
    assert.match(sql, /REVOKE ALL ON TABLE audit\.workflow_lifecycle_authentication_failures FROM PUBLIC/);
    assert.match(sql, /REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC/);
  });

  it("ships a guarded non-owner runtime gate for RLS and human governance", async () => {
    const gate = await readFile(gateUrl, "utf8");
    assert.match(gate, /current_database\(\) <> 'la_muni_rag_test'/);
    assert.match(gate, /SET ROLE la_muni_runtime_test/);
    assert.match(gate, /NOBYPASSRLS|must not bypass RLS/);
    assert.match(gate, /missing tenant context exposed/);
    assert.match(gate, /tenant B observed tenant A procedure metadata/);
    assert.match(gate, /new workflow version bypassed draft state/);
    assert.match(gate, /workflow creator reviewed their own version/);
    assert.match(gate, /approved workflow content was mutable/);
    assert.match(gate, /Replacement approved in the same transaction that superseded the former version/);
    assert.match(gate, /atomic workflow supersession did not leave exactly one approved replacement/);
    assert.match(gate, /workflow_lifecycle_sql_gate_passed/);
  });

  it("writes lifecycle audits through the canonical audit.events columns", async () => {
    const repository = await readFile(repositoryUrl, "utf8");
    assert.match(
      repository,
      /INSERT INTO audit\.events \([\s\S]*actor_external_id[\s\S]*details/
    );
    assert.doesNotMatch(
      repository,
      /INSERT INTO audit\.events \([\s\S]{0,180}principal_id/
    );
  });

  it("does not add campaign, voter, content, or publication storage", async () => {
    const sql = await readFile(migrationUrl, "utf8");
    const tableBodies = [
      ...sql.matchAll(
        /CREATE TABLE (?:integration|audit)\.(?:workflow_lifecycle_idempotency|workflow_lifecycle_rate_limits|workflow_lifecycle_authentication_failures) \(([\s\S]*?)\n\);/g
      ),
    ]
      .map((match) => match[1])
      .join("\n");
    assert.doesNotMatch(
      tableBodies,
      /voter|electoral_segment|message_house|content_brief|copy|asset|channel|publication_task|media_spend/i
    );
  });
});
