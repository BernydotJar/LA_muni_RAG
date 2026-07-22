import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const { Pool } = pg;
const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JURISDICTION = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";
const ORIGIN = "https://consulta.example";
const SECRET = "public-query-runtime-smoke-secret-at-least-thirty-two-bytes";
const QUERY = "solicitud documental de agua potable";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the public query smoke gate");
}
if (!process.env.ADMIN_DATABASE_URL) {
  throw new Error("ADMIN_DATABASE_URL is required for audit verification");
}

const startServer = async (overrides = {}) => {
  const server = createApiServer({
    legacyApiEnabled: false,
    requestTimeoutMs: 15_000,
    publicQueryV1: {
      enabled: true,
      tenantId: TENANT_A,
      jurisdiction: JURISDICTION,
      allowedOrigins: [ORIGIN],
      clientKeySecret: SECRET,
      rateLimit: 1,
      globalRateLimit: 100,
      rateWindowSeconds: 60,
      maxLimit: 5,
      ...overrides,
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
  if (!address || typeof address === "string") throw new Error("public query smoke server did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

const closeServer = async (server) => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
};

const call = async (baseUrl, options = {}) => {
  const method = options.method ?? "POST";
  const headers = new Headers();
  if (options.origin !== null) headers.set("origin", options.origin ?? ORIGIN);
  if (options.contentType !== null && method === "POST") {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  headers.set("x-request-id", options.requestId ?? randomUUID());
  headers.set("user-agent", options.userAgent ?? "public-query-smoke-client-a");
  if (options.authorization) headers.set("authorization", options.authorization);
  if (options.cookie) headers.set("cookie", options.cookie);
  const body = options.body ?? { message: QUERY, mode: "keyword", limit: 5 };
  const response = await fetch(`${baseUrl}/api/public/v1/query`, {
    method,
    headers,
    body: method === "POST" ? options.rawBody ?? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { response, text, body: text ? JSON.parse(text) : {} };
};

const adminPool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, max: 1 });
let disabled;
let tenantA;
let tenantB;
try {
  process.env.NODE_ENV = "production";

  disabled = await startServer({
    enabled: false,
    tenantId: null,
    jurisdiction: null,
    clientKeySecret: null,
    rateLimit: 20,
  });
  const unavailable = await call(disabled.baseUrl);
  assert.equal(unavailable.response.status, 503);
  assert.equal(unavailable.body.error.code, "service_unavailable");
  assert.equal(unavailable.response.headers.get("cache-control"), "no-store");
  await closeServer(disabled.server);
  disabled = null;

  tenantA = await startServer();

  const preflight = await call(tenantA.baseUrl, { method: "OPTIONS" });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(preflight.response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(preflight.response.headers.get("access-control-allow-headers"), "content-type, x-request-id");
  assert.equal(preflight.response.headers.get("access-control-expose-headers"), "x-request-id, retry-after");
  assert.equal(preflight.response.headers.get("access-control-allow-credentials"), null);

  const foreignOrigin = await call(tenantA.baseUrl, { origin: "https://evil.example" });
  assert.equal(foreignOrigin.response.status, 403);
  assert.equal(foreignOrigin.body.error.code, "forbidden");
  assert.equal(foreignOrigin.text.includes(ORIGIN), false);

  const missingOrigin = await call(tenantA.baseUrl, { origin: null });
  assert.equal(missingOrigin.response.status, 403);

  const authorization = await call(tenantA.baseUrl, {
    authorization: "Bearer browser-must-not-use-service-credentials",
    userAgent: "public-query-smoke-authorization",
  });
  assert.equal(authorization.response.status, 400);
  assert.equal(authorization.body.error.code, "invalid_request");

  const cookie = await call(tenantA.baseUrl, {
    cookie: "session=not-accepted",
    userAgent: "public-query-smoke-cookie",
  });
  assert.equal(cookie.response.status, 400);

  const tenantInjection = await call(tenantA.baseUrl, {
    userAgent: "public-query-smoke-invalid-body",
    body: { message: QUERY, mode: "keyword", limit: 5, tenant_id: TENANT_B },
  });
  assert.equal(tenantInjection.response.status, 400);
  assert.equal(tenantInjection.body.error.code, "invalid_request");

  const semantic = await call(tenantA.baseUrl, {
    userAgent: "public-query-smoke-semantic",
    body: { message: QUERY, mode: "semantic", limit: 5 },
  });
  assert.equal(semantic.response.status, 400);

  const success = await call(tenantA.baseUrl);
  assert.equal(success.response.status, 200);
  assert.equal(success.response.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(success.response.headers.get("cache-control"), "no-store");
  assert.equal(success.response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(success.body.schema_version, "v1");
  assert.equal(success.body.response_type, "public_query");
  assert.equal(success.body.role, "assistant");
  assert.equal(success.body.meta.responseLabel, "evidence_found");
  assert.equal(success.body.meta.requestedMode, "keyword");
  assert.deepEqual(success.body.meta.executedModes, ["keyword"]);
  assert.equal(success.body.meta.jurisdiction, JURISDICTION);
  assert.ok(success.body.citations.some((citation) => citation.evidenceStatus === "supported"));
  assert.ok(success.body.citations.some((citation) => citation.evidenceStatus === "comparative_reference"));
  assert.equal("tenant_id" in success.body, false);
  assert.equal("credential_id" in success.body, false);
  assert.equal("audit_id" in success.body, false);
  assert.equal(/object_key|object_namespace|scanner_engine|lease_token|pipeline_config/i.test(success.text), false);

  const blocked = await call(tenantA.baseUrl);
  assert.equal(blocked.response.status, 429);
  assert.equal(blocked.body.error.code, "rate_limit_exceeded");
  assert.ok(Number(blocked.response.headers.get("retry-after")) >= 1);

  await closeServer(tenantA.server);
  tenantA = null;

  tenantB = await startServer({ tenantId: TENANT_B, rateLimit: 20 });
  const isolated = await call(tenantB.baseUrl, { userAgent: "public-query-smoke-tenant-b" });
  assert.equal(isolated.response.status, 200);
  assert.equal(isolated.body.meta.responseLabel, "not_found");
  assert.equal(isolated.body.citations.length, 0);
  assert.equal(isolated.text.includes("Manual oficial de agua potable"), false);

  const auditResult = await adminPool.query(`
    SELECT event_type, outcome, details
    FROM audit.events
    WHERE actor_external_id = 'public_gateway'
      AND tenant_id = $1::uuid
    ORDER BY created_at, id
  `, [TENANT_A]);
  assert.ok(auditResult.rowCount >= 2);
  const auditJson = JSON.stringify(auditResult.rows);
  assert.equal(auditJson.includes(QUERY), false);
  assert.equal(auditJson.includes("public-query-smoke-client-a"), false);
  assert.equal(auditJson.includes("127.0.0.1"), false);
  assert.equal(auditJson.includes("sourceUrl"), false);
  assert.ok(auditResult.rows.some((row) => row.event_type === "public.query.succeeded"));
  assert.ok(auditResult.rows.some((row) => row.event_type === "public.query.blocked"));

  const rateResult = await adminPool.query(`
    SELECT operation, octet_length(client_key_sha256) AS digest_bytes
    FROM rag.public_query_rate_limits
    WHERE tenant_id = $1::uuid
    ORDER BY operation
  `, [TENANT_A]);
  assert.ok(rateResult.rowCount >= 2);
  assert.ok(rateResult.rows.every((row) => Number(row.digest_bytes) === 32));
  assert.ok(rateResult.rows.some((row) => row.operation === "public_query_client_v1"));
  assert.ok(rateResult.rows.some((row) => row.operation === "public_query_global_v1"));

  console.log(JSON.stringify({
    status: "public_query_gateway_postgres_smoke_passed",
    productionRoute: "/api/public/v1/query",
    browserCredentialAccepted: false,
    supportedEvidenceReturned: true,
    comparativeEvidencePromoted: false,
    tenantBLeak: false,
    rawNetworkIdentityPersisted: false,
    auditRows: auditResult.rowCount,
    rateRows: rateResult.rowCount,
  }));
} finally {
  if (disabled) await closeServer(disabled.server).catch(() => undefined);
  if (tenantA) await closeServer(tenantA.server).catch(() => undefined);
  if (tenantB) await closeServer(tenantB.server).catch(() => undefined);
  await adminPool.end();
  await closeDb();
}
