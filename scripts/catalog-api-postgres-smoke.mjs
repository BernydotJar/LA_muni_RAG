import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { closeDb, pool } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRINCIPAL_CREDENTIAL_A = "33333333-3333-4333-8333-333333333333";
const PRINCIPAL_CREDENTIAL_B = "34343434-3434-4343-8343-343434343434";
const TOKEN_A = "catalog-manager-a-token-20260721-000000000001";
const TOKEN_B = "catalog-manager-b-token-20260721-000000000001";
const ORIGIN = "https://admin.example";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded catalog smoke gate");
}

const server = createApiServer({
  legacyApiEnabled: false,
  v1CorsAllowedOrigins: [ORIGIN],
  requestTimeoutMs: 15_000,
  catalogV1: { rateLimit: 1_000, rateWindowSeconds: 60 },
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});
const address = server.address();
if (!address || typeof address === "string") throw new Error("catalog smoke server did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;

const call = async (path, options = {}) => {
  const method = options.method ?? "GET";
  const headers = new Headers();
  const token = options.token === undefined ? TOKEN_A : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? options.body?.request_id ?? randomUUID());
  if (options.origin) headers.set("origin", options.origin);
  if (method === "POST") {
    headers.set("content-type", "application/json");
    headers.set("idempotency-key", options.idempotencyKey ?? `catalog-${randomUUID()}`);
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: method === "POST" ? options.rawBody ?? JSON.stringify(options.body ?? {}) : undefined,
  });
  const text = await response.text();
  return { response, text, body: text ? JSON.parse(text) : {} };
};

try {
  const legacy = await fetch(`${baseUrl}/api/search?q=must-not-run`);
  assert.equal(legacy.status, 404);

  const preflight = await fetch(`${baseUrl}/api/v1/sources`, {
    method: "OPTIONS",
    headers: { origin: ORIGIN },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");

  const unauthenticated = await call("/api/v1/sources", {
    method: "POST",
    token: null,
    requestId: randomUUID(),
    rawBody: '{"secret":"unterminated',
    idempotencyKey: `catalog-unauth-${randomUUID()}`,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("secret"), false);

  const sourceRequestId = randomUUID();
  const sourceKey = `catalog-http-${randomUUID()}`;
  const sourceRequest = {
    schema_version: "v1",
    operation: "source_create",
    request_id: sourceRequestId,
    tenant_id: TENANT_A,
    source_key: sourceKey,
    title: "Manual comparativo pendiente de revisión",
    category: "procedure_manual",
    target_jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
    source_jurisdiction: "Municipio de Mixco, Guatemala",
    source_relation: "comparative",
    discovery_status: "identified",
    discovery_url: "https://www2.munimixco.gob.gt/manual.pdf",
    artifact_url: null,
    observed_version: "discovery-2026-07",
    publication_date: null,
    effective_date: null,
    limitations: ["Vigencia y aplicabilidad pendientes de revision."],
    provenance: { credential_id: PRINCIPAL_CREDENTIAL_A },
  };
  const sourceKeyHeader = `catalog-source-${randomUUID()}`;
  const source = await call("/api/v1/sources", {
    method: "POST",
    body: sourceRequest,
    requestId: sourceRequestId,
    idempotencyKey: sourceKeyHeader,
    origin: ORIGIN,
  });
  assert.equal(source.response.status, 201);
  assert.equal(source.body.source.validation_state, "unreviewed");
  assert.equal(source.body.source.official_source, false);
  assert.equal(source.body.source.official_for_target_jurisdiction, false);
  assert.equal(source.body.source.acquisition_state, "not_acquired");
  assert.equal(source.body.source.ingestion_state, "not_ingested");
  assert.equal(source.body.source.retrieval_state, "not_indexed");
  assert.match(source.body.source.limitations.join(" "), /Referencia comparativa de otra municipalidad/i);

  const sourceReplay = await call("/api/v1/sources", {
    method: "POST",
    body: sourceRequest,
    requestId: sourceRequestId,
    idempotencyKey: sourceKeyHeader,
  });
  assert.equal(sourceReplay.response.status, 201);
  assert.equal(sourceReplay.text, source.text);

  const changed = { ...sourceRequest, title: "Changed" };
  const conflict = await call("/api/v1/sources", {
    method: "POST",
    body: changed,
    requestId: sourceRequestId,
    idempotencyKey: sourceKeyHeader,
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");

  const corruptedSource = structuredClone(source.body);
  corruptedSource.source.official_source = true;
  corruptedSource.source.official_for_target_jurisdiction = true;
  const corruptedSourceBody = JSON.stringify(corruptedSource);
  const corruptedSourceHash = createHash("sha256").update(corruptedSourceBody).digest("hex");
  const idempotencyKeyHash = createHash("sha256").update(sourceKeyHeader).digest("hex");
  const corruptionClient = await pool.connect();
  try {
    await corruptionClient.query("BEGIN");
    await corruptionClient.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const changedReplay = await corruptionClient.query(`UPDATE rag.catalog_api_idempotency
      SET response_body = $1, response_sha256 = decode($2, 'hex')
      WHERE tenant_id = $3::uuid AND operation = 'source_create_v1'
        AND idempotency_key_sha256 = decode($4, 'hex')`, [
      corruptedSourceBody, corruptedSourceHash, TENANT_A, idempotencyKeyHash,
    ]);
    assert.equal(changedReplay.rowCount, 1);
    await corruptionClient.query("COMMIT");
  } catch (error) {
    await corruptionClient.query("ROLLBACK");
    throw error;
  } finally {
    corruptionClient.release();
  }
  const corruptReplay = await call("/api/v1/sources", {
    method: "POST",
    body: sourceRequest,
    requestId: sourceRequestId,
    idempotencyKey: sourceKeyHeader,
  });
  assert.equal(corruptReplay.response.status, 500);
  assert.equal(corruptReplay.body.error.code, "replay_invalid");
  assert.equal(corruptReplay.text.includes("official_source"), false);
  const verificationClient = await pool.connect();
  try {
    await verificationClient.query("BEGIN");
    await verificationClient.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const remaining = await verificationClient.query(`SELECT count(*)::integer AS count
      FROM rag.catalog_api_idempotency
      WHERE tenant_id = $1::uuid AND operation = 'source_create_v1'
        AND idempotency_key_sha256 = decode($2, 'hex')`, [TENANT_A, idempotencyKeyHash]);
    assert.equal(remaining.rows[0].count, 0);
    await verificationClient.query("COMMIT");
  } catch (error) {
    await verificationClient.query("ROLLBACK");
    throw error;
  } finally {
    verificationClient.release();
  }

  const promoted = await call("/api/v1/sources", {
    method: "POST",
    requestId: randomUUID(),
    idempotencyKey: `catalog-promotion-${randomUUID()}`,
    body: { ...sourceRequest, request_id: randomUUID(), official_source: true },
  });
  assert.equal(promoted.response.status, 400);
  assert.equal(promoted.body.error.code, "invalid_request");

  const sourceId = source.body.source.source_id;
  const documentRequestId = randomUUID();
  const documentRequest = {
    schema_version: "v1",
    operation: "document_create",
    request_id: documentRequestId,
    tenant_id: TENANT_A,
    source_id: sourceId,
    title: "Manual declarado para revisión",
    document_type: "manual",
    document_scope: "municipal",
    issuing_authority: "Municipalidad de Mixco",
    confidentiality: "public",
    version: {
      version_label: "discovery-2026-07",
      source_url: "https://www2.munimixco.gob.gt/manual.pdf",
      original_filename: "manual.pdf",
      mime_type: "application/pdf",
      content_sha256: randomUUID().replaceAll("-", "").padEnd(64, "a").slice(0, 64),
      page_count: null,
    },
    provenance: { credential_id: PRINCIPAL_CREDENTIAL_A },
  };
  const documentIdempotency = `catalog-document-${randomUUID()}`;
  const document = await call("/api/v1/documents", {
    method: "POST",
    body: documentRequest,
    requestId: documentRequestId,
    idempotencyKey: documentIdempotency,
  });
  assert.equal(document.response.status, 201);
  assert.equal(document.body.document.document_status, "draft");
  assert.equal(document.body.document.version.extraction_state, "queued");
  assert.equal(document.body.document.artifact_acceptance.state, "not_accepted");
  assert.equal(document.body.document.ingestion_state, "not_started");
  assert.equal(document.body.document.retrieval_state, "not_indexed");
  assert.equal(/object_key|object_namespace|signed_url|scanner_engine|lease_token|fencing_token/i.test(document.text), false);

  const documentReplay = await call("/api/v1/documents", {
    method: "POST",
    body: documentRequest,
    requestId: documentRequestId,
    idempotencyKey: documentIdempotency,
  });
  assert.equal(documentReplay.response.status, 201);
  assert.equal(documentReplay.text, document.text);

  const sources = await call(`/api/v1/sources?tenant_id=${TENANT_A}&limit=100`);
  assert.equal(sources.response.status, 200);
  assert.equal(sources.body.items.some((item) => item.source_id === sourceId), true);
  assert.equal(sources.text.includes("TENANT_B"), false);

  const documents = await call(`/api/v1/documents?tenant_id=${TENANT_A}&limit=100`);
  assert.equal(documents.response.status, 200);
  assert.equal(documents.body.items.some((item) => item.document_id === document.body.document.document_id), true);
  assert.equal(/object_key|object_namespace|signed_url|scanner_engine/i.test(documents.text), false);

  const jobs = await call(`/api/v1/ingestion-jobs?tenant_id=${TENANT_A}&limit=100`);
  assert.equal(jobs.response.status, 200);
  assert.equal(jobs.body.items.some((item) => item.status === "retry_wait"), true);
  assert.equal(/lease_token|fencing_token|pipeline_config|error_message|object_key|object_namespace/i.test(jobs.text), false);

  const procedures = await call(`/api/v1/procedures?tenant_id=${TENANT_A}&limit=100`);
  assert.equal(procedures.response.status, 200);
  assert.equal(procedures.body.items.some((item) => item.procedure_key === "catalog.water.a"), true);
  assert.equal(procedures.text.includes("TENANT_B_PRIVATE_PROCEDURE"), false);
  assert.equal(/workflow_definition|review_notes|approval_notes/i.test(procedures.text), false);

  const crossTenant = await call(`/api/v1/sources?tenant_id=${TENANT_A}`, {
    token: TOKEN_B,
    requestId: randomUUID(),
  });
  assert.equal(crossTenant.response.status, 403);
  assert.equal(crossTenant.body.error.code, "forbidden");
  assert.equal(crossTenant.text.includes(sourceId), false);

  const tenantB = await call(`/api/v1/sources?tenant_id=${TENANT_B}`, {
    token: TOKEN_B,
    requestId: randomUUID(),
  });
  assert.equal(tenantB.response.status, 200);
  assert.equal(tenantB.text.includes(sourceId), false);

  process.stdout.write(`${JSON.stringify({
    result: "catalog_api_postgres_http_smoke_passed",
    statuses: [401, 201, 201, 409, 500, 400, 201, 201, 200, 200, 200, 200, 403, 200],
    sourceAuthorityPromoted: false,
    exactSourceReplay: true,
    corruptReplayCleanupCommitted: true,
    exactDocumentReplay: true,
    privateArtifactCoordinatesReturned: false,
    internalJobSecretsReturned: false,
    crossTenantMarkerLeaked: false,
  })}\n`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await closeDb();
}
