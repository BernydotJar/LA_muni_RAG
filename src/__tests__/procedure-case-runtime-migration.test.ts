import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migration = new URL("../../db/migrations/013_procedure_cases.sql", import.meta.url);
const requestSchema = new URL(
  "../../contracts/schemas/v1/procedure-case-request.schema.json",
  import.meta.url
);
const responseSchema = new URL(
  "../../contracts/schemas/v1/procedure-case.schema.json",
  import.meta.url
);

describe("procedure case persistence boundary", () => {
  it("binds a tenant case immutably to an approved workflow and forces RLS", async () => {
    const sql = await readFile(migration, "utf8");
    for (const table of [
      "procedure_cases",
      "procedure_case_steps",
      "procedure_case_documents",
      "procedure_case_blockers",
      "procedure_case_events",
    ]) {
      assert.match(sql, new RegExp(`CREATE TABLE rag\\.${table}`, "i"));
      assert.match(sql, new RegExp(`ALTER TABLE rag\\.${table} FORCE ROW LEVEL SECURITY`, "i"));
    }
    assert.match(sql, /lifecycle_status[\s\S]*IS DISTINCT FROM 'approved'/i);
    assert.match(sql, /procedure case requires an approved workflow version/i);
    assert.match(sql, /workflow_version_id IS DISTINCT FROM OLD\.workflow_version_id/i);
    assert.match(sql, /workflow_version_number IS DISTINCT FROM OLD\.workflow_version_number/i);
    assert.match(sql, /procedure case revision must advance exactly once/i);
    assert.match(sql, /closed procedure cases cannot be reopened/i);
    assert.match(sql, /FOREIGN KEY \(workflow_version_id, tenant_id\)[\s\S]*rag\.procedure_versions/i);
  });

  it("keeps the dossier bounded, tenant-owned and append-only", async () => {
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /procedure_case_events_append_only/i);
    assert.match(sql, /procedure case events are append-only/i);
    assert.match(sql, /state IN \('missing', 'requested', 'received', 'reviewed'\)/i);
    assert.match(sql, /state IN \('not_started', 'in_progress', 'blocked', 'ready_for_review', 'completed'\)/i);
    assert.match(sql, /state IN \('missing', 'requested'\) OR document_version_id IS NOT NULL/i);
    assert.match(sql, /octet_length\(details::text\) <= 8192/i);
    assert.match(sql, /char_length\(operational_note\) BETWEEN 1 AND 4000/i);
    assert.doesNotMatch(sql, /^\s*(signed_url|bearer_token|credential_secret|legal_status)\s+/im);
  });

  it("uses exact replay bytes and a bounded pre-tenant authentication sink", async () => {
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /CREATE TABLE integration\.procedure_case_idempotency/i);
    assert.match(sql, /response_body TEXT/i);
    assert.match(sql, /response_sha256 BYTEA/i);
    assert.match(sql, /octet_length\(response_body\) BETWEEN 2 AND 1048576/i);
    assert.match(sql, /response_sha256 = (?:public\.)?digest\(response_body, 'sha256'\)/i);
    assert.match(sql, /CREATE TABLE audit\.procedure_case_authentication_failures/i);
    assert.match(sql, /SECURITY DEFINER/i);
    assert.match(sql, /SET search_path = pg_catalog, audit/i);
    assert.match(sql, /INTERVAL '30 days'/i);
    assert.match(sql, /REVOKE ALL ON FUNCTION audit\.record_procedure_case_authentication_failure/i);
  });

  it("closes request and response contracts against legal-status promotion", async () => {
    const request = JSON.parse(await readFile(requestSchema, "utf8")) as Record<string, unknown>;
    const response = JSON.parse(await readFile(responseSchema, "utf8")) as {
      additionalProperties: boolean;
      properties: Record<string, unknown>;
      required: string[];
    };
    assert.equal(request.$id, "https://contracts.la-muni-rag.invalid/v1/procedure-case-request.schema.json");
    assert.equal(response.additionalProperties, false);
    assert.ok(response.required.includes("limitations"));
    assert.equal("legal_status" in response.properties, false);
    assert.equal("compliance_status" in response.properties, false);
    assert.equal("municipal_approval" in response.properties, false);
    assert.equal("payment_status" in response.properties, false);
  });
});
