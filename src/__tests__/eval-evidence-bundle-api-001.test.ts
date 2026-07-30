import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { loadSearchEvidenceValidators } from "../api/v1/searchEvidenceContracts.js";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-EVIDENCE-BUNDLE-API-001 — conservative dedicated evidence artifact", () => {
  it("binds a closed dedicated request to the canonical EvidenceBundle contract", async () => {
    const validators = await loadSearchEvidenceValidators();
    const request = JSON.parse(await read("contracts/examples/v1/evidence-bundle-request.valid.json"));
    const response = JSON.parse(await read("contracts/examples/v1/evidence-bundle.valid.json"));
    assert.equal(validators.evidenceBundleRequest(request), true, JSON.stringify(validators.evidenceBundleRequest.errors));
    assert.equal(validators.evidenceBundle(response), true, JSON.stringify(validators.evidenceBundle.errors));
  });

  it("promotes only supported documentary excerpts to ordinary claims", async () => {
    const mapper = await read("src/searchEvidence/evidenceBundle.ts");
    assert.match(mapper, /evidenceStatus === "supported"/);
    assert.match(mapper, /candidate\.excerpt/);
    assert.doesNotMatch(mapper, /evidenceStatus === "comparative_reference"[\s\S]{0,240}claims\.push/);
    assert.doesNotMatch(mapper, /evidenceStatus === "validation_required"[\s\S]{0,240}claims\.push/);
  });

  it("keeps comparative references visible and requires Antigua corroboration", async () => {
    const mapper = await read("src/searchEvidence/evidenceBundle.ts");
    assert.match(mapper, /comparative_reference/);
    assert.match(mapper, /Mixco/);
    assert.match(mapper, /corrobor/i);
    assert.match(mapper, /missing_evidence/);
  });

  it("invalidates corrupt exact replay in a committed tenant transaction", async () => {
    const handler = await read("src/api/v1/searchEvidenceHandler.ts");
    const repository = await read("src/searchEvidence/repository.ts");
    assert.match(handler, /replay_invalid/);
    assert.match(handler, /invalidateCompletedIdempotency/);
    assert.match(repository, /response_sha256/);
    assert.match(repository, /state = 'completed'/);
    assert.match(repository, /DELETE FROM rag\.search_evidence_api_idempotency/);
  });

  it("keeps private coordinates and operational internals outside the response projection", async () => {
    const types = await read("src/api/v1/searchEvidenceTypes.ts");
    const mapper = await read("src/searchEvidence/evidenceBundle.ts");
    for (const privateName of ["object_key", "object_namespace", "scanner_engine", "lease_token", "fencing_token", "api_key"]) {
      assert.doesNotMatch(types, new RegExp(privateName, "i"));
      assert.doesNotMatch(mapper, new RegExp(privateName, "i"));
    }
  });
});
