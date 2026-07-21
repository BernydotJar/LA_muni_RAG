import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const { Client } = pg;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREDENTIAL_A = "88888888-8888-4888-8888-888888888888";
const TOKEN_A = "disposable-tenant-a-api-token-20260718";
const IDEMPOTENCY_KEY = `postgres-runtime-${randomUUID()}`;
const SECRET_MARKER = "CORRUPT_STORED_RESPONSE_SECRET";

const requestBody = (requestId, overrides = {}) => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: requestId,
  tenant_id: TENANT_A,
  campaign_id: "runtime-campaign",
  community_id: "runtime-community",
  question:
    "¿Qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala y cómo se le da seguimiento?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "runtime-water-case",
    community_id: "runtime-community",
    facts: ["La comunidad documentó una necesidad de agua potable."],
    provided_documents: [],
    constraints: ["No inventar formularios, plazos, actores ni sistemas."],
  },
  requested_depth: "deep_dive",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: "2026-07-18T18:00:00.000Z",
    source_refs: ["runtime-campaign", "runtime-community"],
    credential_id: CREDENTIAL_A,
    audit_id: "abababab-abab-4bab-8bab-abababababab",
  },
  ...overrides,
});

const server = createApiServer({
  legacyApiEnabled: false,
  v1CorsAllowedOrigins: ["https://os-electoral.example"],
  requestTimeoutMs: 15_000,
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});

const address = server.address();
if (!address || typeof address === "string") throw new Error("smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;
const endpoint = `${baseUrl}/api/v1/procedure-queries`;

const post = async (body, options = {}) => {
  const requestId = body.request_id;
  const headers = {
    authorization: `Bearer ${TOKEN_A}`,
    "content-type": "application/json",
    "idempotency-key": options.idempotencyKey ?? IDEMPOTENCY_KEY,
    "x-request-id": requestId,
  };
  if (options.authorization === null) delete headers.authorization;
  if (options.origin) headers.origin = options.origin;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const corruptStoredReplay = async (requestId) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `UPDATE integration.procedure_query_idempotency
       SET response_body = $1
       WHERE tenant_id = $2::uuid
         AND principal_id = '77777777-7777-4777-8777-777777777777'::uuid
         AND operation = 'procedure_query_v1'
         AND idempotency_key_sha256 = decode($3, 'hex')
         AND state = 'completed'
       RETURNING audit_id`,
      [
        JSON.stringify({ secret_marker: SECRET_MARKER, request_id: requestId }),
        TENANT_A,
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
  const originalRequest = requestBody(requestId);
  const first = await post(originalRequest);
  assert.equal(first.response.status, 200);
  assert.equal(first.body.schema_version, "v1");
  assert.equal(first.body.response_type, "procedure_workflow");
  assert.equal(first.body.tenant_id, TENANT_A);
  assert.equal(first.body.request_id, requestId);
  assert.equal(first.body.approval_status, "draft");
  assert.equal(first.body.provenance.credential_id, CREDENTIAL_A);
  assert.ok(first.body.sources.length >= 1);
  assert.equal(first.body.sources[0].authority_status, "official_target_jurisdiction");
  assert.equal(first.text.includes("TENANT_B_SECRET_MARKER"), false);

  const replay = await post(originalRequest);
  assert.equal(replay.response.status, 200);
  assert.equal(replay.text, first.text);

  const conflict = await post({ ...originalRequest, question: "Una pregunta distinta." });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");

  const tenantMismatchId = randomUUID();
  const tenantMismatch = await post(
    requestBody(tenantMismatchId, { tenant_id: TENANT_B }),
    { idempotencyKey: "postgres-tenant-mismatch-20260718" }
  );
  assert.equal(tenantMismatch.response.status, 403);
  assert.equal(tenantMismatch.body.error.code, "forbidden");

  const boundaryId = randomUUID();
  const boundary = await post(
    requestBody(boundaryId, {
      question: "Diseña una estrategia electoral y un calendario de contenido.",
    }),
    { idempotencyKey: "postgres-boundary-check-20260718" }
  );
  assert.equal(boundary.response.status, 400);
  assert.equal(boundary.body.error.code, "product_boundary_violation");

  const unauthenticatedId = randomUUID();
  const unauthenticated = await post(requestBody(unauthenticatedId), {
    authorization: null,
    idempotencyKey: "postgres-unauthenticated-20260718",
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.tenant_id, null);
  assert.equal(unauthenticated.body.error.code, "unauthorized");

  await corruptStoredReplay(requestId);
  const corrupt = await post(originalRequest);
  assert.equal(corrupt.response.status, 500);
  assert.equal(corrupt.body.error.code, "internal_error");
  assert.equal(corrupt.text.includes(SECRET_MARKER), false);

  const recovered = await post(originalRequest);
  assert.equal(recovered.response.status, 200);
  assert.equal(recovered.body.request_id, requestId);

  const evidenceBundleId = randomUUID();
  const evidenceBundleRequest = requestBody(evidenceBundleId, {
    requested_output: "evidence_bundle",
  });
  const evidenceBundleKey = `postgres-evidence-bundle-${randomUUID()}`;
  const evidenceBundle = await post(evidenceBundleRequest, {
    idempotencyKey: evidenceBundleKey,
    origin: "https://os-electoral.example",
  });
  assert.equal(evidenceBundle.response.status, 200);
  assert.equal(
    evidenceBundle.response.headers.get("access-control-allow-origin"),
    "https://os-electoral.example"
  );
  assert.equal(evidenceBundle.body.response_type, "evidence_bundle");
  assert.equal(evidenceBundle.body.tenant_id, TENANT_A);
  assert.equal(evidenceBundle.body.request_id, evidenceBundleId);
  assert.ok(evidenceBundle.body.sources.length >= 1);
  assert.ok(evidenceBundle.body.citations.length >= 1);
  assert.ok(Array.isArray(evidenceBundle.body.claims));
  assert.ok(Array.isArray(evidenceBundle.body.missing_evidence));
  assert.ok(
    evidenceBundle.body.claims.length + evidenceBundle.body.missing_evidence.length >= 1
  );
  if (evidenceBundle.body.claims.length === 0) {
    assert.ok(evidenceBundle.body.missing_evidence.length >= 1);
  }
  for (const claim of evidenceBundle.body.claims) {
    assert.ok(Array.isArray(claim.citation_refs) && claim.citation_refs.length >= 1);
  }
  assert.equal(evidenceBundle.body.campaign_strategy, undefined);
  assert.equal(evidenceBundle.body.content_calendar, undefined);
  const evidenceBundleReplay = await post(evidenceBundleRequest, {
    idempotencyKey: evidenceBundleKey,
    origin: "https://os-electoral.example",
  });
  assert.equal(evidenceBundleReplay.response.status, 200);
  assert.equal(evidenceBundleReplay.text, evidenceBundle.text);

  const assessmentId = randomUUID();
  const assessmentRequest = requestBody(assessmentId, {
    requested_output: "procedure_assessment",
  });
  const assessmentKey = `postgres-procedure-assessment-${randomUUID()}`;
  const assessment = await post(assessmentRequest, {
    idempotencyKey: assessmentKey,
    origin: "https://os-electoral.example",
  });
  assert.equal(assessment.response.status, 200);
  assert.equal(assessment.body.response_type, "procedure_assessment");
  assert.equal(assessment.body.tenant_id, TENANT_A);
  assert.equal(assessment.body.request_id, assessmentId);
  assert.deepEqual(assessment.body.completed_requirements, []);
  assert.ok(Array.isArray(assessment.body.missing_requirements));
  assert.ok(assessment.body.missing_requirements.length >= 1);
  assert.ok(Array.isArray(assessment.body.blocked_steps));
  assert.ok(assessment.body.blocked_steps.length >= 1);
  assert.ok(Array.isArray(assessment.body.evidence_refs));
  assert.equal(assessment.body.campaign_strategy, undefined);
  assert.equal(assessment.body.content_calendar, undefined);
  const assessmentReplay = await post(assessmentRequest, {
    idempotencyKey: assessmentKey,
    origin: "https://os-electoral.example",
  });
  assert.equal(assessmentReplay.response.status, 200);
  assert.equal(assessmentReplay.text, assessment.text);

  process.stdout.write(
    `${JSON.stringify({
      result: "procedure_query_postgres_http_smoke_passed",
      legacyProductionStatus: 404,
      statuses: [200, 200, 409, 403, 400, 401, 500, 200, 200, 200, 200, 200],
      evidenceBundleValidated: true,
      procedureAssessmentValidated: true,
      tenantIsolationMarkerLeaked: false,
      corruptReplayMarkerLeaked: false,
    })}\n`
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDb();
}
