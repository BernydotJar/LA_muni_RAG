import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { closeDb, pool } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREDENTIAL_A = "33333333-3333-4333-8333-333333333333";
const CREDENTIAL_B = "44444444-4444-4444-8444-444444444444";
const TOKEN_A = "search-researcher-a-token-20260721-000000000001";
const TOKEN_B = "search-researcher-b-token-20260721-000000000001";
const JURISDICTION = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";
const ORIGIN = "https://research.example";
const IDEMPOTENCY_KEY = "search-evidence-bundle-smoke-000001";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded search/evidence smoke gate");
}

class StaticQueryEmbeddingProvider {
  providerName = "test-provider";
  model = "test-model-v1";
  dimensions = 1536;
  calls = 0;
  async embedQuery(query) {
    this.calls += 1;
    assert.ok(query.length > 0);
    return Array.from({ length: this.dimensions }, () => 0.001);
  }
}

const startServer = async (queryEmbeddingProvider) => {
  const server = createApiServer({
    legacyApiEnabled: false,
    v1CorsAllowedOrigins: [ORIGIN],
    requestTimeoutMs: 15_000,
    searchEvidenceV1: {
      queryEmbeddingProvider,
      rateLimit: 1_000,
      rateWindowSeconds: 60,
      idempotencyTtlSeconds: 86_400,
    },
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("search/evidence smoke server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const closeServer = async (server) => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

const filters = () => ({
  document_types: [],
  source_relations: [],
  authority_statuses: [],
  temporal_statuses: [],
  source_ids: [],
});

const searchRequest = (overrides = {}) => ({
  schema_version: "v1",
  operation: "search",
  request_id: randomUUID(),
  tenant_id: TENANT_A,
  query: "solicitud documental de agua potable",
  jurisdiction: JURISDICTION,
  as_of_date: "2026-07-21",
  mode: "keyword",
  limit: 10,
  filters: filters(),
  provenance: { credential_id: CREDENTIAL_A },
  ...overrides,
});

const bundleRequest = (overrides = {}) => ({
  ...searchRequest(),
  operation: "evidence_bundle_create",
  ...overrides,
});

const call = async (baseUrl, route, body, options = {}) => {
  const method = options.method ?? "POST";
  const headers = new Headers();
  const token = options.token === undefined ? TOKEN_A : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? body?.request_id ?? randomUUID());
  if (method === "POST" && options.contentType !== null) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  if (route === "/api/v1/evidence-bundles" && options.idempotencyKey !== null) {
    headers.set("idempotency-key", options.idempotencyKey ?? `search-evidence-${randomUUID()}`);
  }
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: method === "POST" ? options.rawBody ?? JSON.stringify(body ?? {}) : undefined,
  });
  const text = await response.text();
  return { response, text, body: text ? JSON.parse(text) : {} };
};

let firstServer;
let secondServer;
try {
  firstServer = await startServer(null);
  const noProviderRequest = searchRequest({ mode: "semantic" });
  const noProvider = await call(firstServer.baseUrl, "/api/v1/search", noProviderRequest);
  assert.equal(noProvider.response.status, 503);
  assert.equal(noProvider.body.error.code, "capability_unavailable");
  await closeServer(firstServer.server);
  firstServer = null;

  const provider = new StaticQueryEmbeddingProvider();
  secondServer = await startServer(provider);

  for (const route of ["/api/v1/search", "/api/v1/evidence-bundles"]) {
    const preflight = await call(secondServer.baseUrl, route, null, {
      method: "OPTIONS",
      origin: ORIGIN,
    });
    assert.equal(preflight.response.status, 204);
    assert.equal(preflight.response.headers.get("access-control-allow-origin"), ORIGIN);
    assert.equal(preflight.response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  }

  const unauthenticated = await call(secondServer.baseUrl, "/api/v1/search", {}, {
    token: null,
    requestId: randomUUID(),
    rawBody: '{"private":"unterminated',
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("private"), false);

  const keywordRequest = searchRequest();
  const keyword = await call(secondServer.baseUrl, "/api/v1/search", keywordRequest);
  assert.equal(keyword.response.status, 200);
  assert.equal(keyword.body.requested_mode, "keyword");
  assert.deepEqual(keyword.body.executed_modes, ["keyword"]);
  assert.equal(keyword.body.result_count, 2);
  const supportedResult = keyword.body.results.find((result) => result.evidence_status === "supported");
  const comparativeResult = keyword.body.results.find((result) => result.evidence_status === "comparative_reference");
  assert.ok(supportedResult);
  assert.equal(supportedResult.authority_status, "official_target_jurisdiction");
  assert.equal(supportedResult.temporal_status, "current_by_stored_dates");
  assert.ok(comparativeResult);
  assert.equal(comparativeResult.authority_status, "comparative");
  assert.equal(/object_key|object_namespace|scanner_engine|lease_token|pipeline_config/i.test(keyword.text), false);

  const literalWildcardRequest = searchRequest({
    request_id: randomUUID(),
    mode: "phrase",
    query: "%",
  });
  const literalWildcard = await call(secondServer.baseUrl, "/api/v1/search", literalWildcardRequest);
  assert.equal(literalWildcard.response.status, 200);
  assert.equal(literalWildcard.body.result_count, 0);

  const semanticRequest = searchRequest({ mode: "semantic" });
  const semantic = await call(secondServer.baseUrl, "/api/v1/search", semanticRequest);
  assert.equal(semantic.response.status, 200);
  assert.deepEqual(semantic.body.executed_modes, ["semantic"]);
  assert.ok(semantic.body.result_count >= 1);
  assert.equal(semantic.body.results[0].retrieval.score_type, "cosine_similarity");

  const hybridRequest = searchRequest({ mode: "hybrid" });
  const hybrid = await call(secondServer.baseUrl, "/api/v1/search", hybridRequest);
  assert.equal(hybrid.response.status, 200);
  assert.deepEqual(hybrid.body.executed_modes, ["keyword", "phrase", "semantic"]);
  assert.equal(hybrid.body.results[0].retrieval.score_type, "reciprocal_rank_fusion");
  assert.ok(provider.calls >= 2);

  const bundleBody = bundleRequest({ request_id: randomUUID() });
  const created = await call(secondServer.baseUrl, "/api/v1/evidence-bundles", bundleBody, {
    idempotencyKey: IDEMPOTENCY_KEY,
  });
  assert.equal(created.response.status, 200);
  assert.equal(created.body.response_type, "evidence_bundle");
  assert.equal(created.body.claims.length, 1);
  assert.equal(created.body.claims[0].evidence_status, "supported");
  assert.equal(created.body.claims[0].text.includes("recibe la solicitud documental"), true);
  assert.equal(created.body.citations.length, 2);
  assert.ok(created.body.citations.some((citation) => citation.evidence_status === "comparative_reference"));
  assert.equal(created.body.claims.some((claim) => claim.evidence_status === "comparative_reference"), false);
  assert.match(JSON.stringify(created.body.missing_evidence), /corrobor/i);

  const replay = await call(secondServer.baseUrl, "/api/v1/evidence-bundles", bundleBody, {
    idempotencyKey: IDEMPOTENCY_KEY,
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.text, created.text);

  const conflict = await call(secondServer.baseUrl, "/api/v1/evidence-bundles", {
    ...bundleBody,
    query: "consulta documental diferente",
  }, { idempotencyKey: IDEMPOTENCY_KEY });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");

  const corrupted = structuredClone(created.body);
  corrupted.tenant_id = TENANT_B;
  const corruptedBody = JSON.stringify(corrupted);
  const corruptedHash = createHash("sha256").update(corruptedBody).digest("hex");
  const idempotencyHash = createHash("sha256").update(IDEMPOTENCY_KEY).digest("hex");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const update = await client.query(`UPDATE rag.search_evidence_api_idempotency
      SET response_body = $1, response_sha256 = decode($2, 'hex')
      WHERE tenant_id = $3::uuid AND principal_id = $4::uuid
        AND operation = 'evidence_bundle_create_v1'
        AND idempotency_key_sha256 = decode($5, 'hex')`, [
      corruptedBody,
      corruptedHash,
      TENANT_A,
      "11111111-1111-4111-8111-111111111111",
      idempotencyHash,
    ]);
    assert.equal(update.rowCount, 1);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const corruptReplay = await call(secondServer.baseUrl, "/api/v1/evidence-bundles", bundleBody, {
    idempotencyKey: IDEMPOTENCY_KEY,
  });
  assert.equal(corruptReplay.response.status, 500);
  assert.equal(corruptReplay.body.error.code, "replay_invalid");
  assert.equal(corruptReplay.text.includes(TENANT_B), false);

  const verification = await pool.connect();
  try {
    await verification.query("BEGIN");
    await verification.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const remaining = await verification.query(`SELECT count(*)::integer AS count
      FROM rag.search_evidence_api_idempotency
      WHERE tenant_id = $1::uuid AND operation = 'evidence_bundle_create_v1'
        AND idempotency_key_sha256 = decode($2, 'hex')`, [TENANT_A, idempotencyHash]);
    assert.equal(remaining.rows[0].count, 0);
    await verification.query("COMMIT");
  } catch (error) {
    await verification.query("ROLLBACK");
    throw error;
  } finally {
    verification.release();
  }

  const crossTenantRequest = searchRequest({
    request_id: randomUUID(),
    provenance: { credential_id: CREDENTIAL_B },
  });
  const crossTenant = await call(secondServer.baseUrl, "/api/v1/search", crossTenantRequest, {
    token: TOKEN_B,
  });
  assert.equal(crossTenant.response.status, 403);
  assert.equal(crossTenant.body.error.code, "forbidden");
  assert.equal(crossTenant.text.includes("Manual oficial de agua potable"), false);

  const tenantBRequest = searchRequest({
    request_id: randomUUID(),
    tenant_id: TENANT_B,
    provenance: { credential_id: CREDENTIAL_B },
  });
  const tenantB = await call(secondServer.baseUrl, "/api/v1/search", tenantBRequest, {
    token: TOKEN_B,
  });
  assert.equal(tenantB.response.status, 200);
  assert.equal(tenantB.body.result_count, 0);
  assert.equal(tenantB.text.includes("Manual oficial de agua potable"), false);

  process.stdout.write(`${JSON.stringify({
    result: "search_evidence_api_postgres_http_smoke_passed",
    statuses: [503, 401, 200, 200, 200, 200, 200, 200, 409, 500, 403, 200],
    keywordResults: keyword.body.result_count,
    semanticExecuted: true,
    hybridExecuted: true,
    comparativePromotedToClaim: false,
    exactReplay: true,
    corruptReplayCleanupCommitted: true,
    privateArtifactCoordinatesReturned: false,
    crossTenantLeak: false,
  })}\n`);
} finally {
  if (firstServer) await closeServer(firstServer.server);
  if (secondServer) await closeServer(secondServer.server);
  await closeDb();
}
