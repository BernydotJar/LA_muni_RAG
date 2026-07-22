import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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
  InMemoryWorkflowLifecycleRepository,
  loadWorkflowLifecycleValidators,
  type StoredWorkflowVersion,
  type WorkflowApprovalRequestV1,
  type WorkflowDraftRequestV1,
  type WorkflowReviewRequestV1,
  type WorkflowVersionResponseV1,
} from "../api/v1/workflowLifecycleIndex.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const AUTHOR_ID = "33333333-3333-4333-8333-333333333333";
const REVIEWER_ID = "44444444-4444-4444-8444-444444444444";
const APPROVER_ID = "55555555-5555-4555-8555-555555555555";
const VIEWER_ID = "66666666-6666-4666-8666-666666666666";
const TENANT_B_AUTHOR_ID = "77777777-7777-4777-8777-777777777777";
const TENANT_B_VIEWER_ID = "88888888-8888-4888-8888-888888888888";
const AUTHOR_CREDENTIAL = "99999999-9999-4999-8999-999999999999";
const REVIEWER_CREDENTIAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPROVER_CREDENTIAL = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VIEWER_CREDENTIAL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B_AUTHOR_CREDENTIAL = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const TENANT_B_VIEWER_CREDENTIAL = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const REQUEST_ID = "12121212-1212-4212-8212-121212121212";
const SECOND_REQUEST_ID = "13131313-1313-4313-8313-131313131313";
const MISSING_WORKFLOW_ID = "14141414-1414-4414-8414-141414141414";
const FIXED_TIME = new Date("2026-07-21T10:00:00.000Z");
const IDEMPOTENCY_KEY = "workflow-lifecycle-request-000001";

const AUTHOR_TOKEN = "author-token-0000000000000000000000000001";
const REVIEWER_TOKEN = "reviewer-token-00000000000000000000000001";
const APPROVER_TOKEN = "approver-token-00000000000000000000000001";
const VIEWER_TOKEN = "viewer-token-0000000000000000000000000001";
const TENANT_B_AUTHOR_TOKEN = "tenant-b-author-token-00000000000000000001";
const TENANT_B_VIEWER_TOKEN = "tenant-b-viewer-token-00000000000000000001";

const draftTemplate = JSON.parse(
  readFileSync(
    new URL("../../contracts/examples/v1/workflow-draft-request.valid.json", import.meta.url),
    "utf8"
  )
) as WorkflowDraftRequestV1;
const validatorsPromise = loadWorkflowLifecycleValidators();

const clone = <T>(value: T): T => structuredClone(value);

const identityRecord = (
  credentialId: string,
  tenantId: string,
  principalId: string,
  roles: readonly SecurityRole[]
): CredentialPrincipalRecord => ({ credentialId, tenantId, principalId, roles });

class MapIdentityRepository implements IdentityRepository {
  readonly digests: string[] = [];
  readonly records = new Map<string, CredentialPrincipalRecord>();

  constructor() {
    for (const [token, record] of [
      [AUTHOR_TOKEN, identityRecord(AUTHOR_CREDENTIAL, TENANT_A, AUTHOR_ID, ["procedure_author"])],
      [REVIEWER_TOKEN, identityRecord(REVIEWER_CREDENTIAL, TENANT_A, REVIEWER_ID, ["procedure_reviewer"])],
      [APPROVER_TOKEN, identityRecord(APPROVER_CREDENTIAL, TENANT_A, APPROVER_ID, ["procedure_approver"])],
      [VIEWER_TOKEN, identityRecord(VIEWER_CREDENTIAL, TENANT_A, VIEWER_ID, ["viewer"])],
      [
        TENANT_B_AUTHOR_TOKEN,
        identityRecord(
          TENANT_B_AUTHOR_CREDENTIAL,
          TENANT_B,
          TENANT_B_AUTHOR_ID,
          ["procedure_author"]
        ),
      ],
      [
        TENANT_B_VIEWER_TOKEN,
        identityRecord(
          TENANT_B_VIEWER_CREDENTIAL,
          TENANT_B,
          TENANT_B_VIEWER_ID,
          ["viewer"]
        ),
      ],
    ] as const) {
      this.records.set(hashBearerCredential(token), record);
    }
  }

  async authenticateByCredentialHash(digest: string): Promise<CredentialPrincipalRecord | null> {
    this.digests.push(digest);
    return this.records.get(digest) ?? null;
  }
}

class StubTransactionPool implements TenantTransactionPool {
  readonly calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
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

class SlowDraftRepository extends InMemoryWorkflowLifecycleRepository {
  private enteredResolve!: () => void;
  private releaseResolve!: () => void;
  readonly entered = new Promise<void>((resolve) => {
    this.enteredResolve = resolve;
  });
  private readonly releaseGate = new Promise<void>((resolve) => {
    this.releaseResolve = resolve;
  });

  releaseDraft(): void {
    this.releaseResolve();
  }

  override async createDraft(
    client: TenantTransactionClient,
    input: Parameters<InMemoryWorkflowLifecycleRepository["createDraft"]>[1]
  ): Promise<StoredWorkflowVersion> {
    this.enteredResolve();
    await this.releaseGate;
    return super.createDraft(client, input);
  }
}

interface Harness {
  server: Server;
  baseUrl: string;
  repository: InMemoryWorkflowLifecycleRepository;
  identity: MapIdentityRepository;
  transactionPool: StubTransactionPool;
}

const startHarness = async (options: {
  repository?: InMemoryWorkflowLifecycleRepository;
  rateLimit?: number;
} = {}): Promise<Harness> => {
  const repository = options.repository ?? new InMemoryWorkflowLifecycleRepository(() => FIXED_TIME);
  const identity = new MapIdentityRepository();
  const transactionPool = new StubTransactionPool();
  const server = createApiServer({
    evidenceDependencies: {
      keywordSearch: async () => [],
      phraseSearch: async () => [],
    },
    workflowLifecycleV1: {
      identityRepository: identity,
      transactionPool,
      repository,
      validators: validatorsPromise,
      now: () => FIXED_TIME,
      createUuid: randomUUID,
      rateLimit: options.rateLimit ?? 100,
      rateWindowSeconds: 60,
      idempotencyTtlSeconds: 86_400,
    },
    v1CorsAllowedOrigins: ["https://admin.example"],
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    repository,
    identity,
    transactionPool,
  };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

const draftRequest = (
  credentialId = AUTHOR_CREDENTIAL,
  tenantId = TENANT_A,
  requestId = REQUEST_ID
): WorkflowDraftRequestV1 => {
  const request = clone(draftTemplate);
  request.request_id = requestId;
  request.tenant_id = tenantId;
  request.provenance.credential_id = credentialId;
  const workflow = request.workflow_definition as Record<string, unknown>;
  workflow.tenant_id = tenantId;
  workflow.request_id = requestId;
  workflow.approval_status = "draft";
  const provenance = workflow.provenance as Record<string, unknown>;
  provenance.credential_id = credentialId;
  return request;
};

const reviewRequest = (
  workflowVersionId: string,
  credentialId: string,
  action: WorkflowReviewRequestV1["action"],
  requestId = REQUEST_ID
): WorkflowReviewRequestV1 => ({
  schema_version: "v1",
  request_id: requestId,
  tenant_id: TENANT_A,
  workflow_version_id: workflowVersionId,
  action,
  ...(action === "record_review"
    ? {
        decision: "recommended_for_approval" as const,
        notes: "La evidencia y las limitaciones fueron revisadas por una persona distinta.",
      }
    : {}),
  provenance: { credential_id: credentialId },
});

const approvalRequest = (
  workflowVersionId: string,
  credentialId = APPROVER_CREDENTIAL,
  requestId = REQUEST_ID
): WorkflowApprovalRequestV1 => ({
  schema_version: "v1",
  request_id: requestId,
  tenant_id: TENANT_A,
  workflow_version_id: workflowVersionId,
  action: "approve",
  notes: "Aprobación humana controlada; no sustituye validación legal del caso concreto.",
  provenance: { credential_id: credentialId },
});

interface CallOptions {
  method?: "GET" | "POST";
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
  const token = options.token === undefined ? AUTHOR_TOKEN : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? REQUEST_ID);
  if (method === "POST") {
    if (options.idempotencyKey !== null) {
      headers.set("idempotency-key", options.idempotencyKey ?? IDEMPOTENCY_KEY);
    }
    if (options.contentType !== null) {
      headers.set("content-type", options.contentType ?? "application/json");
    }
  }
  if (options.origin) headers.set("origin", options.origin);
  const body = method === "POST"
    ? options.rawBody ?? JSON.stringify(options.body ?? {})
    : undefined;
  const response = await fetch(`${harness.baseUrl}${path}`, { method, headers, body });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
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
  assert.equal(result.response.headers.get("x-request-id"), result.json.request_id);
};

const createDraft = async (
  harness: Harness,
  request = draftRequest(),
  token = AUTHOR_TOKEN,
  idempotencyKey = IDEMPOTENCY_KEY
): Promise<{ response: Response; text: string; body: WorkflowVersionResponseV1 }> => {
  const result = await call(harness, "/api/v1/workflow-drafts", {
    token,
    requestId: request.request_id,
    idempotencyKey,
    body: request,
  });
  const validators = await validatorsPromise;
  assert.equal(validators.workflowVersion(result.json), true, JSON.stringify(validators.workflowVersion.errors));
  return {
    response: result.response,
    text: result.text,
    body: result.json as unknown as WorkflowVersionResponseV1,
  };
};

describe("workflow lifecycle API v1", () => {
  it("advertises only the real method for each lifecycle preflight", async () => {
    const harness = await startHarness();
    try {
      const draft = await fetch(`${harness.baseUrl}/api/v1/workflow-drafts`, {
        method: "OPTIONS",
        headers: { origin: "https://admin.example" },
      });
      assert.equal(draft.status, 204);
      assert.equal(draft.headers.get("access-control-allow-origin"), "https://admin.example");
      assert.equal(draft.headers.get("access-control-allow-methods"), "POST, OPTIONS");

      const read = await fetch(`${harness.baseUrl}/api/v1/workflows/${MISSING_WORKFLOW_ID}`, {
        method: "OPTIONS",
        headers: { origin: "https://admin.example" },
      });
      assert.equal(read.status, 204);
      assert.equal(read.headers.get("access-control-allow-methods"), "GET, OPTIONS");
    } finally {
      await stopHarness(harness);
    }
  });

  it("authenticates before parsing malformed JSON and returns a uniform tenantless 401", async () => {
    const harness = await startHarness();
    try {
      const result = await call(harness, "/api/v1/workflow-drafts", {
        token: null,
        rawBody: "{malformed-json",
      });
      await assertApiError(result, 401, "unauthorized");
      assert.equal(result.response.headers.get("www-authenticate"), 'Bearer realm="la-muni-rag"');
      assert.equal(result.response.headers.get("connection"), "close");
      assert.equal(result.json.tenant_id, null);
      assert.equal(harness.repository.workflows.size, 0);
      assert.equal(harness.repository.authenticationFailures.length, 1);
      assert.doesNotMatch(result.text, /malformed-json|tenant-a-private|DO_NOT_LEAK/i);
    } finally {
      await stopHarness(harness);
    }
  });

  it("denies an unauthorized role before parsing the request body", async () => {
    const harness = await startHarness();
    try {
      const result = await call(harness, "/api/v1/workflow-drafts", {
        token: VIEWER_TOKEN,
        rawBody: "{malformed-json",
      });
      await assertApiError(result, 403, "forbidden");
      assert.equal(harness.repository.workflows.size, 0);
      assert.equal(harness.repository.audits.at(-1)?.reasonCode, "forbidden");
    } finally {
      await stopHarness(harness);
    }
  });

  it("creates only a draft and provides exact replay plus request-digest conflict", async () => {
    const harness = await startHarness();
    try {
      const request = draftRequest();
      const created = await createDraft(harness, request);
      assert.equal(created.response.status, 201);
      assert.equal(created.body.lifecycle_status, "draft");
      assert.equal(created.body.generation_source, "ai");
      assert.equal(harness.repository.workflows.size, 1);

      const replay = await createDraft(harness, request);
      assert.equal(replay.response.status, 201);
      assert.equal(replay.text, created.text);
      assert.equal(harness.repository.workflows.size, 1);

      const conflicting = draftRequest();
      conflicting.procedure_key = "community-water-request-conflict";
      const conflict = await call(harness, "/api/v1/workflow-drafts", {
        body: conflicting,
      });
      await assertApiError(conflict, 409, "idempotency_conflict");
      assert.equal(harness.repository.workflows.size, 1);
    } finally {
      await stopHarness(harness);
    }
  });

  it("does not release another request's in-progress idempotency claim", async () => {
    const repository = new SlowDraftRepository(() => FIXED_TIME);
    const harness = await startHarness({ repository });
    try {
      const request = draftRequest();
      const firstPromise = createDraft(harness, request);
      await repository.entered;

      const concurrent = await call(harness, "/api/v1/workflow-drafts", { body: request });
      await assertApiError(concurrent, 409, "request_in_progress");
      repository.releaseDraft();

      const first = await firstPromise;
      assert.equal(first.response.status, 201);
      const replay = await createDraft(harness, request);
      assert.equal(replay.text, first.text);
      assert.equal(repository.workflows.size, 1);
    } finally {
      repository.releaseDraft();
      await stopHarness(harness);
    }
  });

  it("enforces action-specific RBAC and the human draft-review-approval lifecycle", async () => {
    const harness = await startHarness();
    try {
      const created = await createDraft(harness);
      const workflowId = created.body.workflow_version_id;

      const reviewerSubmit = await call(harness, "/api/v1/workflow-reviews", {
        token: REVIEWER_TOKEN,
        idempotencyKey: "workflow-reviewer-submit-000001",
        body: reviewRequest(workflowId, REVIEWER_CREDENTIAL, "submit_for_review"),
      });
      await assertApiError(reviewerSubmit, 403, "forbidden");

      const submitted = await call(harness, "/api/v1/workflow-reviews", {
        token: AUTHOR_TOKEN,
        idempotencyKey: "workflow-author-submit-000001",
        body: reviewRequest(workflowId, AUTHOR_CREDENTIAL, "submit_for_review"),
      });
      assert.equal(submitted.response.status, 200);
      assert.equal(submitted.json.lifecycle_status, "in_review");

      const authorReview = await call(harness, "/api/v1/workflow-reviews", {
        token: AUTHOR_TOKEN,
        idempotencyKey: "workflow-author-review-000001",
        body: reviewRequest(workflowId, AUTHOR_CREDENTIAL, "record_review"),
      });
      await assertApiError(authorReview, 403, "forbidden");

      const reviewed = await call(harness, "/api/v1/workflow-reviews", {
        token: REVIEWER_TOKEN,
        idempotencyKey: "workflow-review-000001",
        body: reviewRequest(workflowId, REVIEWER_CREDENTIAL, "record_review"),
      });
      assert.equal(reviewed.response.status, 200);
      assert.equal(reviewed.json.lifecycle_status, "in_review");
      assert.equal(
        (reviewed.json.latest_review as { reviewer_principal_id: string }).reviewer_principal_id,
        REVIEWER_ID
      );

      const approved = await call(harness, "/api/v1/workflow-approvals", {
        token: APPROVER_TOKEN,
        idempotencyKey: "workflow-approval-000001",
        body: approvalRequest(workflowId),
      });
      assert.equal(approved.response.status, 200);
      assert.equal(approved.json.lifecycle_status, "approved");
      assert.equal(
        (approved.json.approval as { approver_principal_id: string }).approver_principal_id,
        APPROVER_ID
      );

      const read = await call(harness, `/api/v1/workflows/${workflowId}`, {
        method: "GET",
        token: VIEWER_TOKEN,
      });
      assert.equal(read.response.status, 200);
      assert.equal(read.json.lifecycle_status, "approved");

      const replacementRequest = draftRequest(
        AUTHOR_CREDENTIAL,
        TENANT_A,
        SECOND_REQUEST_ID
      );
      replacementRequest.generation_source = "human";
      const replacementDefinition = replacementRequest.workflow_definition as Record<string, unknown>;
      replacementDefinition.title = "Replacement workflow reviewed before atomic supersession";
      const replacementCreated = await createDraft(
        harness,
        replacementRequest,
        AUTHOR_TOKEN,
        "workflow-replacement-draft-000001"
      );
      assert.equal(replacementCreated.response.status, 201);
      assert.equal(replacementCreated.body.version_number, 2);
      assert.equal(replacementCreated.body.procedure_id, created.body.procedure_id);
      const replacementId = replacementCreated.body.workflow_version_id;

      const replacementSubmitId = randomUUID();
      const replacementSubmitted = await call(harness, "/api/v1/workflow-reviews", {
        token: AUTHOR_TOKEN,
        requestId: replacementSubmitId,
        idempotencyKey: "workflow-replacement-submit-000001",
        body: reviewRequest(
          replacementId,
          AUTHOR_CREDENTIAL,
          "submit_for_review",
          replacementSubmitId
        ),
      });
      assert.equal(replacementSubmitted.response.status, 200);
      assert.equal(replacementSubmitted.json.lifecycle_status, "in_review");

      const replacementReviewId = randomUUID();
      const replacementReviewed = await call(harness, "/api/v1/workflow-reviews", {
        token: REVIEWER_TOKEN,
        requestId: replacementReviewId,
        idempotencyKey: "workflow-replacement-review-000001",
        body: reviewRequest(
          replacementId,
          REVIEWER_CREDENTIAL,
          "record_review",
          replacementReviewId
        ),
      });
      assert.equal(replacementReviewed.response.status, 200);
      assert.equal(replacementReviewed.json.lifecycle_status, "in_review");

      const supersessionRequestId = randomUUID();
      const superseded = await call(harness, "/api/v1/workflow-approvals", {
        token: APPROVER_TOKEN,
        requestId: supersessionRequestId,
        idempotencyKey: "workflow-atomic-supersession-000001",
        body: {
          schema_version: "v1",
          request_id: supersessionRequestId,
          tenant_id: TENANT_A,
          workflow_version_id: workflowId,
          action: "supersede",
          replacement_workflow_version_id: replacementId,
          notes: "Approve the reviewed replacement while superseding the current version atomically.",
          provenance: { credential_id: APPROVER_CREDENTIAL },
        } satisfies WorkflowApprovalRequestV1,
      });
      assert.equal(superseded.response.status, 200);
      assert.equal(superseded.json.lifecycle_status, "superseded");
      assert.equal(superseded.json.superseded_by_workflow_version_id, replacementId);

      const replacementRead = await call(harness, `/api/v1/workflows/${replacementId}`, {
        method: "GET",
        token: VIEWER_TOKEN,
        requestId: randomUUID(),
      });
      assert.equal(replacementRead.response.status, 200);
      assert.equal(replacementRead.json.lifecycle_status, "approved");
      assert.equal(
        (replacementRead.json.approval as { approver_principal_id: string }).approver_principal_id,
        APPROVER_ID
      );
      assert.equal(
        [...harness.repository.workflows.values()].filter(
          (record) => record.lifecycleStatus === "approved"
        ).length,
        1
      );
      assert.ok(
        harness.repository.audits.some(
          (record) =>
            record.eventType === "rag.workflow.approved" && record.entityId === replacementId
        )
      );
      assert.ok(
        harness.repository.audits.some(
          (record) =>
            record.eventType === "rag.workflow.superseded" && record.entityId === workflowId
        )
      );
      assert.ok(harness.repository.audits.every((record) => record.tenantId === TENANT_A));
    } finally {
      await stopHarness(harness);
    }
  });

  it("rejects approval before a recommended review", async () => {
    const harness = await startHarness();
    try {
      const created = await createDraft(harness);
      const approval = await call(harness, "/api/v1/workflow-approvals", {
        token: APPROVER_TOKEN,
        idempotencyKey: "workflow-premature-approval-000001",
        body: approvalRequest(created.body.workflow_version_id),
      });
      await assertApiError(approval, 409, "invalid_transition");
      assert.equal(
        harness.repository.workflows.get(
          `${TENANT_A}:${created.body.workflow_version_id}`
        )?.lifecycleStatus,
        "draft"
      );
    } finally {
      await stopHarness(harness);
    }
  });

  it("blocks nested tenant or approval-state promotion without creating workflow metadata", async () => {
    const harness = await startHarness();
    try {
      const crossTenant = draftRequest();
      (crossTenant.workflow_definition as Record<string, unknown>).tenant_id = TENANT_B;
      const crossResult = await call(harness, "/api/v1/workflow-drafts", {
        body: crossTenant,
      });
      await assertApiError(crossResult, 403, "forbidden");

      const promoted = draftRequest();
      (promoted.workflow_definition as Record<string, unknown>).approval_status = "approved";
      const promotedResult = await call(harness, "/api/v1/workflow-drafts", {
        idempotencyKey: "workflow-promoted-draft-000001",
        body: promoted,
      });
      await assertApiError(promotedResult, 400, "invalid_request");
      assert.equal(harness.repository.workflows.size, 0);
    } finally {
      await stopHarness(harness);
    }
  });

  it("returns indistinguishable 404 semantics for missing and cross-tenant workflow ids", async () => {
    const harness = await startHarness();
    try {
      const created = await createDraft(harness);
      const crossTenant = await call(
        harness,
        `/api/v1/workflows/${created.body.workflow_version_id}`,
        { method: "GET", token: TENANT_B_VIEWER_TOKEN }
      );
      const missing = await call(harness, `/api/v1/workflows/${MISSING_WORKFLOW_ID}`, {
        method: "GET",
        token: TENANT_B_VIEWER_TOKEN,
        requestId: SECOND_REQUEST_ID,
      });
      await assertApiError(crossTenant, 404, "not_found");
      await assertApiError(missing, 404, "not_found");
      assert.deepEqual(crossTenant.json.error, missing.json.error);
      assert.equal(crossTenant.json.tenant_id, TENANT_B);
      assert.equal(missing.json.tenant_id, TENANT_B);
      for (const secret of [
        TENANT_A,
        created.body.procedure_id,
        created.body.procedure_key,
        created.body.title,
      ]) {
        assert.doesNotMatch(crossTenant.text, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }
    } finally {
      await stopHarness(harness);
    }
  });

  it("denies an outer cross-tenant draft before persistence", async () => {
    const harness = await startHarness();
    try {
      const request = draftRequest(TENANT_B_AUTHOR_CREDENTIAL, TENANT_A);
      const result = await call(harness, "/api/v1/workflow-drafts", {
        token: TENANT_B_AUTHOR_TOKEN,
        body: request,
      });
      await assertApiError(result, 403, "forbidden");
      assert.equal(harness.repository.workflows.size, 0);
      assert.doesNotMatch(result.text, new RegExp(AUTHOR_CREDENTIAL));
    } finally {
      await stopHarness(harness);
    }
  });

  it("applies bounded per-principal rate limiting before mutation", async () => {
    const harness = await startHarness({ rateLimit: 1 });
    try {
      const first = await createDraft(harness);
      assert.equal(first.response.status, 201);
      const secondRequest = draftRequest(AUTHOR_CREDENTIAL, TENANT_A, SECOND_REQUEST_ID);
      secondRequest.procedure_key = "second-community-procedure";
      const limited = await call(harness, "/api/v1/workflow-drafts", {
        requestId: SECOND_REQUEST_ID,
        idempotencyKey: "workflow-rate-limited-000001",
        body: secondRequest,
      });
      await assertApiError(limited, 429, "rate_limit_exceeded");
      assert.ok(Number(limited.response.headers.get("retry-after")) >= 1);
      assert.equal(harness.repository.workflows.size, 1);
    } finally {
      await stopHarness(harness);
    }
  });
});
