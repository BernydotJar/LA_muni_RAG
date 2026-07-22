import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { loadCatalogValidators } from "../api/v1/catalogContracts.js";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-SOURCE-API-001 — governed tenant source catalog", () => {
  it("keeps source registration unreviewed and server-owned", async () => {
    const migration = await read("db/migrations/014_catalog_api.sql");
    assert.match(migration, /validation_state TEXT NOT NULL DEFAULT 'unreviewed'/);
    assert.match(migration, /official_source BOOLEAN NOT NULL DEFAULT false/);
    assert.match(migration, /acquisition_state TEXT NOT NULL DEFAULT 'not_acquired'/);
    assert.match(migration, /ingestion_state TEXT NOT NULL DEFAULT 'not_ingested'/);
    assert.match(migration, /retrieval_state TEXT NOT NULL DEFAULT 'not_indexed'/);
    assert.match(migration, /CHECK \(validation_state = 'validated' OR NOT official_source\)/);
  });

  it("rejects caller authority and processing-state promotion at the closed contract", async () => {
    const validators = await loadCatalogValidators();
    const request = JSON.parse(await read("contracts/examples/v1/source-create-request.valid.json"));
    assert.equal(validators.sourceRequest(request), true);
    for (const field of [
      "official_source",
      "official_for_target_jurisdiction",
      "validation_state",
      "acquisition_state",
      "ingestion_state",
      "retrieval_state",
    ]) {
      const promoted = structuredClone(request);
      promoted[field] = field.startsWith("official") ? true : "validated";
      assert.equal(validators.sourceRequest(promoted), false, field);
    }
  });

  it("forces tenant isolation and digest-only replay state", async () => {
    const migration = await read("db/migrations/014_catalog_api.sql");
    assert.match(migration, /ALTER TABLE rag\.sources FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /CREATE POLICY sources_tenant_isolation/);
    assert.match(migration, /idempotency_key_sha256 BYTEA NOT NULL/);
    assert.match(migration, /request_sha256 BYTEA NOT NULL/);
    assert.doesNotMatch(migration, /idempotency_key TEXT|bearer_token|authorization_header/i);
  });

  it("keeps comparative authority visibly non-target", async () => {
    const handler = await read("src/api/v1/catalogHandler.ts");
    const response = JSON.parse(await read("contracts/examples/v1/source-response.valid.json"));
    assert.match(handler, /Referencia comparativa de otra municipalidad/);
    assert.equal(response.source.source_relation, "comparative");
    assert.equal(response.source.official_source, false);
    assert.equal(response.source.official_for_target_jurisdiction, false);
    assert.match(response.source.limitations.join(" "), /Requiere corroboración/);
  });

  it("documents real scope limits instead of claiming corpus acquisition", async () => {
    const spec = await read("specs/067-catalog-api-v1/spec.md");
    assert.match(spec, /not authority conclusions/i);
    assert.match(spec, /not_acquired/);
    assert.match(spec, /not_ingested/);
    assert.match(spec, /not_indexed/);
    assert.match(spec, /Non-goals/);
    assert.match(spec, /artifact upload/i);
  });
});
