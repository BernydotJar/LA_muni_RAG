import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migration = new URL(
  "../../db/migrations/012_evidence_gap_requests.sql",
  import.meta.url
);
const responseSchema = new URL(
  "../../contracts/schemas/v1/evidence-gap-response.schema.json",
  import.meta.url
);
const responseExample = new URL(
  "../../contracts/examples/v1/evidence-gap-response.valid.json",
  import.meta.url
);

describe("EvidenceGapRequest persistence boundary", () => {
  it("stores an open tenant-owned gap and dedicated replay/rate state under forced RLS", async () => {
    const sql = await readFile(migration, "utf8");
    assert.match(sql, /CREATE TABLE rag\.evidence_gap_requests/i);
    assert.match(sql, /CREATE TABLE integration\.evidence_gap_idempotency/i);
    assert.match(sql, /CREATE TABLE integration\.evidence_gap_rate_limits/i);
    assert.match(sql, /ALTER TABLE rag\.evidence_gap_requests FORCE ROW LEVEL SECURITY/i);
    assert.match(sql, /ALTER TABLE integration\.evidence_gap_idempotency FORCE ROW LEVEL SECURITY/i);
    assert.match(sql, /PRIMARY KEY \(tenant_id, id\)/i);
    assert.match(sql, /status TEXT NOT NULL DEFAULT 'open'/i);
    assert.match(sql, /CHECK \(status = 'open'\)/i);
    assert.match(sql, /request_sha256 BYTEA NOT NULL/i);
    assert.match(sql, /response_sha256 BYTEA NOT NULL/i);
    assert.match(
      sql,
      /FOREIGN KEY \(credential_id, tenant_id\)[\s\S]*REFERENCES identity\.api_credentials \(id, tenant_id\)/i
    );
    assert.doesNotMatch(sql, /identity\.integration_credentials/i);
    assert.match(sql, /priority IN \('low', 'medium', 'high', 'critical'\)/i);
    assert.doesNotMatch(sql, /'urgent'/i);
    assert.match(sql, /expires_at TIMESTAMPTZ NOT NULL/i);
    assert.match(sql, /response_sha256 = digest\(response_body, 'sha256'\)/i);
    assert.match(sql, /octet_length\(response_body\) BETWEEN 2 AND 1048576/i);
  });

  it("persists no raw key, credential secret, source authority or publication artifact", async () => {
    const sql = await readFile(migration, "utf8");
    assert.doesNotMatch(
      sql,
      /^\s*(idempotency_key|bearer_token|credential_secret|source_url|official_source|content_body|publication_task)\s+/im
    );
    assert.match(sql, /idempotency_key_sha256 BYTEA NOT NULL/i);
    assert.match(sql, /credential_id UUID NOT NULL/i);
    assert.match(
      sql,
      /reason_code IN \('credential_rejected', 'authentication_dependency_failure'\)/i
    );
  });

  it("closes the response contract around an open research intake without authority claims", async () => {
    const schema = JSON.parse(await readFile(responseSchema, "utf8")) as {
      $id: string;
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, Record<string, unknown>>;
    };
    const example = JSON.parse(await readFile(responseExample, "utf8")) as {
      request_id: string;
      jurisdiction: string;
      product_boundary: string;
      provenance: Record<string, unknown>;
    };

    assert.equal(
      schema.$id,
      "https://contracts.la-muni-rag.invalid/v1/evidence-gap-response.schema.json"
    );
    assert.equal(schema.additionalProperties, false);
    assert.ok(schema.required.includes("status"));
    assert.ok(schema.required.includes("request_assertion_status"));
    assert.deepEqual(schema.properties.request_assertion_status, {
      const: "requester_supplied_unverified",
    });
    assert.ok(schema.required.includes("request_id"));
    assert.ok(schema.required.includes("jurisdiction"));
    assert.ok(schema.required.includes("limitations"));
    assert.ok(schema.required.includes("provenance"));
    assert.deepEqual(schema.properties.campaign_reference, {
      $ref: "common.schema.json#/$defs/SafeOpaqueId",
    });
    assert.equal(example.product_boundary, "evidence_gap_request_only");
    assert.match(example.request_id, /^[0-9a-f-]{36}$/i);
    assert.match(example.jurisdiction, /Antigua Guatemala/);
    assert.equal(example.provenance.source_product, "la_muni_rag");
    assert.equal(example.provenance.generated_by, "system");
    assert.equal("official_source" in schema.properties, false);
    assert.equal("source_url" in schema.properties, false);
    assert.equal("campaign_strategy" in schema.properties, false);
    assert.equal("content_calendar" in schema.properties, false);
  });
});
