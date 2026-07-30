import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
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
  InMemoryProcedureCaseRepository,
  loadProcedureCaseValidators,
  type ProcedureCaseCreateRequestV1,
  type ProcedureCaseResponseV1,
  type ProcedureCaseUpdateRequestV1,
} from "../api/v1/procedureCaseIndex.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const OPERATOR_ID = "33333333-3333-4333-8333-333333333333";
const VIEWER_ID = "44444444-4444-4444-8444-444444444444";
const TENANT_B_OPERATOR_ID = "55555555-5555-4555-8555-555555555555";
const REVIEWER_ID = "12121212-3434-4567-8123-121212121212";
const OPERATOR_CREDENTIAL = "66666666-6666-4666-8666-666666666666";
const VIEWER_CREDENTIAL = "77777777-7777-4777-8777-777777777777";
const TENANT_B_CREDENTIAL = "88888888-8888-4888-8888-888888888888";
const REVIEWER_CREDENTIAL = "23232323-3434-4567-8234-232323232323";
const WORKFLOW_ID = "99999999-9999-4999-8999-999999999999";
const DRAFT_WORKFLOW_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOCUMENT_VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const REQUEST_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SECOND_REQUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const FIXED_TIME = new Date("2026-07-21T21:10:00.000Z");
const IDEMPOTENCY_KEY = "procedure-case-request-000001";
const OPERATOR_TOKEN = "case-operator-token-0000000000000000000000001";
const VIEWER_TOKEN = "case-viewer-token-000000000000000000000000001";
const TENANT_B_TOKEN = "case-tenant-b-token-000000000000000000000001";
const REVIEWER_TOKEN = "case-reviewer-token-000000000000000000000001";
const validatorsPromise = loadProcedureCaseValidators();

const identityRecord = (
  credentialId: string,
  tenantId: string,
  principalId: string,
  roles: readonly SecurityRole[]
): CredentialPrincipalRecord => ({ credentialId, tenantId, principalId, roles });

class MapIdentityRepository implements IdentityRepository {
  readonly records = new Map<string, CredentialPrincipalRecord>();
  constructor() {
    this.records.set(hashBearerCredential(OPERATOR_TOKEN), identityRecord(
      OPERATOR_CREDENTIAL, TENANT_A, OPERATOR_ID, ["case_operator"]
    ));
    this.records.set(hashBearerCredential(VIEWER_TOKEN), identityRecord(
      VIEWER_CREDENTIAL, TENANT_A, VIEWER_ID, ["viewer"]
    ));
    this.records.set(hashBearerCredential(TENANT_B_TOKEN), identityRecord(
      TENANT_B_CREDENTIAL, TENANT_B, TENANT_B_OPERATOR_ID, ["case_operator"]
    ));
    this.records.set(hashBearerCredential(REVIEWER_TOKEN), identityRecord(
      REVIEWER_CREDENTIAL, TENANT_A, REVIEWER_ID, ["procedure_reviewer"]
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
  repository: InMemoryProcedureCaseRepository;
}

const startHarness = async (rateLimit = 100): Promise<Harness> => {
  const repository = new InMemoryProcedureCaseRepository(() => FIXED_TIME);
  repository.seedWorkflow({
    tenantId: TENANT_A,
    workflowVersionId: WORKFLOW_ID,
    versionNumber: 3,
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
    lifecycleStatus: "approved",
    steps: [
      { stepId: "need-intake", title: "Registrar necesidad comunitaria" },
      { stepId: "technical-review", title: "Revisar viabilidad técnica" },
    ],
  });
  repository.seedWorkflow({
    tenantId: TENANT_A,
    workflowVersionId: DRAFT_WORKFLOW_ID,
    versionNumber: 4,
    jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
    lifecycleStatus: "draft",
    steps: [{ stepId: "draft-step", title: "Borrador" }],
  });
  repository.seedDocumentVersion(TENANT_A, DOCUMENT_VERSION_ID);
  const server = createApiServer({
    evidenceDependencies: { keywordSearch: async () => [], phraseSearch: async () => [] },
    procedureCaseV1: {
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

const createRequest = (
  workflowVersionId = WORKFLOW_ID,
  tenantId = TENANT_A,
  credentialId = OPERATOR_CREDENTIAL,
  requestId = REQUEST_ID
): ProcedureCaseCreateRequestV1 => ({
  schema_version: "v1",
  operation: "create",
  request_id: requestId,
  tenant_id: tenantId,
  case_key: "water-community-el-hato-001",
  workflow_version_id: workflowVersionId,
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepequez, Guatemala",
  community_reference: "community:el-hato",
  follow_up_at: "2026-08-01T15:00:00.000Z",
  provenance: { credential_id: credentialId },
});

interface CallOptions {
  method?: "GET" | "POST" | "PATCH" | "OPTIONS";
  token?: string | null;
  requestId?: string;
  idempotencyKey?: string | null;
  body?: unknown;
  rawBody?: string;
  contentType?: string | null;
  origin?: string;
}

const call = async (
  harness: Harness,
  path: string,
  options: CallOptions = {}
): Promise<{ response: Response; text: string; json: Record<string, unknown> }> => {
  const method = options.method ?? "POST";
  const headers = new Headers();
  const token = options.token === undefined ? OPERATOR_TOKEN : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? REQUEST_ID);
  if (method === "POST" || method === "PATCH") {
    if (options.idempotencyKey !== null) {
      headers.set("idempotency-key", options.idempotencyKey ?? IDEMPOTENCY_KEY);
    }
    if (options.contentType !== null) headers.set("content-type", options.contentType ?? "application/json");
  }
  if (options.origin) headers.set("origin", options.origin);
  const body = method === "POST" || method === "PATCH"
    ? options.rawBody ?? JSON.stringify(options.body ?? {})
    : undefined;
  const response = await fetch(`${harness.baseUrl}${path}`, { method, headers, body });
  const text = await response.text();
  return { response, text, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
};

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

const createCase = async (
  harness: Harness,
  request = createRequest(),
  key = IDEMPOTENCY_KEY
): Promise<{ response: Response; text: string; body: ProcedureCaseResponseV1 }> => {
  const result = await call(harness, "/api/v1/procedure-cases", {
    requestId: request.request_id,
    idempotencyKey: key,
    body: request,
  });
  const validators = await validatorsPromise;
  assert.equal(validators.response(result.json), true, JSON.stringify(validators.response.errors));
  return { response: result.response, text: result.text, body: result.json as unknown as ProcedureCaseResponseV1 };
};

describe("procedure case API v1", () => {
  it("advertises only implemented methods", async () => {
    const harness = await startHarness();
    try {
      const collection = await call(harness, "/api/v1/procedure-cases", {
        method: "OPTIONS", origin: "https://admin.example",
      });
      assert.equal(collection.response.status, 204);
      assert.equal(collection.response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
      const item = await call(harness, `/api/v1/procedure-cases/${randomUUID()}`, {
        method: "OPTIONS", origin: "https://admin.example",
      });
      assert.equal(item.response.status, 204);
      assert.equal(item.response.headers.get("access-control-allow-methods"), "GET, PATCH, OPTIONS");
    } finally { await stopHarness(harness); }
  });

  it("authenticates and authorizes before parsing the body", async () => {
    const harness = await startHarness();
    try {
      const unauthenticated = await call(harness, "/api/v1/procedure-cases", {
        token: null, rawBody: "{malformed",
      });
      await assertApiError(unauthenticated, 401, "unauthorized");
      assert.equal(unauthenticated.response.headers.get("www-authenticate"), 'Bearer realm="la-muni-rag"');
      assert.equal(harness.repository.authenticationFailures.length, 1);
      const forbidden = await call(harness, "/api/v1/procedure-cases", {
        token: VIEWER_TOKEN, rawBody: "{malformed",
      });
      await assertApiError(forbidden, 403, "forbidden");
      assert.equal(harness.repository.cases.size, 0);
    } finally { await stopHarness(harness); }
  });

  it("creates only from an approved workflow with exact replay and conflict fencing", async () => {
    const harness = await startHarness();
    try {
      const created = await createCase(harness);
      assert.equal(created.response.status, 201);
      assert.equal(created.body.case.workflow_version_id, WORKFLOW_ID);
      assert.equal(created.body.case.workflow_version_number, 3);
      assert.equal(created.body.case.steps.length, 2);
      assert.equal(created.body.case.revision, 1);
      assert.match(created.body.limitations.join(" "), /does not prove legal compliance/i);
      const replay = await createCase(harness);
      assert.equal(replay.text, created.text);
      const aggregateReplay = await createCase(
        harness,
        createRequest(),
        "procedure-case-aggregate-replay-0001"
      );
      assert.equal(aggregateReplay.text, created.text);
      assert.equal(harness.repository.cases.size, 1);
      const conflictRequest = createRequest();
      conflictRequest.case_key = "water-community-conflict-001";
      const conflict = await call(harness, "/api/v1/procedure-cases", { body: conflictRequest });
      await assertApiError(conflict, 409, "idempotency_conflict");
      const draft = await call(harness, "/api/v1/procedure-cases", {
        requestId: SECOND_REQUEST_ID,
        idempotencyKey: "procedure-case-draft-workflow-0001",
        body: createRequest(DRAFT_WORKFLOW_ID, TENANT_A, OPERATOR_CREDENTIAL, SECOND_REQUEST_ID),
      });
      await assertApiError(draft, 409, "workflow_not_approved");
    } finally { await stopHarness(harness); }
  });

  it("converges concurrent transport keys on one immutable case acknowledgement", async () => {
    const harness = await startHarness();
    try {
      const request = createRequest();
      const [left, right] = await Promise.all([
        createCase(harness, request, "procedure-case-concurrent-left-0001"),
        createCase(harness, request, "procedure-case-concurrent-right-0001"),
      ]);
      assert.equal(left.response.status, 201);
      assert.equal(right.response.status, 201);
      assert.equal(left.text, right.text);
      assert.equal(harness.repository.cases.size, 1);
    } finally { await stopHarness(harness); }
  });

  it("supports role-aware operational mutations and append-only evidence dossier history", async () => {
    const harness = await startHarness();
    try {
      const created = await createCase(harness);
      const caseId = created.body.case.case_id;
      let revision = created.body.case.revision;
      const update = async (
        action: ProcedureCaseUpdateRequestV1["action"],
        key: string
      ): Promise<ProcedureCaseResponseV1> => {
        const requestId = randomUUID();
        const request: ProcedureCaseUpdateRequestV1 = {
          schema_version: "v1", operation: "update", request_id: requestId,
          tenant_id: TENANT_A, case_id: caseId, expected_revision: revision,
          action, provenance: { credential_id: OPERATOR_CREDENTIAL },
        };
        const result = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
          method: "PATCH", requestId, idempotencyKey: key, body: request,
        });
        assert.equal(result.response.status, 200);
        const body = result.json as unknown as ProcedureCaseResponseV1;
        revision = body.case.revision;
        return body;
      };
      let body = await update(
        { type: "set_step_state", step_id: "need-intake", state: "in_progress" },
        "procedure-case-step-update-0001"
      );
      assert.equal(body.case.current_step_id, "need-intake");
      body = await update(
        { type: "record_document", requirement_id: "community-request", state: "received", document_version_id: DOCUMENT_VERSION_ID },
        "procedure-case-document-update-0001"
      );
      assert.equal(body.case.documents[0]?.state, "received");
      body = await update(
        { type: "add_blocker", blocker_code: "missing_right_of_way", description: "Pendiente localizar evidencia de servidumbre." },
        "procedure-case-blocker-add-0001"
      );
      assert.equal(body.case.status, "blocked");
      const blockerId = body.case.blockers[0]!.blocker_id;
      body = await update(
        { type: "resolve_blocker", blocker_id: blockerId },
        "procedure-case-blocker-resolve-0001"
      );
      assert.equal(body.case.status, "active");
      assert.equal(body.case.audit_trail.length, 5);
      assert.ok(body.case.audit_trail.every((event, index) => event.revision === index + 1));
      assert.doesNotMatch(JSON.stringify(body.case.audit_trail), /Pendiente localizar evidencia/);
      const read = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "GET", token: VIEWER_TOKEN, requestId: randomUUID(),
      });
      assert.equal(read.response.status, 200);
      assert.equal((read.json.case as { revision: number }).revision, revision);
    } finally { await stopHarness(harness); }
  });

  it("separates case operation from documentary validation review", async () => {
    const harness = await startHarness();
    try {
      const created = await createCase(harness);
      const caseId = created.body.case.case_id;
      const operatorRequestId = randomUUID();
      const operatorDenied = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "PATCH", requestId: operatorRequestId,
        idempotencyKey: "procedure-case-operator-validation-0001",
        body: {
          schema_version: "v1", operation: "update", request_id: operatorRequestId,
          tenant_id: TENANT_A, case_id: caseId, expected_revision: 1,
          action: { type: "set_validation_state", validation_state: "in_review" },
          provenance: { credential_id: OPERATOR_CREDENTIAL },
        } satisfies ProcedureCaseUpdateRequestV1,
      });
      await assertApiError(operatorDenied, 403, "forbidden");

      const reviewerRequestId = randomUUID();
      const reviewed = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "PATCH", token: REVIEWER_TOKEN, requestId: reviewerRequestId,
        idempotencyKey: "procedure-case-reviewer-validation-0001",
        body: {
          schema_version: "v1", operation: "update", request_id: reviewerRequestId,
          tenant_id: TENANT_A, case_id: caseId, expected_revision: 1,
          action: { type: "set_validation_state", validation_state: "in_review" },
          provenance: { credential_id: REVIEWER_CREDENTIAL },
        } satisfies ProcedureCaseUpdateRequestV1,
      });
      assert.equal(reviewed.response.status, 200);
      assert.equal((reviewed.json.case as { validation_state: string }).validation_state, "in_review");
      assert.equal((reviewed.json.case as { status: string }).status, "ready_for_review");
    } finally { await stopHarness(harness); }
  });

  it("enforces tenant isolation, optimistic concurrency, document identity and closure", async () => {
    const harness = await startHarness();
    try {
      const created = await createCase(harness);
      const caseId = created.body.case.case_id;
      const tenantRead = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "GET", token: TENANT_B_TOKEN, requestId: randomUUID(),
      });
      await assertApiError(tenantRead, 404, "not_found");
      const invalidDocId = randomUUID();
      const invalidDocRequestId = randomUUID();
      const invalidDocument = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "PATCH", requestId: invalidDocRequestId,
        idempotencyKey: "procedure-case-invalid-doc-0001",
        body: {
          schema_version: "v1", operation: "update", request_id: invalidDocRequestId,
          tenant_id: TENANT_A, case_id: caseId, expected_revision: 1,
          action: { type: "record_document", requirement_id: "permit", state: "reviewed", document_version_id: invalidDocId },
          provenance: { credential_id: OPERATOR_CREDENTIAL },
        } satisfies ProcedureCaseUpdateRequestV1,
      });
      await assertApiError(invalidDocument, 404, "not_found");
      const staleRequestId = randomUUID();
      const stale = await call(harness, `/api/v1/procedure-cases/${caseId}`, {
        method: "PATCH", requestId: staleRequestId,
        idempotencyKey: "procedure-case-stale-revision-0001",
        body: {
          schema_version: "v1", operation: "update", request_id: staleRequestId,
          tenant_id: TENANT_A, case_id: caseId, expected_revision: 99,
          action: { type: "set_follow_up", follow_up_at: null },
          provenance: { credential_id: OPERATOR_CREDENTIAL },
        } satisfies ProcedureCaseUpdateRequestV1,
      });
      await assertApiError(stale, 409, "revision_conflict");
    } finally { await stopHarness(harness); }
  });

  it("returns bounded rate limits and does not leak requester text into audit", async () => {
    const harness = await startHarness(1);
    try {
      await createCase(harness);
      const second = createRequest(WORKFLOW_ID, TENANT_A, OPERATOR_CREDENTIAL, SECOND_REQUEST_ID);
      second.case_key = "water-community-second-001";
      second.community_reference = "DO_NOT_LEAK_PRIVATE_COMMUNITY";
      const limited = await call(harness, "/api/v1/procedure-cases", {
        requestId: SECOND_REQUEST_ID,
        idempotencyKey: "procedure-case-rate-limit-0001",
        body: second,
      });
      await assertApiError(limited, 429, "rate_limit_exceeded");
      assert.ok(Number(limited.response.headers.get("retry-after")) >= 1);
      assert.doesNotMatch(JSON.stringify(harness.repository.audits), /DO_NOT_LEAK_PRIVATE_COMMUNITY/);
    } finally { await stopHarness(harness); }
  });
});
