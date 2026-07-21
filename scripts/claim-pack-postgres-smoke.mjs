import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const { Client } = pg;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREDENTIAL_A = "88888888-8888-4888-8888-888888888888";
const PRINCIPAL_A = "77777777-7777-4777-8777-777777777777";
const TOKEN_A = "disposable-tenant-a-api-token-20260718";
const CONTENT_ORIGIN = "https://content-agency.example";
const IDEMPOTENCY_KEY = `claim-pack-runtime-${randomUUID()}`;
const SECRET_MARKER = "CORRUPT_CLAIM_PACK_SECRET";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded ClaimPack smoke gate");
}

const requestBody = (requestId, overrides = {}) => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "claims_and_evidence_request_only",
  request_id: requestId,
  tenant_id: TENANT_A,
  question:
    "¿Qué afirmaciones documentales están respaldadas para llevar agua potable a una comunidad y dar seguimiento a la solicitud?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "runtime-claim-pack-water",
    facts: ["Existe una solicitud comunitaria que requiere revisión documental."],
    provided_documents: [],
    constraints: ["Conservar citas, jurisdicción y limitaciones."],
  },
  requested_depth: "deep_dive",
  provenance: {
    source_product: "content_agency",
    generated_by: "integration_client",
    created_at: "2026-07-21T12:00:00.000Z",
    source_refs: ["approved-brief-reference-only"],
    credential_id: CREDENTIAL_A,
    audit_id: "abababab-abab-4bab-8bab-abababababab",
  },
  ...overrides,
});

const server = createApiServer({
  v1CorsAllowedOrigins: [CONTENT_ORIGIN],
  legacyApiEnabled: false,
  requestTimeoutMs: 15_000,
  claimPackV1: {
    validitySeconds: 3_600,
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
if (!address || typeof address === "string") throw new Error("ClaimPack smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;
const endpoint = `${baseUrl}/api/v1/claim-packs`;

const post = async (body, options = {}) => {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN_A}`,
    "content-type": "application/json",
    "idempotency-key": options.idempotencyKey ?? IDEMPOTENCY_KEY,
    "x-request-id": options.requestId ?? body?.request_id ?? randomUUID(),
  });
  if (options.authorization === null) headers.delete("authorization");
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const mutateStoredReplay = async (responseBody) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `UPDATE integration.claim_pack_idempotency
       SET response_body = $1
       WHERE tenant_id = $2::uuid
         AND principal_id = $3::uuid
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND state = 'completed'
       RETURNING audit_id`,
      [
        responseBody,
        TENANT_A,
        PRINCIPAL_A,
        createHash("sha256").update(IDEMPOTENCY_KEY).digest("hex"),
      ]
    );
    assert.equal(result.rowCount, 1);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

try {
  const legacy = await fetch(`${baseUrl}/api/search?q=must-not-run`, {
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(legacy.status, 404);
  assert.equal(legacy.headers.get("access-control-allow-origin"), null);

  const requestId = randomUUID();
  const original = requestBody(requestId);
  const first = await post(original, { origin: CONTENT_ORIGIN });
  assert.equal(first.response.status, 200);
  assert.equal(first.response.headers.get("access-control-allow-origin"), CONTENT_ORIGIN);
  assert.equal(first.body.schema_version, "v1");
  assert.equal(first.body.response_type, "claim_pack");
  assert.equal(first.body.product_boundary, "claims_and_evidence_only");
  assert.equal(first.body.tenant_id, TENANT_A);
  assert.equal(first.body.request_id, requestId);
  assert.equal(first.body.provenance.credential_id, CREDENTIAL_A);
  assert.ok(first.body.claims.length >= 1);
  assert.ok(first.body.citations.length >= 1);
  assert.ok(first.body.source_links.length >= 1);
  assert.equal(first.body.allowed_paraphrase_scope.content_generation_allowed, false);
  assert.equal(first.body.allowed_paraphrase_scope.campaign_strategy_allowed, false);
  assert.ok(Date.parse(first.body.valid_until) > Date.parse(first.body.provenance.created_at));
  for (const field of [
    "copy",
    "artifacts",
    "content_calendar",
    "channels",
    "publication_tasks",
    "campaign_strategy",
  ]) {
    assert.equal(first.body[field], undefined);
  }
  assert.equal(first.text.includes("TENANT_B_SECRET_MARKER"), false);

  const replay = await post(original, { origin: CONTENT_ORIGIN });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.text, first.text);

  const conflict = await post({ ...original, question: "Una afirmación distinta." });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");
  assert.equal(conflict.text.includes("Una afirmación distinta"), false);

  const crossTenantId = randomUUID();
  const crossTenant = await post(
    requestBody(crossTenantId, { tenant_id: TENANT_B }),
    { idempotencyKey: `claim-pack-cross-tenant-${randomUUID()}` }
  );
  assert.equal(crossTenant.response.status, 403);
  assert.equal(crossTenant.body.error.code, "forbidden");
  assert.equal(crossTenant.text.includes(TENANT_B), false);

  const boundaryId = randomUUID();
  const boundary = await post(
    requestBody(boundaryId, {
      question: "Genera copy, videos y un calendario de publicaciones con estas afirmaciones.",
    }),
    { idempotencyKey: `claim-pack-boundary-${randomUUID()}` }
  );
  assert.equal(boundary.response.status, 403);
  assert.equal(boundary.body.error.code, "forbidden");

  const unauthenticatedId = randomUUID();
  const unauthenticated = await post('{"secret":"unterminated', {
    raw: true,
    authorization: null,
    requestId: unauthenticatedId,
    idempotencyKey: `claim-pack-unauthenticated-${randomUUID()}`,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.tenant_id, null);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("secret"), false);

  await mutateStoredReplay(JSON.stringify({ secret_marker: SECRET_MARKER }));
  const corrupt = await post(original);
  assert.equal(corrupt.response.status, 500);
  assert.equal(corrupt.body.error.code, "internal_error");
  assert.equal(corrupt.text.includes(SECRET_MARKER), false);

  const recovered = await post(original);
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.body.request_id, requestId);

  process.stdout.write(
    `${JSON.stringify({
      result: "claim_pack_postgres_http_smoke_passed",
      legacyProductionStatus: 404,
      statuses: [200, 200, 409, 403, 403, 401, 500, 200],
      exactReplay: true,
      contentGenerated: false,
      crossTenantMarkerLeaked: false,
      corruptReplayMarkerLeaked: false,
    })}\n`
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDb();
}
