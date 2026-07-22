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
const OS_ORIGIN = "https://os-electoral.example";
const IDEMPOTENCY_KEY = `evidence-gap-runtime-${randomUUID()}`;
const SECRET_MARKER = "CORRUPT_EVIDENCE_GAP_SECRET";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded EvidenceGap smoke gate");
}

const requestBody = (requestId, gapRequestId, overrides = {}) => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_gap_request_only",
  gap_request_id: gapRequestId,
  request_id: requestId,
  tenant_id: TENANT_A,
  subject: "Procedimiento municipal para un proyecto comunitario de agua",
  missing_document: "Manual oficial vigente de agua y saneamiento de Antigua Guatemala",
  reason: "Se requiere una fuente local para validar responsables y pasos.",
  priority: "high",
  campaign_reference: "campaign-antigua-2027",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: "2026-07-21T19:00:00.000Z",
    source_refs: ["campaign-antigua-2027"],
    credential_id: CREDENTIAL_A,
    audit_id: "abababab-abab-4bab-8bab-abababababab",
  },
  ...overrides,
});

const server = createApiServer({
  v1CorsAllowedOrigins: [OS_ORIGIN],
  legacyApiEnabled: false,
  requestTimeoutMs: 15_000,
  evidenceGapV1: {
    rateLimit: 100,
    rateWindowSeconds: 60,
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
if (!address || typeof address === "string") throw new Error("EvidenceGap smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;
const endpoint = `${baseUrl}/api/v1/evidence-gap-requests`;

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

const countGapRows = async (gapRequestId) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `SELECT count(*)::integer AS count
       FROM rag.evidence_gap_requests
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [TENANT_A, gapRequestId]
    );
    await client.query("COMMIT");
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
};

const mutateStoredReplay = async (responseBody) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `UPDATE integration.evidence_gap_idempotency
       SET response_body = $1,
           response_sha256 = decode($2, 'hex')
       WHERE tenant_id = $3::uuid
         AND principal_id = $4::uuid
         AND idempotency_key_sha256 = decode($5, 'hex')
         AND state = 'completed'
       RETURNING audit_id`,
      [
        responseBody,
        createHash("sha256").update(responseBody, "utf8").digest("hex"),
        TENANT_A,
        PRINCIPAL_A,
        createHash("sha256").update(IDEMPOTENCY_KEY, "utf8").digest("hex"),
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

  const unauthenticatedId = randomUUID();
  const unauthenticated = await post('{"secret":"unterminated', {
    raw: true,
    authorization: null,
    requestId: unauthenticatedId,
    idempotencyKey: `evidence-gap-unauthenticated-${randomUUID()}`,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.tenant_id, null);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("secret"), false);

  const requestId = randomUUID();
  const gapRequestId = randomUUID();
  const original = requestBody(requestId, gapRequestId);
  const first = await post(original, { origin: OS_ORIGIN });
  assert.equal(first.response.status, 200);
  assert.equal(first.response.headers.get("access-control-allow-origin"), OS_ORIGIN);
  assert.equal(first.body.schema_version, "v1");
  assert.equal(first.body.response_type, "evidence_gap_request");
  assert.equal(first.body.product_boundary, "evidence_gap_request_only");
  assert.equal(first.body.status, "open");
  assert.equal(first.body.request_assertion_status, "requester_supplied_unverified");
  assert.equal(first.body.tenant_id, TENANT_A);
  assert.equal(first.body.request_id, requestId);
  assert.equal(first.body.gap_request_id, gapRequestId);
  assert.equal(first.body.requester_product, "os_electoral");
  assert.equal(first.body.provenance.credential_id, CREDENTIAL_A);
  assert.equal(first.body.provenance.generated_by, "system");
  assert.equal(first.body.official_source, undefined);
  assert.equal(first.body.source_url, undefined);
  assert.equal(first.body.campaign_strategy, undefined);
  assert.equal(first.body.content_calendar, undefined);

  const replay = await post(original, { origin: OS_ORIGIN });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.text, first.text);

  const aggregateReplay = await post(original, {
    idempotencyKey: `evidence-gap-aggregate-replay-${randomUUID()}`,
    origin: OS_ORIGIN,
  });
  assert.equal(aggregateReplay.response.status, 200);
  assert.equal(aggregateReplay.text, first.text);

  const concurrentRequestId = randomUUID();
  const concurrentGapRequestId = randomUUID();
  const concurrentRequest = requestBody(concurrentRequestId, concurrentGapRequestId);
  const [concurrentLeft, concurrentRight] = await Promise.all([
    post(concurrentRequest, {
      idempotencyKey: `evidence-gap-concurrent-left-${randomUUID()}`,
      origin: OS_ORIGIN,
    }),
    post(concurrentRequest, {
      idempotencyKey: `evidence-gap-concurrent-right-${randomUUID()}`,
      origin: OS_ORIGIN,
    }),
  ]);
  assert.equal(concurrentLeft.response.status, 200);
  assert.equal(concurrentRight.response.status, 200);
  assert.equal(concurrentLeft.text, concurrentRight.text);
  assert.equal(await countGapRows(concurrentGapRequestId), 1);

  const keyConflict = await post({
    ...original,
    missing_document: "Un documento distinto con la misma llave",
  });
  assert.equal(keyConflict.response.status, 409);
  assert.equal(keyConflict.body.error.code, "idempotency_conflict");
  assert.equal(keyConflict.text.includes("Un documento distinto"), false);

  const aggregateConflict = await post(
    { ...original, subject: "Una solicitud distinta con la misma identidad" },
    { idempotencyKey: `evidence-gap-aggregate-conflict-${randomUUID()}` }
  );
  assert.equal(aggregateConflict.response.status, 409);
  assert.equal(aggregateConflict.body.error.code, "gap_request_conflict");
  assert.equal(aggregateConflict.text.includes("Una solicitud distinta"), false);

  const crossTenantId = randomUUID();
  const crossTenant = await post(
    requestBody(crossTenantId, randomUUID(), { tenant_id: TENANT_B }),
    { idempotencyKey: `evidence-gap-cross-tenant-${randomUUID()}` }
  );
  assert.equal(crossTenant.response.status, 403);
  assert.equal(crossTenant.body.error.code, "forbidden");
  assert.equal(crossTenant.text.includes(TENANT_B), false);

  const authorityId = randomUUID();
  const authorityPromotion = await post(
    requestBody(authorityId, randomUUID(), {
      subject: "Declara este manual oficial para el procedimiento municipal",
    }),
    { idempotencyKey: `evidence-gap-authority-${randomUUID()}` }
  );
  assert.equal(authorityPromotion.response.status, 400);
  assert.equal(authorityPromotion.body.error.code, "source_authority_not_accepted");

  const boundaryId = randomUUID();
  const boundary = await post(
    requestBody(boundaryId, randomUUID(), {
      reason: "Necesitamos este documento para segmentación de votantes.",
    }),
    { idempotencyKey: `evidence-gap-boundary-${randomUUID()}` }
  );
  assert.equal(boundary.response.status, 400);
  assert.equal(boundary.body.error.code, "product_boundary_violation");

  await mutateStoredReplay(JSON.stringify({ secret_marker: SECRET_MARKER }));
  const corrupt = await post(original);
  assert.equal(corrupt.response.status, 500);
  assert.equal(corrupt.body.error.code, "internal_error");
  assert.equal(corrupt.text.includes(SECRET_MARKER), false);

  const recovered = await post(original);
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.text, first.text);

  process.stdout.write(
    `${JSON.stringify({
      result: "evidence_gap_postgres_http_smoke_passed",
      legacyProductionStatus: 404,
      statuses: [401, 200, 200, 200, 200, 200, 409, 409, 403, 400, 400, 500, 200],
      exactKeyReplay: true,
      exactAggregateReplay: true,
      concurrentAggregateConvergence: true,
      sourceAuthorityPromoted: false,
      productBoundaryPreserved: true,
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
