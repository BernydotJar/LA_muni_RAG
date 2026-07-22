import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const { Client } = pg;
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CASE_CREDENTIAL = "c4000000-0000-4000-8000-000000000001";
const REVIEWER_CREDENTIAL = "23232323-2323-4323-8323-232323232323";
const CASE_PRINCIPAL = "c3000000-0000-4000-8000-000000000001";
const WORKFLOW_ID = "62626262-6262-4262-8262-626262626262";
const CASE_TOKEN = "procedure-case-operator-token-20260722-0001";
const REVIEWER_TOKEN = "workflow-reviewer-api-token-20260721-00000001";
const TENANT_B_VIEWER_TOKEN = "workflow-viewer-b-api-token-20260721-00000001";
const ORIGIN = "https://admin.example";
const SECRET_MARKER = "CORRUPT_CASE_TRANSPORT_SECRET";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded ProcedureCase smoke gate");
}

const server = createApiServer({
  legacyApiEnabled: false,
  v1CorsAllowedOrigins: [ORIGIN],
  requestTimeoutMs: 15_000,
  procedureCaseV1: { rateLimit: 1_000, rateWindowSeconds: 60 },
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("ProcedureCase smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;
const collection = `${baseUrl}/api/v1/procedure-cases`;

const createBody = (requestId, caseKey) => ({
  schema_version: "v1",
  operation: "create",
  request_id: requestId,
  tenant_id: TENANT_A,
  case_key: caseKey,
  workflow_version_id: WORKFLOW_ID,
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  community_reference: `community:${caseKey}`,
  follow_up_at: "2026-08-01T15:00:00.000Z",
  provenance: { credential_id: CASE_CREDENTIAL },
});

const request = async (path, options = {}) => {
  const method = options.method ?? "POST";
  const headers = new Headers();
  if (options.token !== null) headers.set("authorization", `Bearer ${options.token ?? CASE_TOKEN}`);
  headers.set("x-request-id", options.requestId ?? options.body?.request_id ?? randomUUID());
  if (options.origin) headers.set("origin", options.origin);
  if (method === "POST" || method === "PATCH") {
    headers.set("content-type", "application/json");
    headers.set("idempotency-key", options.idempotencyKey ?? `procedure-case-${randomUUID()}`);
  }
  const response = await fetch(path, {
    method,
    headers,
    body: method === "POST" || method === "PATCH"
      ? options.rawBody ?? JSON.stringify(options.body ?? {})
      : undefined,
  });
  const text = await response.text();
  return { response, text, body: text ? JSON.parse(text) : {} };
};

const countByKey = async (caseKey) => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      "SELECT count(*)::integer AS count FROM rag.procedure_cases WHERE tenant_id = $1::uuid AND case_key = $2",
      [TENANT_A, caseKey]
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

const corruptTransportReplay = async (key) => {
  const body = JSON.stringify({ secret_marker: SECRET_MARKER });
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `UPDATE integration.procedure_case_idempotency
       SET response_body = $1, response_sha256 = decode($2, 'hex')
       WHERE tenant_id = $3::uuid AND principal_id = $4::uuid
         AND operation = 'procedure_case_create_v1'
         AND idempotency_key_sha256 = decode($5, 'hex')
         AND state = 'completed'`,
      [
        body,
        createHash("sha256").update(body, "utf8").digest("hex"),
        TENANT_A,
        CASE_PRINCIPAL,
        createHash("sha256").update(key, "utf8").digest("hex"),
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
  const legacy = await fetch(`${baseUrl}/api/search?q=must-not-run`);
  assert.equal(legacy.status, 404);

  const preflight = await fetch(collection, {
    method: "OPTIONS",
    headers: { origin: ORIGIN },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "POST, OPTIONS");

  const unauthenticated = await request(collection, {
    token: null,
    rawBody: '{"private":"unterminated',
    requestId: randomUUID(),
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("private"), false);

  const requestId = randomUUID();
  const caseKey = `water-community-http-${randomUUID()}`;
  const idempotencyKey = `procedure-case-http-${randomUUID()}`;
  const body = createBody(requestId, caseKey);
  const first = await request(collection, {
    body,
    requestId,
    idempotencyKey,
    origin: ORIGIN,
  });
  assert.equal(first.response.status, 201);
  assert.equal(first.response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(first.body.response_type, "procedure_case");
  assert.equal(first.body.case.workflow_version_id, WORKFLOW_ID);
  assert.equal(first.body.case.workflow_version_number, 1);
  assert.equal(first.body.case.steps.length, 2);
  assert.equal(first.body.case.status, "active");
  assert.equal(first.body.case.validation_state, "unreviewed");
  assert.match(first.body.limitations.join(" "), /does not prove legal compliance/i);
  assert.equal(first.body.legal_status, undefined);
  assert.equal(first.body.municipal_approval, undefined);

  const exactReplay = await request(collection, { body, requestId, idempotencyKey });
  assert.equal(exactReplay.response.status, 201);
  assert.equal(exactReplay.text, first.text);

  const aggregateReplay = await request(collection, {
    body,
    requestId,
    idempotencyKey: `procedure-case-aggregate-${randomUUID()}`,
  });
  assert.equal(aggregateReplay.response.status, 201);
  assert.equal(aggregateReplay.text, first.text);
  assert.equal(await countByKey(caseKey), 1);

  const concurrentRequestId = randomUUID();
  const concurrentCaseKey = `water-community-concurrent-${randomUUID()}`;
  const concurrentBody = createBody(concurrentRequestId, concurrentCaseKey);
  const [left, right] = await Promise.all([
    request(collection, {
      body: concurrentBody,
      requestId: concurrentRequestId,
      idempotencyKey: `procedure-case-left-${randomUUID()}`,
    }),
    request(collection, {
      body: concurrentBody,
      requestId: concurrentRequestId,
      idempotencyKey: `procedure-case-right-${randomUUID()}`,
    }),
  ]);
  assert.equal(left.response.status, 201);
  assert.equal(right.response.status, 201);
  assert.equal(left.text, right.text);
  assert.equal(await countByKey(concurrentCaseKey), 1);

  const keyConflict = await request(collection, {
    requestId,
    idempotencyKey,
    body: { ...body, case_key: `different-${randomUUID()}` },
  });
  assert.equal(keyConflict.response.status, 409);
  assert.equal(keyConflict.body.error.code, "idempotency_conflict");

  const caseId = first.body.case.case_id;
  const stepRequestId = randomUUID();
  const step = await request(`${collection}/${caseId}`, {
    method: "PATCH",
    requestId: stepRequestId,
    idempotencyKey: `procedure-case-step-${randomUUID()}`,
    body: {
      schema_version: "v1",
      operation: "update",
      request_id: stepRequestId,
      tenant_id: TENANT_A,
      case_id: caseId,
      expected_revision: 1,
      action: { type: "set_step_state", step_id: "need-intake", state: "in_progress" },
      provenance: { credential_id: CASE_CREDENTIAL },
    },
  });
  assert.equal(step.response.status, 200);
  assert.equal(step.body.case.revision, 2);
  assert.equal(step.body.case.current_step_id, "need-intake");

  const invalidDocumentId = randomUUID();
  const invalidDocumentRequestId = randomUUID();
  const invalidDocument = await request(`${collection}/${caseId}`, {
    method: "PATCH",
    requestId: invalidDocumentRequestId,
    idempotencyKey: `procedure-case-document-${randomUUID()}`,
    body: {
      schema_version: "v1",
      operation: "update",
      request_id: invalidDocumentRequestId,
      tenant_id: TENANT_A,
      case_id: caseId,
      expected_revision: 2,
      action: {
        type: "record_document",
        requirement_id: "community-request",
        state: "reviewed",
        document_version_id: invalidDocumentId,
      },
      provenance: { credential_id: CASE_CREDENTIAL },
    },
  });
  assert.equal(invalidDocument.response.status, 404);
  assert.equal(invalidDocument.body.error.code, "not_found");
  assert.equal(invalidDocument.text.includes(invalidDocumentId), false);

  const reviewRequestId = randomUUID();
  const review = await request(`${collection}/${caseId}`, {
    method: "PATCH",
    token: REVIEWER_TOKEN,
    requestId: reviewRequestId,
    idempotencyKey: `procedure-case-review-${randomUUID()}`,
    body: {
      schema_version: "v1",
      operation: "update",
      request_id: reviewRequestId,
      tenant_id: TENANT_A,
      case_id: caseId,
      expected_revision: 2,
      action: { type: "set_validation_state", validation_state: "in_review" },
      provenance: { credential_id: REVIEWER_CREDENTIAL },
    },
  });
  assert.equal(review.response.status, 200);
  assert.equal(review.body.case.revision, 3);
  assert.equal(review.body.case.validation_state, "in_review");
  assert.equal(review.body.case.status, "ready_for_review");

  const tenantBRead = await request(`${collection}/${caseId}`, {
    method: "GET",
    token: TENANT_B_VIEWER_TOKEN,
    requestId: randomUUID(),
  });
  assert.equal(tenantBRead.response.status, 404);
  assert.equal(tenantBRead.body.error.code, "not_found");
  assert.equal(tenantBRead.text.includes(TENANT_A), false);

  await corruptTransportReplay(idempotencyKey);
  const recovered = await request(collection, { body, requestId, idempotencyKey });
  assert.equal(recovered.response.status, 201);
  assert.equal(recovered.text, first.text);
  assert.equal(recovered.text.includes(SECRET_MARKER), false);

  const read = await request(`${collection}/${caseId}`, {
    method: "GET",
    requestId: randomUUID(),
  });
  assert.equal(read.response.status, 200);
  assert.equal(read.body.case.revision, 3);
  assert.equal(read.body.case.audit_trail.length, 3);

  const closeRequestId = randomUUID();
  const closed = await request(`${collection}/${caseId}`, {
    method: "PATCH",
    requestId: closeRequestId,
    idempotencyKey: `procedure-case-close-${randomUUID()}`,
    body: {
      schema_version: "v1",
      operation: "update",
      request_id: closeRequestId,
      tenant_id: TENANT_A,
      case_id: caseId,
      expected_revision: 3,
      action: { type: "close_case", note: "Operational tracking closed; no legal conclusion." },
      provenance: { credential_id: CASE_CREDENTIAL },
    },
  });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.body.case.status, "closed");

  const mutateClosedRequestId = randomUUID();
  const mutateClosed = await request(`${collection}/${caseId}`, {
    method: "PATCH",
    requestId: mutateClosedRequestId,
    idempotencyKey: `procedure-case-closed-${randomUUID()}`,
    body: {
      schema_version: "v1",
      operation: "update",
      request_id: mutateClosedRequestId,
      tenant_id: TENANT_A,
      case_id: caseId,
      expected_revision: 4,
      action: { type: "set_follow_up", follow_up_at: null },
      provenance: { credential_id: CASE_CREDENTIAL },
    },
  });
  assert.equal(mutateClosed.response.status, 409);
  assert.equal(mutateClosed.body.error.code, "invalid_transition");

  process.stdout.write(`${JSON.stringify({
    result: "procedure_case_postgres_http_smoke_passed",
    statuses: [401, 201, 201, 201, 201, 201, 409, 200, 404, 200, 404, 201, 200, 200, 409],
    approvedWorkflowBinding: true,
    exactTransportReplay: true,
    exactAggregateReplay: true,
    concurrentAggregateConvergence: true,
    crossTenantMarkerLeaked: false,
    corruptTransportMarkerLeaked: false,
    legalStatusPromoted: false,
  })}\n`);
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await closeDb();
}
