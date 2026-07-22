import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { DEFAULT_VECTOR_DIMENSION } from "../dist/embeddings/pgVectorRepository.js";
import { withTenantTransaction } from "../dist/security/index.js";
import { createApiServer } from "../dist/server.js";

const { Pool } = pg;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREDENTIAL_A = "44444444-4444-4444-8444-444444444444";
const TOKEN_A = "disposable-ingestion-tenant-a-api-token-20260719";
const TOKEN_B = "disposable-ingestion-tenant-b-api-token-20260719";
const VIEWER_TOKEN = "disposable-ingestion-viewer-api-token-20260719";
const VERSION_A6 = "aaaaaaaa-0000-4000-8000-000000000106";
const VERSION_A7 = "aaaaaaaa-0000-4000-8000-000000000107";
const VERSION_B1 = "bbbbbbbb-0000-4000-8000-000000000101";
const ARTIFACT_A6 = "6".repeat(64);
const ARTIFACT_A7 = "7".repeat(64);
const TRUSTED_ORIGIN = "https://municipal-admin.example";
const PRIMARY_KEY = "ingestion-api-primary-20260719";
const DUPLICATE_KEY = "ingestion-api-duplicate-20260719";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded ingestion API smoke gate");
}

const pipelineConfig = {
  contractVersion: "v1",
  extractor: { name: "bounded_document_registry", version: "1.0.0" },
  chunkPlanner: { name: "section_text_v1", maxChars: 1_800, overlapChars: 180 },
  embedding: {
    provider: "test-provider",
    model: "test-model-v1",
    dimension: DEFAULT_VECTOR_DIMENSION,
  },
};

const server = createApiServer({
  evidenceDependencies: {
    keywordSearch: async () => [],
    phraseSearch: async () => [],
  },
  ingestionJobV1: {
    pipelineConfig,
    maxAttempts: 3,
    enqueueRateLimit: 5,
    getRateLimit: 10,
    rateWindowSeconds: 60,
  },
  v1CorsAllowedOrigins: [TRUSTED_ORIGIN],
  legacyApiEnabled: false,
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
if (!address || typeof address === "string") throw new Error("ingestion API smoke did not bind");
const baseUrl = `http://127.0.0.1:${address.port}`;
const jobsEndpoint = `${baseUrl}/api/v1/ingestion-jobs`;

const requestBody = ({
  requestId,
  tenantId = TENANT_A,
  documentVersionId = VERSION_A6,
  artifactSha256 = ARTIFACT_A6,
}) => ({
  schema_version: "v1",
  request_id: requestId,
  tenant_id: tenantId,
  pipeline_profile: "municipal_document_v1",
  document_version_id: documentVersionId,
  artifact_sha256: artifactSha256,
});

const parseJson = async (response) => {
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const post = async ({
  token = TOKEN_A,
  idempotencyKey = PRIMARY_KEY,
  body,
  requestId = body?.request_id ?? randomUUID(),
  origin,
  raw = false,
}) => {
  const headers = new Headers({
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
    "x-request-id": requestId,
  });
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  if (origin) headers.set("origin", origin);
  return parseJson(await fetch(jobsEndpoint, {
    method: "POST",
    headers,
    body: raw ? String(body) : JSON.stringify(body),
  }));
};

const get = async ({ token, jobId, requestId = randomUUID() }) =>
  parseJson(await fetch(`${jobsEndpoint}/${jobId}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
      "x-request-id": requestId,
    },
  }));

const inspectionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 5_000,
  options: "-c statement_timeout=15000 -c lock_timeout=3000 -c idle_in_transaction_session_timeout=15000",
});

try {
  const legacy = await fetch(`${baseUrl}/api/search?q=must-not-run`, {
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(legacy.status, 404);
  assert.equal(legacy.headers.get("access-control-allow-origin"), null);

  const trustedPreflight = await fetch(jobsEndpoint, {
    method: "OPTIONS",
    headers: { origin: TRUSTED_ORIGIN },
  });
  assert.equal(trustedPreflight.status, 204);
  assert.equal(trustedPreflight.headers.get("access-control-allow-origin"), TRUSTED_ORIGIN);
  assert.equal(trustedPreflight.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");
  assert.equal(
    trustedPreflight.headers.get("access-control-allow-headers"),
    "authorization, content-type, idempotency-key, x-request-id"
  );
  const untrustedPreflight = await fetch(jobsEndpoint, {
    method: "OPTIONS",
    headers: { origin: "https://untrusted.example" },
  });
  assert.equal(untrustedPreflight.status, 204);
  assert.equal(untrustedPreflight.headers.get("access-control-allow-origin"), null);

  const unauthenticated = await post({
    token: null,
    idempotencyKey: "unauthenticated-body-is-never-parsed",
    body: '{"synthetic_secret":"unterminated',
    requestId: randomUUID(),
    raw: true,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.tenant_id, null);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.response.headers.get("connection"), "close");
  assert.equal(unauthenticated.text.includes("synthetic_secret"), false);

  const viewerRequestId = randomUUID();
  const viewerDenied = await post({
    token: VIEWER_TOKEN,
    idempotencyKey: "viewer-ingestion-denied-20260719",
    body: requestBody({ requestId: viewerRequestId }),
  });
  assert.equal(viewerDenied.response.status, 403);
  assert.equal(viewerDenied.body.error.code, "forbidden");
  assert.equal(viewerDenied.response.headers.get("connection"), "close");

  const mismatchRequestId = randomUUID();
  const tenantDenied = await post({
    idempotencyKey: "tenant-mismatch-denied-20260719",
    body: requestBody({
      requestId: mismatchRequestId,
      tenantId: TENANT_B,
      documentVersionId: VERSION_B1,
      artifactSha256: "1".repeat(64),
    }),
  });
  assert.equal(tenantDenied.response.status, 403);
  assert.equal(tenantDenied.body.error.code, "forbidden");
  assert.equal(tenantDenied.text.includes(TENANT_B), false);

  const firstRequestId = randomUUID();
  const first = await post({
    body: requestBody({ requestId: firstRequestId }),
    origin: TRUSTED_ORIGIN,
  });
  assert.equal(first.response.status, 202);
  assert.equal(first.response.headers.get("access-control-allow-origin"), TRUSTED_ORIGIN);
  assert.equal(first.body.result, "new");
  assert.equal(first.body.tenant_id, TENANT_A);
  assert.equal(first.body.provenance.credential_id, CREDENTIAL_A);
  assert.equal(first.body.job.document_version_id, VERSION_A6);
  assert.equal(first.body.job.pipeline_profile, "municipal_document_v1");
  assert.equal(first.body.job.status, "queued");
  assert.equal(first.text.includes(ARTIFACT_A6), false);
  assert.equal(/artifact_sha256|lease_token|test-provider|test-model/i.test(first.text), false);
  const jobId = first.body.job.job_id;

  const replayRequestId = randomUUID();
  const replay = await post({ body: requestBody({ requestId: replayRequestId }) });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.body.result, "replay");
  assert.equal(replay.body.job.job_id, jobId);

  const duplicateRequestId = randomUUID();
  const duplicate = await post({
    idempotencyKey: DUPLICATE_KEY,
    body: requestBody({ requestId: duplicateRequestId }),
  });
  assert.equal(duplicate.response.status, 202);
  assert.equal(duplicate.body.result, "duplicate_work");
  assert.equal(duplicate.body.job.job_id, jobId);

  const conflictRequestId = randomUUID();
  const conflict = await post({
    body: requestBody({
      requestId: conflictRequestId,
      documentVersionId: VERSION_A7,
      artifactSha256: ARTIFACT_A7,
    }),
  });
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");
  assert.equal(conflict.text.includes(VERSION_A7), false);

  const limitedRequestId = randomUUID();
  const limited = await post({
    idempotencyKey: "rate-limit-denied-20260719",
    body: requestBody({ requestId: limitedRequestId }),
  });
  assert.equal(limited.response.status, 429);
  assert.equal(limited.body.error.code, "rate_limit_exceeded");
  assert.ok(Number(limited.response.headers.get("retry-after")) >= 1);
  assert.equal(limited.response.headers.get("connection"), "close");

  const ownStatus = await get({ token: TOKEN_A, jobId });
  assert.equal(ownStatus.response.status, 200);
  assert.equal(ownStatus.body.result, "status");
  assert.equal(ownStatus.body.job.job_id, jobId);
  assert.equal(ownStatus.text.includes(ARTIFACT_A6), false);
  assert.equal(/artifact_sha256|lease_token/i.test(ownStatus.text), false);

  const crossTenantStatus = await get({ token: TOKEN_B, jobId });
  const missingTenantBStatus = await get({ token: TOKEN_B, jobId: randomUUID() });
  for (const result of [crossTenantStatus, missingTenantBStatus]) {
    assert.equal(result.response.status, 404);
    assert.equal(result.body.error.code, "not_found");
    assert.equal(result.text.includes(jobId), false);
    assert.equal(result.text.includes(TENANT_A), false);
  }
  assert.equal(crossTenantStatus.body.error.message, missingTenantBStatus.body.error.message);

  const stored = await withTenantTransaction(inspectionPool, TENANT_A, async (client) => {
    const jobs = await client.query(
      `SELECT row_to_json(job)::text AS value
       FROM rag.ingestion_jobs AS job
       WHERE tenant_id = $1::uuid
         AND document_version_id IN ($2::uuid, $3::uuid)`,
      [TENANT_A, VERSION_A6, VERSION_A7]
    );
    const rates = await client.query(
      `SELECT row_to_json(rate_state)::text AS value,
              request_count,
              blocked_audit_id
       FROM integration.ingestion_api_rate_limits AS rate_state
       WHERE tenant_id = $1::uuid
         AND principal_id = '11111111-1111-4111-8111-111111111111'::uuid
         AND operation = 'ingestion_job_enqueue_v1'`,
      [TENANT_A]
    );
    return { jobs: jobs.rows, rates: rates.rows };
  });
  assert.equal(stored.jobs.length, 1);
  assert.equal(stored.rates.length, 1);
  assert.equal(Number(stored.rates[0].request_count), 6);
  assert.equal(stored.rates[0].blocked_audit_id, limited.body.audit_id);
  const serializedState = JSON.stringify(stored);
  for (const secret of [TOKEN_A, TOKEN_B, VIEWER_TOKEN, PRIMARY_KEY, DUPLICATE_KEY]) {
    assert.equal(serializedState.includes(secret), false);
  }

  await assert.rejects(
    () => inspectionPool.query("SELECT secret_sha256 FROM identity.api_credentials LIMIT 1"),
    (error) => error?.code === "42501"
  );
  await assert.rejects(
    () => inspectionPool.query("SELECT * FROM audit.ingestion_authentication_failures LIMIT 1"),
    (error) => error?.code === "42501"
  );

  process.stdout.write(`${JSON.stringify({
    result: "ingestion_api_postgres_http_smoke_passed",
    legacyProductionStatus: 404,
    statuses: [401, 403, 403, 202, 200, 202, 409, 429, 200, 404, 404],
    idempotentReplayJobStable: true,
    duplicateWorkJobStable: true,
    crossTenantStatusLeaked: false,
    rawCredentialOrIdempotencyPersisted: false,
    artifactDigestReturned: false,
    controlledArtifactsRead: 0,
  })}\n`);
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await inspectionPool.end();
  await closeDb();
}
