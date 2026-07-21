import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { loadCatalogValidators } from "../api/v1/catalogContracts.js";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-DOCUMENT-API-001 — safe document registration and monitoring", () => {
  it("registers identity and version without accepting artifact or scan claims", async () => {
    const validators = await loadCatalogValidators();
    const request = JSON.parse(await read("contracts/examples/v1/document-create-request.valid.json"));
    assert.equal(validators.documentRequest(request), true);
    for (const field of ["artifact_object_id", "artifact_scan_id", "accepted_until", "ingestion_state", "retrieval_state"]) {
      const promoted = structuredClone(request);
      promoted[field] = "caller-selected";
      assert.equal(validators.documentRequest(promoted), false, field);
    }
  });

  it("persists new catalog documents as draft with queued extraction", async () => {
    const migration = await read("db/migrations/014_catalog_api.sql");
    const repository = await read("src/catalog/repository.ts");
    assert.match(migration, /ALTER COLUMN status SET DEFAULT 'draft'/);
    assert.match(repository, /extractionState: "queued"/);
    assert.match(repository, /state: "not_accepted"/);
    assert.match(repository, /ingestionState: "not_started"/);
    assert.match(repository, /retrievalState: "not_indexed"/);
  });

  it("returns only allowlisted artifact, job and procedure summaries", async () => {
    const repository = await read("src/catalog/repository.ts");
    const handler = await read("src/api/v1/catalogHandler.ts");
    assert.match(repository, /object\.accepted_scan_id, object\.accepted_until/);
    assert.doesNotMatch(repository, /SELECT object\.\*/);
    assert.doesNotMatch(repository, /SELECT ingestion\.\*/);
    assert.doesNotMatch(handler, /object_key|object_namespace|signed_url|scanner_engine/);
    assert.doesNotMatch(handler, /lease_token|fencing_token|pipeline_config|rawError/);
  });

  it("uses forced RLS and column-level runtime grants", async () => {
    const gate = await read("db/tests/catalog_api_runtime_gate.sql");
    assert.match(gate, /relforcerowsecurity/);
    assert.match(gate, /GRANT SELECT \(\s*id, tenant_id, document_version_id, status, accepted_scan_id/);
    assert.match(gate, /has_column_privilege\('la_muni_runtime_test', 'rag\.artifact_objects', 'object_key', 'SELECT'\)/);
    assert.match(gate, /cross_tenant_leak/);
  });

  it("keeps registration distinct from acquisition, ingestion and legal validity", async () => {
    const response = JSON.parse(await read("contracts/examples/v1/document-response.valid.json"));
    assert.equal(response.document.document_status, "draft");
    assert.equal(response.document.artifact_acceptance.state, "not_accepted");
    assert.equal(response.document.ingestion_state, "not_started");
    assert.equal(response.document.retrieval_state, "not_indexed");
    assert.match(response.limitations.join(" "), /does not prove acquisition/i);
    assert.match(response.limitations.join(" "), /legal applicability/i);
  });
});
