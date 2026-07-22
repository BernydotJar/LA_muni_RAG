import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-PUBLIC-QUERY-GATEWAY-001", () => {
  it("publishes one closed credential-free public contract", async () => {
    const request = JSON.parse(await read("contracts/schemas/v1/public-query-request.schema.json"));
    const response = JSON.parse(await read("contracts/schemas/v1/public-query-response.schema.json"));
    const openapi = JSON.parse(await read("contracts/openapi/v1/openapi.json"));
    assert.equal(request.additionalProperties, false);
    assert.deepEqual(request.required, ["message", "mode", "limit"]);
    assert.deepEqual(request.properties.mode.enum, ["keyword", "phrase"]);
    assert.equal(request.properties.tenant_id, undefined);
    assert.equal(request.properties.credential_id, undefined);
    assert.equal(response.additionalProperties, false);
    const operation = openapi.paths["/api/public/v1/query"].post;
    assert.deepEqual(operation.security, []);
    assert.deepEqual(Object.keys(operation.responses), ["200", "400", "403", "405", "429", "500", "503"]);
  });

  it("binds tenant and jurisdiction from server configuration only", async () => {
    const index = await read("src/api/public/v1/publicQueryIndex.ts");
    const handler = await read("src/api/public/v1/publicQueryHandler.ts");
    assert.match(index, /PUBLIC_QUERY_TENANT_ID/);
    assert.match(index, /PUBLIC_QUERY_JURISDICTION/);
    assert.match(index, /PUBLIC_QUERY_ALLOWED_ORIGINS/);
    assert.match(index, /enabled.*configuredBoolean/s);
    assert.match(handler, /tenant_id: dependencies\.tenantId!/);
    assert.match(handler, /jurisdiction: dependencies\.jurisdiction!/);
    assert.match(handler, /withTenantTransaction/);
  });

  it("rejects browser credentials and applies rate before request parsing", async () => {
    const handler = await read("src/api/public/v1/publicQueryHandler.ts");
    const ratePosition = handler.indexOf("await runRateGate(req, dependencies, requestIdentity.requestId)");
    const credentialPosition = handler.indexOf("req.headers.authorization !== undefined");
    const bodyPosition = handler.indexOf("await readJsonBody(req, MAX_BODY_BYTES)");
    assert.ok(ratePosition > 0 && credentialPosition > ratePosition && bodyPosition > credentialPosition);
    assert.match(handler, /PUBLIC_QUERY_ROUTE/);
    assert.match(handler, /access-control-allow-headers.*content-type, x-request-id/);
    assert.doesNotMatch(handler, /access-control-allow-credentials/);
  });

  it("stores only HMAC rate identity and minimized audit fields", async () => {
    const migration = await read("db/migrations/016_public_query_gateway.sql");
    const repository = await read("src/api/public/v1/publicQueryRepository.ts");
    assert.match(migration, /client_key_sha256 BYTEA/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/);
    assert.doesNotMatch(migration, /ip_address|user_agent|query_text|request_body|source_url/i);
    assert.match(repository, /reason_code/);
    assert.match(repository, /request_id/);
    assert.match(repository, /requested_mode/);
    assert.match(repository, /result_count/);
    assert.doesNotMatch(repository, /query_text|user_agent|ip_address|source_url/i);
    assert.match(repository, /DELETE FROM rag\.public_query_rate_limits/);
  });

  it("reuses strict public evidence eligibility and never promotes comparative evidence", async () => {
    const service = await read("src/searchEvidence/service.ts");
    const handler = await read("src/api/public/v1/publicQueryHandler.ts");
    const repository = await read("src/searchEvidence/repository.ts");
    assert.match(handler, /executeSearch/);
    assert.match(handler, /evidenceStatus === "supported"/);
    assert.match(handler, /insufficient_evidence/);
    assert.match(repository, /source\.acquisition_state = 'acquired'/);
    assert.match(repository, /document\.confidentiality = 'public'/);
    assert.match(repository, /version\.extraction_status = 'processed'/);
    assert.match(repository, /artifact\.status = 'accepted'/);
    assert.match(repository, /scan\.verdict = 'clean'/);
    assert.match(repository, /job\.status = 'processed'/);
    assert.match(service, /comparative_reference/);
  });

  it("projects only bounded HTTPS links without credentials, query or fragment", async () => {
    const handler = await read("src/api/public/v1/publicQueryHandler.ts");
    const responseSchema = await read("contracts/schemas/v1/public-query-response.schema.json");
    assert.match(handler, /parsed\.protocol !== "https:"/);
    assert.match(handler, /parsed\.username/);
    assert.match(handler, /parsed\.password/);
    assert.match(handler, /parsed\.search/);
    assert.match(handler, /parsed\.hash/);
    assert.match(responseSchema, /"maxItems": 5/);
    assert.match(responseSchema, /"excerpt"[\s\S]*"maxLength": 700/);
  });

  it("has fresh PostgreSQL, non-owner and compiled smoke gates", async () => {
    const migrationTest = await read("src/__tests__/public-query-gateway-migration.test.ts");
    const sqlGate = await read("db/tests/public_query_gateway_runtime_gate.sql");
    const smoke = await read("scripts/public-query-postgres-smoke.mjs");
    const ci = await read(".github/workflows/ci.yml");
    assert.match(migrationTest, /forces RLS/);
    assert.match(sqlGate, /NOSUPERUSER|superuser/i);
    assert.match(sqlGate, /runtime role must not own/);
    assert.match(sqlGate, /tenant B observed tenant A/);
    assert.match(smoke, /public_query_gateway_postgres_smoke_passed/);
    assert.match(smoke, /rawNetworkIdentityPersisted: false/);
    assert.match(ci, /016_public_query_gateway\.sql/);
    assert.match(ci, /smoke:public-query-gateway/);
  });

  it("documents real-corpus, edge, cloud and deployment limitations", async () => {
    const api = await read("docs/api/public-query-gateway-v1.md");
    const risk = await read("docs/risks/072-public-query-gateway-risk-register.md");
    const spec = await read("specs/072-public-query-gateway-v1/spec.md");
    assert.match(api, /does not prove that any real corpus satisfies those states/i);
    assert.match(api, /Cloud Armor.*remain required/i);
    assert.match(api, /deployment and observation remain open/i);
    assert.match(risk, /authorized ingested corpus absent/i);
    assert.match(spec, /creates no GCP resource/);
  });
});
