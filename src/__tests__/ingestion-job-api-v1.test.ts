import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request as httpRequest, type IncomingHttpHeaders, type Server } from "node:http";
import { describe, it } from "node:test";
import {
  InMemoryIngestionApiPersistence,
  INGESTION_PIPELINE_PROFILE,
  loadIngestionJobContractValidators,
  type IngestionJobRequestV1,
} from "../api/v1/ingestionIndex.js";
import { DEFAULT_VECTOR_DIMENSION } from "../embeddings/pgVectorRepository.js";
import {
  IngestionJobError,
  type DurableIngestionJob,
  type EnqueueIngestionJobInput,
  type EnqueueIngestionJobResult,
  type IngestionPipelineConfigV1,
} from "../ingestion/jobTypes.js";
import type {
  CredentialPrincipalRecord,
  IdentityRepository,
  SecurityRole,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../security/index.js";
import { createApiServer } from "../server.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL_A = "33333333-3333-4333-8333-333333333333";
const CREDENTIAL_A = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "aaaaaaaa-0000-4000-8000-000000000106";
const JOB_ID = "88888888-8888-4888-8888-888888888888";
const TOKEN = "tenant-a-document-manager-token-000000001";
const IDEMPOTENCY_KEY = "ingestion-job-request-000001";
const ARTIFACT_SHA256 = "a".repeat(64);
const FIXED_TIME = new Date("2026-07-19T21:00:00.000Z");
const validatorsPromise = loadIngestionJobContractValidators();

const pipelineConfig: IngestionPipelineConfigV1 = {
  contractVersion: "v1",
  extractor: { name: "bounded_document_registry", version: "1.0.0" },
  chunkPlanner: { name: "section_text_v1", maxChars: 1_800, overlapChars: 180 },
  embedding: {
    provider: "test-provider",
    model: "test-model-v1",
    dimension: DEFAULT_VECTOR_DIMENSION,
  },
};

const requestBody = (
  overrides: Partial<IngestionJobRequestV1> = {}
): IngestionJobRequestV1 => ({
  schema_version: "v1",
  request_id: REQUEST_ID,
  tenant_id: TENANT_A,
  pipeline_profile: INGESTION_PIPELINE_PROFILE,
  document_version_id: VERSION_ID,
  artifact_sha256: ARTIFACT_SHA256,
  ...overrides,
});

const durableJob = (
  overrides: Partial<DurableIngestionJob> = {}
): DurableIngestionJob => ({
  jobId: JOB_ID,
  tenantId: TENANT_A,
  principalId: PRINCIPAL_A,
  documentVersionId: VERSION_ID,
  artifactSha256: ARTIFACT_SHA256,
  status: "queued",
  attemptCount: 0,
  maxAttempts: 3,
  availableAt: FIXED_TIME.toISOString(),
  startedAt: null,
  finishedAt: null,
  leaseExpiresAt: null,
  heartbeatAt: null,
  lastErrorCode: null,
  lastErrorRetryable: null,
  pipelineConfig,
  createdAt: FIXED_TIME.toISOString(),
  updatedAt: FIXED_TIME.toISOString(),
  ...overrides,
});

class StubIdentityRepository implements IdentityRepository {
  readonly digests: string[] = [];

  constructor(
    private readonly record: CredentialPrincipalRecord | null,
    private readonly shouldThrow = false
  ) {}

  async authenticateByCredentialHash(digest: string): Promise<CredentialPrincipalRecord | null> {
    this.digests.push(digest);
    if (this.shouldThrow) throw new Error("sensitive database internals");
    return this.record;
  }
}

class StubTransactionPool implements TenantTransactionPool {
  readonly calls: Array<{ sql: string; values?: unknown[] }> = [];
  releases = 0;

  async connect(): Promise<TenantTransactionClient> {
    return {
      query: async (sql, values) => {
        this.calls.push({ sql, ...(values ? { values } : {}) });
        return { rows: [] };
      },
      release: () => {
        this.releases += 1;
      },
    };
  }
}

class StubJobService {
  readonly enqueueInputs: EnqueueIngestionJobInput[] = [];
  readonly getInputs: Array<{ tenantId: string; jobId: string }> = [];
  enqueueResult: EnqueueIngestionJobResult = { kind: "new", job: durableJob() };
  enqueueError: Error | null = null;
  getResult: DurableIngestionJob | null = durableJob();
  getError: Error | null = null;

  async enqueue(input: EnqueueIngestionJobInput): Promise<EnqueueIngestionJobResult> {
    this.enqueueInputs.push(structuredClone(input));
    if (this.enqueueError) throw this.enqueueError;
    return this.enqueueResult;
  }

  async get(tenantId: string, jobId: string): Promise<DurableIngestionJob | null> {
    this.getInputs.push({ tenantId, jobId });
    if (this.getError) throw this.getError;
    return this.getResult;
  }
}

const identityRecord = (
  roles: readonly SecurityRole[] = ["document_manager"],
  tenantId = TENANT_A
): CredentialPrincipalRecord => ({
  credentialId: CREDENTIAL_A,
  tenantId,
  principalId: PRINCIPAL_A,
  roles,
});

interface Harness {
  server: Server;
  baseUrl: string;
  persistence: InMemoryIngestionApiPersistence;
  identity: StubIdentityRepository;
  transactionPool: StubTransactionPool;
  jobService: StubJobService;
}

const startHarness = async (options: {
  roles?: readonly SecurityRole[];
  tenantId?: string;
  unauthenticated?: boolean;
  authenticationThrows?: boolean;
  enqueueRateLimit?: number;
  getRateLimit?: number;
  allowedOrigins?: readonly string[];
  jobService?: StubJobService;
  pipeline?: IngestionPipelineConfigV1 | null;
} = {}): Promise<Harness> => {
  const persistence = new InMemoryIngestionApiPersistence(() => FIXED_TIME);
  const identity = new StubIdentityRepository(
    options.unauthenticated
      ? null
      : identityRecord(options.roles, options.tenantId),
    options.authenticationThrows
  );
  const transactionPool = new StubTransactionPool();
  const jobService = options.jobService ?? new StubJobService();
  const server = createApiServer({
    evidenceDependencies: {
      keywordSearch: async () => [],
      phraseSearch: async () => [],
    },
    ingestionJobV1: {
      identityRepository: identity,
      transactionPool,
      persistence,
      authenticationFailureRecorder: persistence,
      jobService,
      validators: validatorsPromise,
      pipelineConfig: options.pipeline === undefined ? pipelineConfig : options.pipeline,
      maxAttempts: 3,
      enqueueRateLimit: options.enqueueRateLimit ?? 20,
      getRateLimit: options.getRateLimit ?? 120,
      rateWindowSeconds: 60,
      now: () => FIXED_TIME,
      createUuid: randomUUID,
    },
    v1CorsAllowedOrigins: options.allowedOrigins ?? ["https://admin.example"],
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    persistence,
    identity,
    transactionPool,
    jobService,
  };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

const post = async (
  harness: Harness,
  body: unknown,
  options: {
    authorization?: string | null;
    idempotencyKey?: string | null;
    requestId?: string | null;
    contentType?: string | null;
    origin?: string;
    raw?: boolean;
  } = {}
) => {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": IDEMPOTENCY_KEY,
    "x-request-id": REQUEST_ID,
  });
  for (const [name, value] of [
    ["authorization", options.authorization],
    ["content-type", options.contentType],
    ["idempotency-key", options.idempotencyKey],
    ["x-request-id", options.requestId],
  ] as const) {
    if (value === null) headers.delete(name);
    else if (value !== undefined) headers.set(name, value);
  }
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${harness.baseUrl}/api/v1/ingestion-jobs`, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
};

const get = async (
  harness: Harness,
  jobId = JOB_ID,
  options: { authorization?: string | null; requestId?: string | null; origin?: string } = {}
) => {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN}`,
    "x-request-id": REQUEST_ID,
  });
  if (options.authorization === null) headers.delete("authorization");
  else if (options.authorization) headers.set("authorization", options.authorization);
  if (options.requestId === null) headers.delete("x-request-id");
  else if (options.requestId) headers.set("x-request-id", options.requestId);
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${harness.baseUrl}/api/v1/ingestion-jobs/${jobId}`, {
    headers,
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
};

const getWithBody = async (
  harness: Harness
): Promise<{
  statusCode: number;
  headers: IncomingHttpHeaders;
  text: string;
  json: Record<string, unknown>;
}> => new Promise((resolve, reject) => {
  const request = httpRequest(
    `${harness.baseUrl}/api/v1/ingestion-jobs/${JOB_ID}`,
    {
      method: "GET",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-length": "1",
        "x-request-id": REQUEST_ID,
      },
    },
    (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          text,
          json: JSON.parse(text) as Record<string, unknown>,
        });
      });
    }
  );
  request.on("error", reject);
  request.end("x");
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
  assert.equal(result.response.headers.get("x-request-id"), result.json.request_id);
};

describe("ingestion job API v1", () => {
  it("authenticates before parsing and aggregates a uniform tenantless 401", async () => {
    const harness = await startHarness({ unauthenticated: true });
    try {
      const result = await post(harness, "{bad json", { raw: true, authorization: null });
      await assertApiError(result, 401, "unauthorized");
      assert.equal(result.response.headers.get("www-authenticate"), 'Bearer realm="la-muni-rag"');
      assert.equal(result.response.headers.get("connection"), "close");
      assert.equal(result.json.tenant_id, null);
      assert.equal(harness.jobService.enqueueInputs.length, 0);
      const repeated = await post(harness, requestBody(), { authorization: null });
      await assertApiError(repeated, 401, "unauthorized");
      assert.equal(repeated.json.audit_id, result.json.audit_id);
      assert.equal(harness.persistence.authenticationFailures[0]?.failureCount, 2);
    } finally {
      await stopHarness(harness);
    }
  });

  it("sanitizes authentication dependency failures", async () => {
    const harness = await startHarness({ authenticationThrows: true });
    try {
      const result = await post(harness, requestBody());
      await assertApiError(result, 401, "unauthorized");
      assert.doesNotMatch(result.text, /sensitive database internals/i);
      assert.equal(
        harness.persistence.authenticationFailures[0]?.reasonCode,
        "authentication_dependency_failure"
      );
    } finally {
      await stopHarness(harness);
    }
  });

  it("uses the same non-leaking 403 for permission and tenant denial", async () => {
    const roleHarness = await startHarness({ roles: ["viewer"] });
    const tenantHarness = await startHarness();
    try {
      const role = await post(roleHarness, "{bad json", { raw: true });
      const tenant = await post(tenantHarness, requestBody({ tenant_id: TENANT_B }));
      await assertApiError(role, 403, "forbidden");
      await assertApiError(tenant, 403, "forbidden");
      assert.deepEqual(role.json.error, tenant.json.error);
      assert.equal(roleHarness.jobService.enqueueInputs.length, 0);
      assert.equal(role.response.headers.get("connection"), "close");
      assert.equal(tenantHarness.jobService.enqueueInputs.length, 0);
      assert.equal(
        roleHarness.persistence.audits.at(-1)?.eventType,
        "integration.ingestion_job.authorization_denied"
      );
      assert.equal(
        tenantHarness.persistence.audits.at(-1)?.eventType,
        "integration.ingestion_job.tenant_access_denied"
      );
    } finally {
      await stopHarness(roleHarness);
      await stopHarness(tenantHarness);
    }
  });

  it("rejects malformed headers, request-id mismatch, and schema extensions before enqueue", async () => {
    const harness = await startHarness();
    try {
      const invalidKey = await post(harness, requestBody(), { idempotencyKey: "short" });
      await assertApiError(
        invalidKey,
        400,
        "invalid_idempotency_key"
      );
      assert.equal(invalidKey.response.headers.get("connection"), "close");
      const invalidContentType = await post(harness, requestBody(), { contentType: "text/plain" });
      await assertApiError(
        invalidContentType,
        400,
        "unsupported_content_type"
      );
      assert.equal(invalidContentType.response.headers.get("connection"), "close");
      await assertApiError(
        await post(harness, requestBody(), { requestId: OTHER_REQUEST_ID }),
        400,
        "request_id_mismatch"
      );
      await assertApiError(
        await post(harness, { ...requestBody(), embedding_provider: "untrusted" }),
        400,
        "invalid_request"
      );
      assert.equal(harness.jobService.enqueueInputs.length, 0);
    } finally {
      await stopHarness(harness);
    }
  });

  it("enqueues with server-owned pipeline policy and returns contract-valid replay-safe responses", async () => {
    const jobService = new StubJobService();
    const harness = await startHarness({ jobService });
    try {
      const created = await post(harness, requestBody());
      assert.equal(created.response.status, 202);
      const validators = await validatorsPromise;
      assert.equal(validators.response(created.json), true, JSON.stringify(validators.response.errors));
      assert.equal(created.json.result, "new");
      assert.notEqual(created.response.headers.get("connection"), "close");
      assert.equal(jobService.enqueueInputs[0]?.principalId, PRINCIPAL_A);
      assert.deepEqual(jobService.enqueueInputs[0]?.pipelineConfig, pipelineConfig);
      assert.equal(jobService.enqueueInputs[0]?.idempotencyKey, IDEMPOTENCY_KEY);
      assert.doesNotMatch(created.text, /artifact_sha256|lease_token|tenant-a-document-manager-token/i);
      assert.equal(JSON.stringify(harness.persistence.audits).includes(IDEMPOTENCY_KEY), false);

      jobService.enqueueResult = { kind: "replay", job: durableJob() };
      const replay = await post(harness, requestBody());
      assert.equal(replay.response.status, 200);
      assert.equal(replay.json.result, "replay");

      jobService.enqueueResult = { kind: "duplicate_work", job: durableJob() };
      const duplicate = await post(harness, requestBody(), {
        idempotencyKey: "ingestion-job-request-000002",
      });
      assert.equal(duplicate.response.status, 202);
      assert.equal(duplicate.json.result, "duplicate_work");
    } finally {
      await stopHarness(harness);
    }
  });

  it("maps idempotency and document identity conflicts without leaking database details", async () => {
    const conflictService = new StubJobService();
    conflictService.enqueueResult = { kind: "conflict" };
    const identityService = new StubJobService();
    identityService.enqueueError = new IngestionJobError(
      "ingestion_artifact_identity_mismatch",
      "tenant B secret document exists"
    );
    const corruptPersistenceService = new StubJobService();
    corruptPersistenceService.enqueueError = new IngestionJobError(
      "ingestion_persistence_invalid",
      "database row contains a secret malformed value"
    );
    const conflictHarness = await startHarness({ jobService: conflictService });
    const identityHarness = await startHarness({ jobService: identityService });
    const corruptPersistenceHarness = await startHarness({ jobService: corruptPersistenceService });
    try {
      const conflict = await post(conflictHarness, requestBody());
      const identity = await post(identityHarness, requestBody());
      const corruptPersistence = await post(corruptPersistenceHarness, requestBody());
      await assertApiError(conflict, 409, "idempotency_conflict");
      await assertApiError(identity, 409, "document_version_conflict");
      await assertApiError(corruptPersistence, 500, "internal_error");
      assert.doesNotMatch(identity.text, /tenant B secret|database/i);
      assert.doesNotMatch(corruptPersistence.text, /database row|secret malformed/i);
    } finally {
      await stopHarness(conflictHarness);
      await stopHarness(identityHarness);
      await stopHarness(corruptPersistenceHarness);
    }
  });

  it("returns scoped status and the same 404 for missing or cross-tenant identifiers", async () => {
    const statusHarness = await startHarness();
    const missingService = new StubJobService();
    missingService.getResult = null;
    const missingHarness = await startHarness({ jobService: missingService });
    const crossTenantHarness = await startHarness({
      tenantId: TENANT_B,
      jobService: missingService,
    });
    try {
      const status = await get(statusHarness);
      assert.equal(status.response.status, 200);
      assert.equal(status.json.result, "status");
      assert.equal((status.json.job as { job_id: string }).job_id, JOB_ID);
      const missing = await get(missingHarness);
      const crossTenant = await get(crossTenantHarness);
      await assertApiError(missing, 404, "not_found");
      await assertApiError(crossTenant, 404, "not_found");
      assert.deepEqual(missing.json.error, crossTenant.json.error);
      assert.doesNotMatch(crossTenant.text, new RegExp(JOB_ID, "i"));
      assert.equal(missingService.getInputs.at(-1)?.tenantId, TENANT_B);
    } finally {
      await stopHarness(statusHarness);
      await stopHarness(missingHarness);
      await stopHarness(crossTenantHarness);
    }
  });

  it("rejects a framed GET body and closes the connection without reading job state", async () => {
    const harness = await startHarness();
    try {
      const result = await getWithBody(harness);
      assert.equal(result.statusCode, 400);
      assert.equal(result.headers.connection, "close");
      assert.equal((result.json.error as { code: string }).code, "request_body_not_allowed");
      const validators = await validatorsPromise;
      assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
      assert.equal(harness.jobService.getInputs.length, 0);
    } finally {
      await stopHarness(harness);
    }
  });

  it("rate-limits per operation and emits one bounded denial audit", async () => {
    const harness = await startHarness({ enqueueRateLimit: 1 });
    try {
      assert.equal((await post(harness, requestBody())).response.status, 202);
      const blocked = await post(harness, requestBody());
      await assertApiError(blocked, 429, "rate_limit_exceeded");
      assert.equal(blocked.response.headers.get("retry-after"), "60");
      assert.equal(blocked.response.headers.get("connection"), "close");
      const repeated = await post(harness, requestBody());
      await assertApiError(repeated, 429, "rate_limit_exceeded");
      assert.equal(
        harness.persistence.audits.filter(
          (audit) => audit.eventType === "integration.ingestion_job.rate_limited"
        ).length,
        1
      );
      assert.equal(harness.jobService.enqueueInputs.length, 1);
    } finally {
      await stopHarness(harness);
    }
  });

  it("uses exact-origin CORS with the route's GET/POST surface", async () => {
    const harness = await startHarness({ allowedOrigins: ["https://admin.example"] });
    try {
      const allowed = await fetch(`${harness.baseUrl}/api/v1/ingestion-jobs`, {
        method: "OPTIONS",
        headers: {
          origin: "https://admin.example",
          "access-control-request-method": "POST",
        },
      });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get("access-control-allow-origin"), "https://admin.example");
      assert.equal(allowed.headers.get("access-control-allow-methods"), "GET, POST, OPTIONS");

      const denied = await fetch(`${harness.baseUrl}/api/v1/ingestion-jobs`, {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      });
      assert.equal(denied.status, 204);
      assert.equal(denied.headers.get("access-control-allow-origin"), null);
    } finally {
      await stopHarness(harness);
    }
  });
});
