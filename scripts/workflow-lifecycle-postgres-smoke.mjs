import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { closeDb } from "../dist/db.js";
import { createApiServer } from "../dist/server.js";

const { Client } = pg;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTHOR_CREDENTIAL = "21212121-2121-4121-8121-212121212121";
const REVIEWER_CREDENTIAL = "23232323-2323-4323-8323-232323232323";
const APPROVER_CREDENTIAL = "24242424-2424-4424-8424-242424242424";
const VIEWER_CREDENTIAL = "25252525-2525-4525-8525-252525252525";
const TENANT_B_VIEWER_CREDENTIAL = "27272727-2727-4727-8727-272727272727";
const AUTHOR_PRINCIPAL = "15151515-1515-4515-8515-151515151515";
const AUTHOR_TOKEN = "workflow-author-api-token-20260721-0000000001";
const REVIEWER_TOKEN = "workflow-reviewer-api-token-20260721-00000001";
const APPROVER_TOKEN = "workflow-approver-api-token-20260721-00000001";
const VIEWER_TOKEN = "workflow-viewer-api-token-20260721-0000000001";
const TENANT_B_VIEWER_TOKEN = "workflow-viewer-b-api-token-20260721-00000001";
const ALLOWED_ORIGIN = "https://workflow-admin.example";
const SECRET_MARKER = "CORRUPT_WORKFLOW_REPLAY_SECRET";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the guarded workflow lifecycle smoke gate");
}

const template = JSON.parse(
  await readFile("contracts/examples/v1/workflow-draft-request.valid.json", "utf8")
);
const idempotencyKey = `workflow-postgres-runtime-${randomUUID()}`;
const procedureKey = `runtime-workflow-${randomUUID()}`;

const draftRequest = (requestId) => {
  const request = structuredClone(template);
  request.request_id = requestId;
  request.tenant_id = TENANT_A;
  request.procedure_key = procedureKey;
  request.provenance.credential_id = AUTHOR_CREDENTIAL;
  request.workflow_definition.request_id = requestId;
  request.workflow_definition.tenant_id = TENANT_A;
  request.workflow_definition.approval_status = "draft";
  request.workflow_definition.provenance.credential_id = AUTHOR_CREDENTIAL;
  return request;
};

const server = createApiServer({
  legacyApiEnabled: false,
  requestTimeoutMs: 15_000,
  v1CorsAllowedOrigins: [ALLOWED_ORIGIN],
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen({ host: "127.0.0.1", port: 0 }, () => {
    server.off("error", reject);
    resolve();
  });
});

const address = server.address();
if (!address || typeof address === "string") {
  throw new Error("workflow lifecycle smoke server did not bind");
}
const baseUrl = `http://127.0.0.1:${address.port}`;

const post = async (path, body, options = {}) => {
  const headers = new Headers({
    authorization: `Bearer ${options.token ?? AUTHOR_TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": options.idempotencyKey ?? idempotencyKey,
    "x-request-id": options.requestId ?? body?.request_id ?? randomUUID(),
  });
  if (options.authorization === null) headers.delete("authorization");
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const get = async (workflowVersionId, options = {}) => {
  const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowVersionId}`, {
    headers: {
      authorization: `Bearer ${options.token ?? VIEWER_TOKEN}`,
      "x-request-id": options.requestId ?? randomUUID(),
    },
  });
  const text = await response.text();
  return { response, text, body: JSON.parse(text) };
};

const corruptStoredReplay = async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_A]);
    const result = await client.query(
      `UPDATE integration.workflow_lifecycle_idempotency
       SET response_body = $1
       WHERE tenant_id = $2::uuid
         AND principal_id = $3::uuid
         AND operation = 'workflow_draft_create_v1'
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND state = 'completed'
       RETURNING audit_id`,
      [
        JSON.stringify({ secret_marker: SECRET_MARKER }),
        TENANT_A,
        AUTHOR_PRINCIPAL,
        createHash("sha256").update(idempotencyKey).digest("hex"),
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
  const malformedRequestId = randomUUID();
  const unauthenticated = await post("/api/v1/workflow-drafts", "{malformed", {
    raw: true,
    authorization: null,
    requestId: malformedRequestId,
    idempotencyKey: `workflow-unauthenticated-${randomUUID()}`,
  });
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.body.tenant_id, null);
  assert.equal(unauthenticated.body.error.code, "unauthorized");
  assert.equal(unauthenticated.text.includes("malformed"), false);

  const requestId = randomUUID();
  const original = draftRequest(requestId);
  const first = await post("/api/v1/workflow-drafts", original, { origin: ALLOWED_ORIGIN });
  assert.equal(first.response.status, 201);
  assert.equal(first.response.headers.get("access-control-allow-origin"), ALLOWED_ORIGIN);
  assert.equal(first.body.response_type, "workflow_version");
  assert.equal(first.body.lifecycle_status, "draft");
  assert.equal(first.body.generation_source, "ai");
  assert.equal(first.body.provenance.credential_id, AUTHOR_CREDENTIAL);
  assert.equal(first.body.workflow_definition.approval_status, "draft");
  assert.equal(first.text.includes("TENANT_B_SECRET_WORKFLOW_TITLE"), false);
  const workflowId = first.body.workflow_version_id;

  const replay = await post("/api/v1/workflow-drafts", original, { origin: ALLOWED_ORIGIN });
  assert.equal(replay.response.status, 201);
  assert.equal(replay.text, first.text);

  const conflicting = structuredClone(original);
  conflicting.procedure_key = `conflicting-${randomUUID()}`;
  const conflict = await post("/api/v1/workflow-drafts", conflicting);
  assert.equal(conflict.response.status, 409);
  assert.equal(conflict.body.error.code, "idempotency_conflict");

  const reviewerSubmitId = randomUUID();
  const reviewerSubmit = await post(
    "/api/v1/workflow-reviews",
    {
      schema_version: "v1",
      request_id: reviewerSubmitId,
      tenant_id: TENANT_A,
      workflow_version_id: workflowId,
      action: "submit_for_review",
      provenance: { credential_id: REVIEWER_CREDENTIAL },
    },
    {
      token: REVIEWER_TOKEN,
      requestId: reviewerSubmitId,
      idempotencyKey: `workflow-reviewer-submit-${randomUUID()}`,
    }
  );
  assert.equal(reviewerSubmit.response.status, 403);
  assert.equal(reviewerSubmit.body.error.code, "forbidden");

  const submitId = randomUUID();
  const submitted = await post(
    "/api/v1/workflow-reviews",
    {
      schema_version: "v1",
      request_id: submitId,
      tenant_id: TENANT_A,
      workflow_version_id: workflowId,
      action: "submit_for_review",
      provenance: { credential_id: AUTHOR_CREDENTIAL },
    },
    {
      token: AUTHOR_TOKEN,
      requestId: submitId,
      idempotencyKey: `workflow-submit-${randomUUID()}`,
    }
  );
  assert.equal(submitted.response.status, 200);
  assert.equal(submitted.body.lifecycle_status, "in_review");

  const reviewId = randomUUID();
  const reviewed = await post(
    "/api/v1/workflow-reviews",
    {
      schema_version: "v1",
      request_id: reviewId,
      tenant_id: TENANT_A,
      workflow_version_id: workflowId,
      action: "record_review",
      decision: "recommended_for_approval",
      notes: "Distinct human reviewer verified the evidence states and documented gaps.",
      provenance: { credential_id: REVIEWER_CREDENTIAL },
    },
    {
      token: REVIEWER_TOKEN,
      requestId: reviewId,
      idempotencyKey: `workflow-review-${randomUUID()}`,
    }
  );
  assert.equal(reviewed.response.status, 200);
  assert.equal(reviewed.body.latest_review.reviewer_principal_id, "16161616-1616-4616-8616-161616161616");

  const approvalId = randomUUID();
  const approved = await post(
    "/api/v1/workflow-approvals",
    {
      schema_version: "v1",
      request_id: approvalId,
      tenant_id: TENANT_A,
      workflow_version_id: workflowId,
      action: "approve",
      notes: "Distinct human approver confirms governance review; this is not a legal opinion.",
      provenance: { credential_id: APPROVER_CREDENTIAL },
    },
    {
      token: APPROVER_TOKEN,
      requestId: approvalId,
      idempotencyKey: `workflow-approval-${randomUUID()}`,
    }
  );
  assert.equal(approved.response.status, 200);
  assert.equal(approved.body.lifecycle_status, "approved");
  assert.equal(approved.body.approval.approver_principal_id, "17171717-1717-4717-8717-171717171717");

  const visible = await get(workflowId);
  assert.equal(visible.response.status, 200);
  assert.equal(visible.body.lifecycle_status, "approved");
  assert.equal(visible.body.provenance.credential_id, VIEWER_CREDENTIAL);

  const replacementRequestId = randomUUID();
  const replacementRequest = draftRequest(replacementRequestId);
  replacementRequest.generation_source = "human";
  replacementRequest.workflow_definition.title =
    "Reviewed replacement workflow for atomic supersession";
  const replacementDraft = await post(
    "/api/v1/workflow-drafts",
    replacementRequest,
    {
      requestId: replacementRequestId,
      idempotencyKey: `workflow-replacement-draft-${randomUUID()}`,
    }
  );
  assert.equal(replacementDraft.response.status, 201);
  assert.equal(replacementDraft.body.version_number, 2);
  assert.equal(replacementDraft.body.procedure_id, first.body.procedure_id);
  const replacementId = replacementDraft.body.workflow_version_id;

  const replacementSubmitId = randomUUID();
  const replacementSubmitted = await post(
    "/api/v1/workflow-reviews",
    {
      schema_version: "v1",
      request_id: replacementSubmitId,
      tenant_id: TENANT_A,
      workflow_version_id: replacementId,
      action: "submit_for_review",
      provenance: { credential_id: AUTHOR_CREDENTIAL },
    },
    {
      requestId: replacementSubmitId,
      idempotencyKey: `workflow-replacement-submit-${randomUUID()}`,
    }
  );
  assert.equal(replacementSubmitted.response.status, 200);
  assert.equal(replacementSubmitted.body.lifecycle_status, "in_review");

  const replacementReviewId = randomUUID();
  const replacementReviewed = await post(
    "/api/v1/workflow-reviews",
    {
      schema_version: "v1",
      request_id: replacementReviewId,
      tenant_id: TENANT_A,
      workflow_version_id: replacementId,
      action: "record_review",
      decision: "recommended_for_approval",
      notes: "Distinct human reviewer recommends the replacement workflow.",
      provenance: { credential_id: REVIEWER_CREDENTIAL },
    },
    {
      token: REVIEWER_TOKEN,
      requestId: replacementReviewId,
      idempotencyKey: `workflow-replacement-review-${randomUUID()}`,
    }
  );
  assert.equal(replacementReviewed.response.status, 200);
  assert.equal(replacementReviewed.body.lifecycle_status, "in_review");

  const supersessionId = randomUUID();
  const superseded = await post(
    "/api/v1/workflow-approvals",
    {
      schema_version: "v1",
      request_id: supersessionId,
      tenant_id: TENANT_A,
      workflow_version_id: workflowId,
      action: "supersede",
      replacement_workflow_version_id: replacementId,
      notes: "Approve the reviewed replacement while superseding the current version atomically.",
      provenance: { credential_id: APPROVER_CREDENTIAL },
    },
    {
      token: APPROVER_TOKEN,
      requestId: supersessionId,
      idempotencyKey: `workflow-atomic-supersession-${randomUUID()}`,
    }
  );
  assert.equal(superseded.response.status, 200);
  assert.equal(superseded.body.lifecycle_status, "superseded");
  assert.equal(superseded.body.superseded_by_workflow_version_id, replacementId);

  const approvedReplacement = await get(replacementId);
  assert.equal(approvedReplacement.response.status, 200);
  assert.equal(approvedReplacement.body.lifecycle_status, "approved");
  assert.equal(
    approvedReplacement.body.approval.approver_principal_id,
    "17171717-1717-4717-8717-171717171717"
  );

  const crossTenant = await get(workflowId, { token: TENANT_B_VIEWER_TOKEN });
  const missing = await get(randomUUID(), {
    token: TENANT_B_VIEWER_TOKEN,
    requestId: randomUUID(),
  });
  assert.equal(crossTenant.response.status, 404);
  assert.equal(missing.response.status, 404);
  assert.deepEqual(crossTenant.body.error, missing.body.error);
  assert.equal(crossTenant.body.tenant_id, TENANT_B);
  assert.equal(crossTenant.text.includes(TENANT_A), false);
  assert.equal(crossTenant.text.includes(procedureKey), false);

  await corruptStoredReplay();
  const corrupt = await post("/api/v1/workflow-drafts", original);
  assert.equal(corrupt.response.status, 500);
  assert.equal(corrupt.body.error.code, "internal_error");
  assert.equal(corrupt.text.includes(SECRET_MARKER), false);

  const recovered = await post("/api/v1/workflow-drafts", original);
  assert.equal(recovered.response.status, 201);
  assert.equal(recovered.body.lifecycle_status, "draft");
  assert.notEqual(recovered.body.workflow_version_id, workflowId);
  assert.equal(recovered.body.version_number, first.body.version_number + 2);

  process.stdout.write(
    `${JSON.stringify({
      result: "workflow_lifecycle_postgres_http_smoke_passed",
      statuses: [
        401, 201, 201, 409, 403, 200, 200, 200, 200,
        201, 200, 200, 200, 200, 404, 404, 500, 201,
      ],
      exactReplay: true,
      humanSeparation: true,
      atomicSupersession: true,
      crossTenantMetadataLeaked: false,
      corruptReplayRecovered: true,
    })}\n`
  );
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await closeDb();
}
