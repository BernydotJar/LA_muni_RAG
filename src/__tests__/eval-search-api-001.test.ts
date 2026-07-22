import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { loadSearchEvidenceValidators } from "../api/v1/searchEvidenceContracts.js";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-SEARCH-API-001 — explicit tenant retrieval semantics", () => {
  it("defines closed bounded search input with an explicit as-of date", async () => {
    const validators = await loadSearchEvidenceValidators();
    const request = JSON.parse(await read("contracts/examples/v1/search-request.valid.json"));
    assert.equal(validators.searchRequest(request), true, JSON.stringify(validators.searchRequest.errors));
    for (const field of ["official_source", "validation_state", "retrieval_state", "score_threshold"]) {
      const promoted = structuredClone(request);
      promoted[field] = true;
      assert.equal(validators.searchRequest(promoted), false, field);
    }
    const unbounded = structuredClone(request);
    unbounded.limit = 51;
    assert.equal(validators.searchRequest(unbounded), false);
  });

  it("fails closed instead of silently degrading semantic or hybrid mode", async () => {
    const handler = await read("src/api/v1/searchEvidenceHandler.ts");
    const service = await read("src/searchEvidence/service.ts");
    assert.match(handler, /capability_unavailable/);
    assert.match(service, /Semantic retrieval capability is unavailable/);
    assert.match(service, /request\.mode === "semantic"/);
    assert.match(service, /semantic = await semanticRows[\s\S]{0,300}keywordRows = await/);
    assert.match(handler, /preparedSemantic = await prepareSearchCapability[\s\S]{0,300}return withTenantTransaction/);
    assert.doesNotMatch(handler, /requested_mode:\s*request\.mode[\s\S]{0,800}executed_modes:\s*\["keyword"\]/);
  });

  it("requires accepted clean exact artifacts and processed tenant retrieval state", async () => {
    const repository = await read("src/searchEvidence/repository.ts");
    assert.match(repository, /artifact\.status = 'accepted'/);
    assert.match(repository, /scan\.verdict = 'clean'/);
    assert.match(repository, /artifact\.accepted_until > statement_timestamp\(\)/);
    assert.match(repository, /scan\.content_sha256 = artifact\.expected_sha256/);
    assert.match(repository, /encode\(artifact\.expected_sha256, 'hex'\) = version\.content_sha256/);
    assert.match(repository, /job\.status = 'processed'/);
    assert.match(repository, /source\.acquisition_state = 'acquired'/);
    assert.match(repository, /source\.ingestion_state = 'ingested'/);
    assert.match(repository, /source\.retrieval_state = 'indexed'/);
    assert.match(repository, /document\.confidentiality = 'public'/);
    assert.match(repository, /strpos\(lower\(section\.content\), lower\(\$2\)\) > 0/);
    assert.doesNotMatch(repository, /section\.content ILIKE '%' \|\| \$2 \|\| '%'/);
  });

  it("derives authority and temporal labels from persisted server-owned fields", async () => {
    const service = await read("src/searchEvidence/service.ts");
    assert.match(service, /official_target_jurisdiction/);
    assert.match(service, /official_national/);
    assert.match(service, /current_by_stored_dates/);
    assert.match(service, /future_by_stored_dates/);
    assert.match(service, /expired_by_stored_dates/);
    assert.match(service, /undetermined/);
    assert.match(service, /validationState === "validated"/);
  });

  it("documents that retrieval output is not a quality or legal-applicability claim", async () => {
    const spec = await read("specs/068-search-evidence-api-v1/spec.md");
    assert.match(spec, /do not prove corpus completeness/i);
    assert.match(spec, /not legal conclusions/i);
    assert.match(spec, /fail-closed/i);
    assert.match(spec, /human review/i);
  });
});
