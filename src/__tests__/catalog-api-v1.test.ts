import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { request as httpRequest, type Server } from "node:http";
import { describe, it } from "node:test";
import {
  hashBearerCredential,
  type CredentialPrincipalRecord,
  type IdentityRepository,
  type SecurityRole,
  type TenantTransactionClient,
  type TenantTransactionPool,
} from "../security/index.js";
import { createApiServer } from "../server.js";
import {
  InMemoryCatalogRepository,
  loadCatalogValidators,
  type DocumentCreateRequestV1,
  type DocumentResponseV1,
  type SourceCreateRequestV1,
  type SourceResponseV1,
} from "../api/v1/catalogIndex.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const MANAGER_ID = "33333333-3333-4333-8333-333333333333";
const VIEWER_ID = "44444444-4444-4444-8444-444444444444";
const TENANT_B_MANAGER_ID = "55555555-5555-4555-8555-555555555555";
const MANAGER_CREDENTIAL = "66666666-6666-4666-8666-666666666666";
const VIEWER_CREDENTIAL = "77777777-7777-4777-8777-777777777777";
const TENANT_B_CREDENTIAL = "88888888-8888-4888-8888-888888888888";
const REQUEST_ID = "99999999-9999-4999-8999-999999999999";
const SECOND_REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MANAGER_TOKEN = "catalog-manager-token-00000000000000000000000001";
const VIEWER_TOKEN = "catalog-viewer-token-000000000000000000000000001";
const TENANT_B_TOKEN = "catalog-tenant-b-token-0000000000000000000000001";
const IDEMPOTENCY_KEY = "catalog-source-request-00000001";
const FIXED_TIME = new Date("2026-07-21T23:00:00.000Z");
const validatorsPromise = loadCatalogValidators();

const identityRecord = (
  credentialId: string,
  tenantId: string,
  principalId: string,
  roles: readonly SecurityRole[]
): CredentialPrincipalRecord => ({ credentialId, tenantId, principalId, roles });

class MapIdentityRepository implements IdentityRepository {
  readonly records = new Map<string, CredentialPrincipalRecord>();
  constructor() {
    this.records.set(hashBearerCredential(MANAGER_TOKEN), identityRecord(
      MANAGER_CREDENTIAL, TENANT_A, MANAGER_ID, ["document_manager"]
    ));
    this.records.set(hashBearerCredential(VIEWER_TOKEN), identityRecord(
      VIEWER_CREDENTIAL, TENANT_A, VIEWER_ID, ["viewer"]
    ));
    this.records.set(hashBearerCredential(TENANT_B_TOKEN), identityRecord(
      TENANT_B_CREDENTIAL, TENANT_B, TENANT_B_MANAGER_ID, ["document_manager"]
    ));
  }
  async authenticateByCredentialHash(digest: string): Promise<CredentialPrincipalRecord | null> {
    return this.records.get(digest) ?? null;
  }
}

class StubTransactionPool implements TenantTransactionPool {
  readonly calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  async connect(): Promise<TenantTransactionClient> {
    return {
      query: async (sql, values) => {
        this.calls.push({ sql, ...(values ? { values } : {}) });
        return { rows: [] };
      },
      release: () => undefined,
    };
  }
}

interface Harness {
  server: Server;
  baseUrl: string;
  repository: InMemoryCatalogRepository;
}

const startHarness = async (rateLimit = 100): Promise<Harness> => {
  const repository = new InMemoryCatalogRepository(() => FIXED_TIME);
  repository.seedIngestionJob({
    tenantId: TENANT_A,
    jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    documentVersionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    status: "queued",
    attemptCount: 1,
    maxAttempts: 3,
    availableAt: "2026-07-21T23:05:00.000Z",
    lastErrorCode: "embedding_provider_timeout",
    lastErrorRetryable: true,
    createdAt: "2026-07-21T22:50:00.000Z",
    updatedAt: "2026-07-21T22:55:00.000Z",
    internal: {
      leaseTokenSha256: "never-return-this-lease",
      pipelineConfig: { api_key: "never-return-this-secret" },
      rawError: "stack and object://private-coordinate",
    },
  });
  repository.seedIngestionJob({
    tenantId: TENANT_B,
    jobId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    documentVersionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    status: "failed",
    attemptCount: 3,
    maxAttempts: 3,
    availableAt: "2026-07-21T22:00:00.000Z",
    lastErrorCode: "parser_failed",
    lastErrorRetryable: false,
    createdAt: "2026-07-21T21:00:00.000Z",
    updatedAt: "2026-07-21T22:00:00.000Z",
  });
  repository.seedProcedure({
    tenantId: TENANT_A,
    procedureId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    procedureKey: "water.community",
    title: "Agua potable comunitaria",
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
    latestVersionNumber: 3,
    latestLifecycleStatus: "approved",
    approvedWorkflowVersionId: "12121212-1212-4121-8121-121212121212",
    approvedVersionNumber: 3,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-21T10:00:00.000Z",
    internalWorkflowDefinition: { private_note: "must-not-leak" },
  });
  repository.seedProcedure({
    tenantId: TENANT_B,
    procedureId: "23232323-2323-4232-8232-232323232323",
    procedureKey: "other.tenant",
    title: "Otro tenant",
    jurisdiction: "Other",
    latestVersionNumber: 1,
    latestLifecycleStatus: "draft",
    approvedWorkflowVersionId: null,
    approvedVersionNumber: null,
    createdAt: "2026-07-20T10:00:00.000Z",
    updatedAt: "2026-07-21T10:00:00.000Z",
  });
  const server = createApiServer({
    evidenceDependencies: { keywordSearch: async () => [], phraseSearch: async () => [] },
    catalogV1: {
      identityRepository: new MapIdentityRepository(),
      transactionPool: new StubTransactionPool(),
      repository,
      validators: validatorsPromise,
      now: () => FIXED_TIME,
      createUuid: randomUUID,
      rateLimit,
      rateWindowSeconds: 60,
      idempotencyTtlSeconds: 86_400,
    },
    v1CorsAllowedOrigins: ["https://admin.example"],
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return { server, baseUrl: `http://127.0.0.1:${address.port}`, repository };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => error ? reject(error) : resolve())
  );
};

interface CallOptions {
  method?: "GET" | "POST" | "OPTIONS";
  token?: string | null;
  requestId?: string;
  idempotencyKey?: string | null;
  body?: unknown;
  rawBody?: string;
  contentType?: string | null;
  origin?: string;
  headers?: Record<string, string>;
}

const call = async (
  harness: Harness,
  path: string,
  options: CallOptions = {}
): Promise<{ response: Response; text: string; json: Record<string, unknown> }> => {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  const token = options.token === undefined ? MANAGER_TOKEN : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? REQUEST_ID);
  if (method === "POST") {
    if (options.idempotencyKey !== null) {
      headers.set("idempotency-key", options.idempotencyKey ?? IDEMPOTENCY_KEY);
    }
    if (options.contentType !== null) headers.set("content-type", options.contentType ?? "application/json");
  }
  if (options.origin) headers.set("origin", options.origin);
  const body = method === "POST" ? options.rawBody ?? JSON.stringify(options.body ?? {}) : undefined;
  const response = await fetch(`${harness.baseUrl}${path}`, { method, headers, body });
  const text = await response.text();
  return { response, text, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
};

const callFramedGet = async (
  harness: Harness,
  path: string
): Promise<{ response: { status: number; headers: Record<string, string | string[] | undefined> }; text: string; json: Record<string, unknown> }> =>
  new Promise((resolve, reject) => {
    const target = new URL(path, harness.baseUrl);
    const req = httpRequest(target, {
      method: "GET",
      headers: {
        authorization: `Bearer ${MANAGER_TOKEN}`,
        "x-request-id": REQUEST_ID,
        "content-length": "1",
        "content-type": "application/json",
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          response: { status: res.statusCode ?? 0, headers: res.headers },
          text,
          json: text ? JSON.parse(text) as Record<string, unknown> : {},
        });
      });
    });
    req.on("error", reject);
    req.write("x");
    req.end();
  });

const assertApiError = async (
  result: { response: Response; json: Record<string, unknown> },
  status: number,
  code: string
): Promise<void> => {
  assert.equal(result.response.status, status);
  const validators = await validatorsPromise;
  assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
  assert.equal((result.json.error as { code: string }).code, code);
};

const sourceRequest = (
  requestId = REQUEST_ID,
  tenantId = TENANT_A,
  credentialId = MANAGER_CREDENTIAL
): SourceCreateRequestV1 => ({
  schema_version: "v1",
  operation: "source_create",
  request_id: requestId,
  tenant_id: tenantId,
  source_key: "mixco-procedure-manual-discovery",
  title: "Manual de procedimientos de referencia",
  category: "procedure_manual",
  target_jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
  source_jurisdiction: "Municipio de Mixco, Guatemala",
  source_relation: "comparative",
  discovery_status: "identified",
  discovery_url: "https://www2.munimixco.gob.gt/documentos/manual.pdf",
  artifact_url: null,
  observed_version: "discovery-2026-07",
  publication_date: null,
  effective_date: null,
  limitations: ["Vigencia y aplicabilidad pendientes de revision."],
  provenance: { credential_id: credentialId },
});

const documentRequest = (
  sourceId: string,
  requestId = SECOND_REQUEST_ID,
  tenantId = TENANT_A,
  credentialId = MANAGER_CREDENTIAL
): DocumentCreateRequestV1 => ({
  schema_version: "v1",
  operation: "document_create",
  request_id: requestId,
  tenant_id: tenantId,
  source_id: sourceId,
  title: "Manual declarado para revisión",
  document_type: "manual",
  document_scope: "municipal",
  issuing_authority: "Municipalidad de Mixco",
  confidentiality: "public",
  version: {
    version_label: "discovery-2026-07",
    source_url: "https://www2.munimixco.gob.gt/documentos/manual.pdf",
    original_filename: "manual.pdf",
    mime_type: "application/pdf",
    content_sha256: "a".repeat(64),
    page_count: null,
  },
  provenance: { credential_id: credentialId },
});

describe("catalog API v1", () => {
  it("advertises only the implemented collection methods", async () => {
    const harness = await startHarness();
    try {
      for (const [path, methods] of [
        ["/api/v1/sources", "GET, POST, OPTIONS"],
        ["/api/v1/documents", "GET, POST, OPTIONS"],
        ["/api/v1/ingestion-jobs", "GET, POST, OPTIONS"],
        ["/api/v1/procedures", "GET, OPTIONS"],
      ]) {
        const result = await call(harness, path, { method: "OPTIONS", origin: "https://admin.example" });
        assert.equal(result.response.status, 204);
        assert.equal(result.response.headers.get("access-control-allow-methods"), methods);
      }
    } finally { await stopHarness(harness); }
  });

  it("authenticates and authorizes before parsing catalog writes", async () => {
    const harness = await startHarness();
    try {
      const unauthenticated = await call(harness, "/api/v1/sources", {
        method: "POST", token: null, rawBody: "{malformed",
      });
      await assertApiError(unauthenticated, 401, "unauthorized");
      assert.equal(harness.repository.authenticationFailures.length, 1);
      const forbidden = await call(harness, "/api/v1/sources", {
        method: "POST", token: VIEWER_TOKEN, rawBody: "{malformed",
      });
      await assertApiError(forbidden, 403, "forbidden");
      assert.equal(harness.repository.sources.size, 0);
    } finally { await stopHarness(harness); }
  });

  it("registers an unreviewed source with exact replay and no authority promotion", async () => {
    const harness = await startHarness();
    try {
      const request = sourceRequest();
      const created = await call(harness, "/api/v1/sources", { method: "POST", body: request });
      assert.equal(created.response.status, 201);
      const validators = await validatorsPromise;
      assert.equal(validators.sourceResponse(created.json), true, JSON.stringify(validators.sourceResponse.errors));
      const body = created.json as unknown as SourceResponseV1;
      assert.equal(body.source.validation_state, "unreviewed");
      assert.equal(body.source.official_source, false);
      assert.equal(body.source.official_for_target_jurisdiction, false);
      assert.equal(body.source.acquisition_state, "not_acquired");
      assert.equal(body.source.ingestion_state, "not_ingested");
      assert.equal(body.source.retrieval_state, "not_indexed");
      assert.match(body.source.limitations.join(" "), /Referencia comparativa de otra municipalidad/i);
      const replay = await call(harness, "/api/v1/sources", { method: "POST", body: request });
      assert.equal(replay.text, created.text);
      const changed = sourceRequest();
      changed.title = "Changed";
      const conflict = await call(harness, "/api/v1/sources", { method: "POST", body: changed });
      await assertApiError(conflict, 409, "idempotency_conflict");
      const promoted = { ...sourceRequest(SECOND_REQUEST_ID), official_source: true };
      const rejected = await call(harness, "/api/v1/sources", {
        method: "POST", requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-source-promotion-000001", body: promoted,
      });
      await assertApiError(rejected, 400, "invalid_request");
    } finally { await stopHarness(harness); }
  });

  it("registers a declared document version without inventing artifact acceptance", async () => {
    const harness = await startHarness();
    try {
      const source = await call(harness, "/api/v1/sources", { method: "POST", body: sourceRequest() });
      const sourceBody = source.json as unknown as SourceResponseV1;
      const request = documentRequest(sourceBody.source.source_id);
      const created = await call(harness, "/api/v1/documents", {
        method: "POST", requestId: request.request_id,
        idempotencyKey: "catalog-document-request-00001", body: request,
      });
      assert.equal(created.response.status, 201);
      const validators = await validatorsPromise;
      assert.equal(validators.documentResponse(created.json), true, JSON.stringify(validators.documentResponse.errors));
      const body = created.json as unknown as DocumentResponseV1;
      assert.equal(body.document.document_status, "draft");
      assert.equal(body.document.version.extraction_state, "queued");
      assert.equal(body.document.artifact_acceptance.state, "not_accepted");
      assert.equal(body.document.ingestion_state, "not_started");
      assert.equal(body.document.retrieval_state, "not_indexed");
      assert.doesNotMatch(created.text, /object_key|object_namespace|signed_url|scanner_engine|lease_token|fencing_token/i);
      const crossTenant = documentRequest(sourceBody.source.source_id, SECOND_REQUEST_ID, TENANT_B, TENANT_B_CREDENTIAL);
      const denied = await call(harness, "/api/v1/documents", {
        method: "POST", token: TENANT_B_TOKEN, requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-cross-tenant-document-01", body: crossTenant,
      });
      await assertApiError(denied, 404, "not_found");
    } finally { await stopHarness(harness); }
  });

  it("lists bounded tenant pages and rejects framed GET bodies before repository reads", async () => {
    const harness = await startHarness();
    try {
      const first = await call(harness, "/api/v1/sources", { method: "POST", body: sourceRequest() });
      const firstBody = first.json as unknown as SourceResponseV1;
      const secondRequest = sourceRequest(SECOND_REQUEST_ID);
      secondRequest.source_key = "antigua-missing-water-form";
      secondRequest.title = "Formulario de agua pendiente";
      secondRequest.source_jurisdiction = "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala";
      secondRequest.source_relation = "target";
      secondRequest.discovery_status = "missing_source";
      secondRequest.discovery_url = null;
      const second = await call(harness, "/api/v1/sources", {
        method: "POST", requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-source-request-00000002", body: secondRequest,
      });
      assert.equal(second.response.status, 201);
      await call(harness, "/api/v1/documents", {
        method: "POST", requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-document-request-00002",
        body: documentRequest(firstBody.source.source_id),
      });
      const sourcePage = await call(harness, `/api/v1/sources?tenant_id=${TENANT_A}&limit=1`);
      assert.equal(sourcePage.response.status, 200);
      assert.equal((sourcePage.json.items as unknown[]).length, 1);
      assert.equal(typeof sourcePage.json.next_cursor, "string");
      const next = await call(harness, `/api/v1/sources?tenant_id=${TENANT_A}&limit=1&cursor=${encodeURIComponent(String(sourcePage.json.next_cursor))}`);
      assert.equal((next.json.items as unknown[]).length, 1);
      const docs = await call(harness, `/api/v1/documents?tenant_id=${TENANT_A}`);
      assert.equal((docs.json.items as unknown[]).length, 1);
      const jobs = await call(harness, `/api/v1/ingestion-jobs?tenant_id=${TENANT_A}`);
      assert.equal((jobs.json.items as Array<{ status: string }>)[0]?.status, "retry_wait");
      assert.doesNotMatch(jobs.text, /never-return|pipeline_config|raw_error|object:\/\//i);
      const procedures = await call(harness, `/api/v1/procedures?tenant_id=${TENANT_A}`);
      assert.equal((procedures.json.items as unknown[]).length, 1);
      assert.doesNotMatch(procedures.text, /private_note|workflow_definition|review_notes|approval_notes/i);
      const crossTenant = await call(harness, `/api/v1/sources?tenant_id=${TENANT_B}`);
      await assertApiError(crossTenant, 403, "forbidden");
      const before = harness.repository.listCalls;
      const framed = await callFramedGet(harness, `/api/v1/sources?tenant_id=${TENANT_A}`);
      assert.equal(framed.response.status, 400);
      assert.equal((framed.json.error as { code: string }).code, "invalid_request");
      assert.equal(harness.repository.listCalls, before);
    } finally { await stopHarness(harness); }
  });


  it("rejects embedded credentials and temporary signatures in persisted public URLs", async () => {
    const harness = await startHarness();
    try {
      const signedSource = sourceRequest(SECOND_REQUEST_ID);
      signedSource.discovery_url = "https://example.test/manual.pdf?sig=temporary-secret";
      const sourceRejected = await call(harness, "/api/v1/sources", {
        method: "POST",
        requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-signed-source-000001",
        body: signedSource,
      });
      await assertApiError(sourceRejected, 400, "invalid_request");
      assert.equal(harness.repository.sources.size, 0);

      const source = await call(harness, "/api/v1/sources", { method: "POST", body: sourceRequest() });
      const sourceBody = source.json as unknown as SourceResponseV1;
      const signedDocument = documentRequest(sourceBody.source.source_id, SECOND_REQUEST_ID);
      signedDocument.version.source_url = "https://user:password@example.test/manual.pdf";
      const documentRejected = await call(harness, "/api/v1/documents", {
        method: "POST",
        requestId: SECOND_REQUEST_ID,
        idempotencyKey: "catalog-signed-document-0001",
        body: signedDocument,
      });
      await assertApiError(documentRejected, 400, "invalid_request");
      assert.equal(harness.repository.documents.size, 0);
    } finally { await stopHarness(harness); }
  });

  it("commits cleanup before rejecting schema-valid semantic replay corruption", async () => {
    const harness = await startHarness();
    try {
      const request = sourceRequest();
      const created = await call(harness, "/api/v1/sources", { method: "POST", body: request });
      assert.equal(created.response.status, 201);
      const entry = [...harness.repository.idempotency.values()].find((candidate) =>
        candidate.operation === "source_create_v1" && candidate.state === "completed"
      ) as unknown as { responseBody: string; responseSha256: string } | undefined;
      assert.ok(entry);
      const corrupted = JSON.parse(entry.responseBody) as SourceResponseV1;
      corrupted.source.official_source = true;
      corrupted.source.official_for_target_jurisdiction = true;
      entry.responseBody = JSON.stringify(corrupted);
      entry.responseSha256 = createHash("sha256").update(entry.responseBody).digest("hex");

      const rejected = await call(harness, "/api/v1/sources", { method: "POST", body: request });
      await assertApiError(rejected, 500, "replay_invalid");
      assert.equal(rejected.text.includes("official_source"), false);
      assert.equal(
        [...harness.repository.idempotency.values()].some((candidate) => candidate.operation === "source_create_v1"),
        false
      );
    } finally { await stopHarness(harness); }
  });

  it("rejects document replay that fabricates accepted artifact evidence", async () => {
    const harness = await startHarness();
    try {
      const source = await call(harness, "/api/v1/sources", { method: "POST", body: sourceRequest() });
      const sourceBody = source.json as unknown as SourceResponseV1;
      const request = documentRequest(sourceBody.source.source_id, SECOND_REQUEST_ID);
      const key = "catalog-document-corrupt-0001";
      const created = await call(harness, "/api/v1/documents", {
        method: "POST", requestId: SECOND_REQUEST_ID, idempotencyKey: key, body: request,
      });
      assert.equal(created.response.status, 201);
      const entry = [...harness.repository.idempotency.values()].find((candidate) =>
        candidate.operation === "document_create_v1" && candidate.state === "completed"
      ) as unknown as { responseBody: string; responseSha256: string } | undefined;
      assert.ok(entry);
      const corrupted = JSON.parse(entry.responseBody) as DocumentResponseV1;
      corrupted.document.artifact_acceptance = {
        state: "accepted",
        artifact_object_id: "abababab-abab-4bab-8bab-abababababab",
        artifact_scan_id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
        accepted_until: "2026-07-22T23:00:00.000Z",
      };
      corrupted.document.ingestion_state = "processed";
      corrupted.document.retrieval_state = "indexed";
      entry.responseBody = JSON.stringify(corrupted);
      entry.responseSha256 = createHash("sha256").update(entry.responseBody).digest("hex");

      const rejected = await call(harness, "/api/v1/documents", {
        method: "POST", requestId: SECOND_REQUEST_ID, idempotencyKey: key, body: request,
      });
      await assertApiError(rejected, 500, "replay_invalid");
      assert.equal(rejected.text.includes("artifact_object_id"), false);
      assert.equal(
        [...harness.repository.idempotency.values()].some((candidate) => candidate.operation === "document_create_v1"),
        false
      );
    } finally { await stopHarness(harness); }
  });

  it("applies a bounded authenticated rate gate to reads and writes", async () => {
    const harness = await startHarness(1);
    try {
      const first = await call(harness, `/api/v1/sources?tenant_id=${TENANT_A}`);
      assert.equal(first.response.status, 200);
      const limited = await call(harness, `/api/v1/sources?tenant_id=${TENANT_A}`);
      await assertApiError(limited, 429, "rate_limit_exceeded");
      assert.equal(limited.response.headers.get("retry-after"), "60");
      const repeated = await call(harness, `/api/v1/sources?tenant_id=${TENANT_A}`);
      await assertApiError(repeated, 429, "rate_limit_exceeded");
      assert.equal(repeated.response.headers.get("retry-after"), "60");
      assert.equal(
        harness.repository.audits.filter((audit) => audit.reasonCode === "rate_limit_exceeded").length,
        1
      );
    } finally { await stopHarness(harness); }
  });
});
