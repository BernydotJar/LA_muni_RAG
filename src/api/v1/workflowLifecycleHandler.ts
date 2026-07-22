import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, readJsonBody } from "../../http.js";
import {
  authenticateBearer,
  hasPermission,
  isCanonicalUuid,
  requirePermission,
  requireTenantMatch,
  SecurityError,
  tenantIdsEqual,
  withTenantTransaction,
  type AuthenticatedPrincipal,
  type SecurityPermission,
} from "../../security/index.js";
import { WorkflowLifecycleError } from "../../workflowLifecycle/stateMachine.js";
import {
  ApiV1Error,
  buildApiError,
  forbiddenError,
  internalError,
  serializeValidatedApiError,
  unauthorizedError,
} from "./errors.js";
import type {
  LifecycleIdempotencyScope,
  StoredWorkflowVersion,
  WorkflowApprovalRequestV1,
  WorkflowDraftRequestV1,
  WorkflowLifecycleApiDependencies,
  WorkflowLifecycleOperation,
  WorkflowLifecyclePrincipal,
  WorkflowLifecycleRateOperation,
  WorkflowReviewRequestV1,
  WorkflowVersionResponseV1,
} from "./workflowLifecycleTypes.js";
import {
  WORKFLOW_APPROVALS_ROUTE,
  WORKFLOW_DRAFTS_ROUTE,
  WORKFLOW_REVIEWS_ROUTE,
  WORKFLOWS_ROUTE_PREFIX,
  mapApproval,
  mapReview,
} from "./workflowLifecycleTypes.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';
const MAX_WORKFLOW_REQUEST_BYTES = 2 * 1024 * 1024 + 64 * 1024;

type RouteKind = "draft" | "review" | "approval" | "get";
type LifecycleStatusCode = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;

interface WorkflowHttpResponse {
  statusCode: LifecycleStatusCode | 200 | 201;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
  closeConnection?: boolean;
}

class WorkflowApiError extends Error {
  constructor(
    public readonly statusCode: LifecycleStatusCode,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly auditId?: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "WorkflowApiError";
  }
}

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

const routeKind = (pathname: string): RouteKind | null => {
  if (pathname === WORKFLOW_DRAFTS_ROUTE) return "draft";
  if (pathname === WORKFLOW_REVIEWS_ROUTE) return "review";
  if (pathname === WORKFLOW_APPROVALS_ROUTE) return "approval";
  if (pathname.startsWith(WORKFLOWS_ROUTE_PREFIX)) return "get";
  return null;
};

const rateOperation = (kind: RouteKind): WorkflowLifecycleRateOperation => {
  if (kind === "draft") return "workflow_draft_create_v1";
  if (kind === "review") return "workflow_review_write_v1";
  if (kind === "approval") return "workflow_approval_write_v1";
  return "workflow_read_v1";
};

const canonicalJson = (value: unknown): string => {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, normalize(nested)])
      );
    }
    return item;
  };
  return JSON.stringify(normalize(value));
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const requestIdFromHeader = (
  req: IncomingMessage,
  createUuid: () => string
): { requestId: string; valid: boolean } => {
  const value = singleHeader(req.headers["x-request-id"]);
  return isCanonicalUuid(value)
    ? { requestId: value.toLowerCase(), valid: true }
    : { requestId: createUuid(), valid: false };
};

const contentTypeIsJson = (req: IncomingMessage): boolean => {
  const value = singleHeader(req.headers["content-type"]);
  return Boolean(value && /^application\/json(?:\s*;|$)/i.test(value));
};

const requestMayHaveUnreadBody = (req: IncomingMessage): boolean => {
  if (req.headers["transfer-encoding"] !== undefined) return true;
  const contentLength = req.headers["content-length"];
  if (Array.isArray(contentLength)) return true;
  return typeof contentLength === "string" && contentLength.trim() !== "0";
};

const sendResponse = (res: ServerResponse, response: WorkflowHttpResponse): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(response.body),
    "cache-control": "no-store",
    "x-request-id": response.requestId,
  };
  if (response.wwwAuthenticate) headers["www-authenticate"] = WWW_AUTHENTICATE;
  if (response.retryAfterSeconds) headers["retry-after"] = response.retryAfterSeconds;
  if (response.closeConnection) {
    res.shouldKeepAlive = false;
    headers.connection = "close";
  }
  res.writeHead(response.statusCode, headers);
  res.end(response.body);
};

const responseFor = (
  record: StoredWorkflowVersion,
  requestId: string,
  credentialId: string,
  auditId: string,
  createdAt: string
): WorkflowVersionResponseV1 => ({
  schema_version: "v1",
  response_type: "workflow_version",
  request_id: requestId,
  tenant_id: record.tenantId,
  procedure_id: record.procedureId,
  procedure_key: record.procedureKey,
  workflow_version_id: record.workflowVersionId,
  version_number: record.versionNumber,
  lifecycle_status: record.lifecycleStatus,
  generation_source: record.generationSource,
  revision: record.revision,
  title: record.title,
  jurisdiction: record.jurisdiction,
  workflow_definition: structuredClone(record.workflowDefinition),
  evidence_bundle_id: record.evidenceBundleId,
  submitted_by_principal_id: record.submittedByPrincipalId,
  submitted_at: record.submittedAt,
  latest_review: mapReview(record.latestReview),
  approval: mapApproval(record.approval),
  superseded_by_workflow_version_id: record.supersededByWorkflowVersionId,
  archived_by_principal_id: record.archivedByPrincipalId,
  archived_at: record.archivedAt,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
  limitations: [
    "Lifecycle status records a human governance decision; it does not prove legal sufficiency or institutional execution.",
    ...(record.lifecycleStatus === "draft"
      ? ["Draft workflow; human review and approval are required before authoritative use."]
      : []),
    ...(record.generationSource === "ai"
      ? ["AI-generated source; the version entered the lifecycle as draft."]
      : []),
  ],
  provenance: {
    credential_id: credentialId,
    audit_id: auditId,
    created_at: createdAt,
  },
});

const errorMessage = (code: string): string => {
  if (code === "unauthorized") return "Authentication required";
  if (code === "forbidden") return "Access denied";
  if (code === "not_found") return "Resource not found";
  if (code === "rate_limit_exceeded") return "Rate limit exceeded";
  if (code === "idempotency_conflict") {
    return "Idempotency-Key was already used with a different request";
  }
  if (code === "request_in_progress") {
    return "An identical request with this Idempotency-Key is still in progress";
  }
  if (code === "invalid_transition") return "Workflow lifecycle transition is not allowed";
  if (code === "review_required") return "A distinct recommended human review is required";
  if (code === "separation_of_duties") {
    return "Creator, reviewer, and approver must be distinct";
  }
  if (code === "invalid_request") return "Request validation failed";
  return "Unexpected server error";
};

const apiErrorFrom = (error: WorkflowApiError): ApiV1Error => {
  if (error.code === "unauthorized") return unauthorizedError();
  if (error.code === "forbidden") return forbiddenError();
  if (error.code === "internal_error") return internalError();
  return new ApiV1Error(
    error.statusCode,
    error.code,
    errorMessage(error.code),
    [],
    error.retryable
  );
};

const errorBody = async (
  dependencies: WorkflowLifecycleApiDependencies,
  error: WorkflowApiError,
  context: {
    tenantId: string | null;
    credentialId: string | null;
    requestId: string;
    auditId: string;
  }
): Promise<string> => {
  const apiError = apiErrorFrom(error);
  const identity = {
    ...context,
    createdAt: dependencies.now().toISOString(),
  };
  try {
    const validators = await dependencies.validators;
    return serializeValidatedApiError(apiError, identity, validators);
  } catch {
    return JSON.stringify(buildApiError(apiError, identity));
  }
};

const lifecycleError = (error: WorkflowLifecycleError): WorkflowApiError => {
  if (error.code === "workflow_tenant_denied" || error.code.endsWith("_denied")) {
    return new WorkflowApiError(403, "forbidden", "Access denied");
  }
  if (error.code === "workflow_review_required") {
    return new WorkflowApiError(409, "review_required", "Human review required");
  }
  if (error.code === "workflow_separation_of_duties") {
    return new WorkflowApiError(409, "separation_of_duties", "Separation of duties required");
  }
  if (
    error.code === "workflow_transition_invalid" ||
    error.code === "workflow_supersession_invalid"
  ) {
    return new WorkflowApiError(409, "invalid_transition", "Lifecycle transition invalid");
  }
  if (error.code.includes("invalid")) {
    return new WorkflowApiError(400, "invalid_request", "Request validation failed");
  }
  return new WorkflowApiError(500, "internal_error", "Unexpected server error", error.retryable);
};

const normalizeError = (error: unknown): WorkflowApiError => {
  if (error instanceof WorkflowApiError) return error;
  if (error instanceof WorkflowLifecycleError) return lifecycleError(error);
  if (error instanceof SecurityError) {
    return error.statusCode === 401
      ? new WorkflowApiError(401, "unauthorized", "Authentication required")
      : new WorkflowApiError(403, "forbidden", "Access denied");
  }
  if (error instanceof HttpError) {
    return new WorkflowApiError(400, "invalid_request", "Request validation failed");
  }
  return new WorkflowApiError(500, "internal_error", "Unexpected server error", true);
};

const requireRequestIdentity = (
  body: { request_id: string; tenant_id: string; provenance: { credential_id: string } },
  requestId: string,
  principal: AuthenticatedPrincipal
): void => {
  if (!tenantIdsEqual(body.request_id, requestId)) {
    throw new WorkflowApiError(400, "invalid_request", "Request identity mismatch");
  }
  try {
    requireTenantMatch(principal, body.tenant_id);
    if (!tenantIdsEqual(body.provenance.credential_id, principal.credentialId)) {
      throw new SecurityError(403, "forbidden", "Access denied");
    }
  } catch {
    throw new WorkflowApiError(403, "forbidden", "Access denied");
  }
};

const requireCoarsePermission = (principal: AuthenticatedPrincipal, kind: RouteKind): void => {
  if (kind === "get") return requirePermission(principal, "procedure:read");
  if (kind === "draft") return requirePermission(principal, "procedure:draft");
  if (kind === "approval") return requirePermission(principal, "procedure:approve");
  if (!hasPermission(principal, "procedure:draft") && !hasPermission(principal, "procedure:review")) {
    throw new SecurityError(403, "forbidden", "Access denied");
  }
};

const mutationOperation = (
  kind: "draft" | "review" | "approval",
  body: WorkflowDraftRequestV1 | WorkflowReviewRequestV1 | WorkflowApprovalRequestV1
): WorkflowLifecycleOperation => {
  if (kind === "draft") return "workflow_draft_create_v1";
  if (kind === "review") {
    return (body as WorkflowReviewRequestV1).action === "submit_for_review"
      ? "workflow_submit_review_v1"
      : "workflow_record_review_v1";
  }
  const action = (body as WorkflowApprovalRequestV1).action;
  if (action === "approve") return "workflow_approve_v1";
  if (action === "supersede") return "workflow_supersede_v1";
  return "workflow_archive_v1";
};

const permissionForOperation = (operation: WorkflowLifecycleOperation): SecurityPermission => {
  if (
    operation === "workflow_draft_create_v1" ||
    operation === "workflow_submit_review_v1"
  ) {
    return "procedure:draft";
  }
  if (operation === "workflow_record_review_v1") return "procedure:review";
  return "procedure:approve";
};

const eventTypeFor = (operation: WorkflowLifecycleOperation): string => ({
  workflow_draft_create_v1: "rag.workflow.draft_created",
  workflow_submit_review_v1: "rag.workflow.submitted_for_review",
  workflow_record_review_v1: "rag.workflow.review_recorded",
  workflow_approve_v1: "rag.workflow.approved",
  workflow_supersede_v1: "rag.workflow.superseded",
  workflow_archive_v1: "rag.workflow.archived",
})[operation];

const validateDraftBoundary = (
  request: WorkflowDraftRequestV1,
  principal: AuthenticatedPrincipal
): void => {
  const workflow = request.workflow_definition as Record<string, unknown>;
  if (
    !tenantIdsEqual(String(workflow.tenant_id ?? ""), principal.tenantId) ||
    workflow.approval_status !== "draft"
  ) {
    throw new WorkflowApiError(403, "forbidden", "Access denied");
  }
};

const executeMutation = async (
  kind: "draft" | "review" | "approval",
  parsed: unknown,
  principal: WorkflowLifecyclePrincipal,
  requestId: string,
  idempotencyKey: string,
  dependencies: WorkflowLifecycleApiDependencies
): Promise<{ status: 200 | 201; body: WorkflowVersionResponseV1 }> => {
  const validators = await dependencies.validators;
  let body: WorkflowDraftRequestV1 | WorkflowReviewRequestV1 | WorkflowApprovalRequestV1;

  if (kind === "draft") {
    if (!validators.draftRequest(parsed)) {
      throw new WorkflowApiError(400, "invalid_request", "Request validation failed");
    }
    body = parsed as WorkflowDraftRequestV1;
    if (!validators.procedureWorkflow(body.workflow_definition)) {
      throw new WorkflowApiError(400, "invalid_request", "Workflow definition is invalid");
    }
    validateDraftBoundary(body, principal);
  } else if (kind === "review") {
    if (!validators.reviewRequest(parsed)) {
      throw new WorkflowApiError(400, "invalid_request", "Request validation failed");
    }
    body = parsed as WorkflowReviewRequestV1;
  } else {
    if (!validators.approvalRequest(parsed)) {
      throw new WorkflowApiError(400, "invalid_request", "Request validation failed");
    }
    body = parsed as WorkflowApprovalRequestV1;
  }

  requireRequestIdentity(body, requestId, principal);
  const operation = mutationOperation(kind, body);
  requirePermission(principal, permissionForOperation(operation));

  const requestSha256 = sha256(canonicalJson(body));
  const idempotencyKeySha256 = sha256(idempotencyKey);
  const createdAt = dependencies.now().toISOString();
  const expiresAt = new Date(
    Date.parse(createdAt) + dependencies.idempotencyTtlSeconds * 1000
  ).toISOString();
  const scope: LifecycleIdempotencyScope = {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    operation,
    idempotencyKeySha256,
    requestSha256,
    now: createdAt,
    expiresAt,
  };
  let claimedNew = false;
  let invalidReplay = false;

  try {
    const result = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
      const claim = await dependencies.repository.claimIdempotency(client, scope);
      if (claim.kind === "conflict") {
        throw new WorkflowApiError(409, "idempotency_conflict", "Idempotency conflict");
      }
      if (claim.kind === "processing") {
        throw new WorkflowApiError(409, "request_in_progress", "Request in progress", true);
      }
      if (claim.kind === "replay") {
        try {
          const replay = JSON.parse(claim.responseBody) as WorkflowVersionResponseV1;
          if (
            !validators.workflowVersion(replay) ||
            !tenantIdsEqual(replay.request_id, requestId) ||
            !tenantIdsEqual(replay.tenant_id, principal.tenantId) ||
            !tenantIdsEqual(replay.provenance.audit_id, claim.auditId)
          ) {
            throw new Error("invalid stored workflow replay");
          }
          return { status: claim.responseStatus, body: replay };
        } catch {
          await dependencies.repository.invalidateCompletedIdempotency(client, scope);
          await dependencies.repository.recordAudit(client, {
            auditId: dependencies.createUuid(),
            tenantId: principal.tenantId,
            principalId: principal.principalId,
            eventType: "rag.workflow.idempotency_invalidated",
            entityId: null,
            outcome: "error",
            reasonCode: "stored_response_invalid",
            requestId,
            operation,
          });
          invalidReplay = true;
          return null;
        }
      }
      claimedNew = true;

      let record: StoredWorkflowVersion;
      let status: 200 | 201 = 200;
      if (kind === "draft") {
        const request = body as WorkflowDraftRequestV1;
        record = await dependencies.repository.createDraft(client, {
          procedureId: dependencies.createUuid(),
          workflowVersionId: dependencies.createUuid(),
          request,
          principal,
          now: createdAt,
        });
        status = 201;
      } else {
        const request = body as WorkflowReviewRequestV1 | WorkflowApprovalRequestV1;
        const existing = await dependencies.repository.get(
          client,
          principal.tenantId,
          request.workflow_version_id,
          true
        );
        if (!existing) throw new WorkflowApiError(404, "not_found", "Workflow not found");

        if (kind === "review") {
          const review = request as WorkflowReviewRequestV1;
          record = review.action === "submit_for_review"
            ? await dependencies.repository.submitForReview(client, existing, principal, createdAt)
            : await dependencies.repository.recordReview(client, existing, principal, {
                reviewId: dependencies.createUuid(),
                decision: review.decision!,
                notes: review.notes!,
                now: createdAt,
              });
        } else {
          const approval = request as WorkflowApprovalRequestV1;
          if (approval.action === "approve") {
            record = await dependencies.repository.approve(client, existing, principal, {
              approvalId: dependencies.createUuid(),
              notes: approval.notes,
              now: createdAt,
            });
          } else if (approval.action === "supersede") {
            record = await dependencies.repository.supersede(client, existing, principal, {
              replacementWorkflowVersionId: approval.replacement_workflow_version_id!,
              approvalId: dependencies.createUuid(),
              notes: approval.notes,
              now: createdAt,
            });
          } else {
            record = await dependencies.repository.archive(client, existing, principal, createdAt);
          }
        }
      }

      const auditId = dependencies.createUuid();
      const response = responseFor(
        record,
        requestId,
        principal.credentialId,
        auditId,
        createdAt
      );
      if (!validators.workflowVersion(response)) {
        throw new WorkflowApiError(500, "internal_error", "Workflow response validation failed", true);
      }
      const serialized = JSON.stringify(response);
      if (operation === "workflow_supersede_v1") {
        const replacementWorkflowVersionId = (body as WorkflowApprovalRequestV1)
          .replacement_workflow_version_id!;
        await dependencies.repository.recordAudit(client, {
          auditId: dependencies.createUuid(),
          tenantId: principal.tenantId,
          principalId: principal.principalId,
          eventType: "rag.workflow.approved",
          entityId: replacementWorkflowVersionId,
          outcome: "success",
          reasonCode: "replacement_approved_during_supersession",
          requestId,
          operation,
        });
      }
      await dependencies.repository.recordAudit(client, {
        auditId,
        tenantId: principal.tenantId,
        principalId: principal.principalId,
        eventType: eventTypeFor(operation),
        entityId: record.workflowVersionId,
        outcome: "success",
        reasonCode: "transition_applied",
        requestId,
        operation,
      });
      await dependencies.repository.completeIdempotency(client, {
        ...scope,
        responseStatus: status,
        responseBody: serialized,
        auditId,
        completedAt: createdAt,
      });
      return { status, body: response };
    });
    if (invalidReplay || !result) {
      throw new WorkflowApiError(500, "internal_error", "Invalid replay state", true);
    }
    return result;
  } catch (error) {
    if (claimedNew) {
      try {
        await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
          await dependencies.repository.releaseIdempotency(client, scope);
        });
      } catch {
        // Preserve the original non-leaking error.
      }
    }
    throw error;
  }
};

const persistErrorAudit = async (
  dependencies: WorkflowLifecycleApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: string,
  error: WorkflowApiError
): Promise<WorkflowApiError> => {
  const auditId = error.auditId ?? dependencies.createUuid();
  try {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
      await dependencies.repository.recordAudit(client, {
        auditId,
        tenantId: principal.tenantId,
        principalId: principal.principalId,
        eventType: error.statusCode >= 500
          ? "rag.workflow.request_failed"
          : "rag.workflow.request_rejected",
        entityId: null,
        outcome: error.statusCode >= 500 ? "error" : "blocked",
        reasonCode: error.code,
        requestId,
        operation,
      });
    });
    return new WorkflowApiError(
      error.statusCode,
      error.code,
      error.message,
      error.retryable,
      auditId,
      error.retryAfterSeconds
    );
  } catch {
    return new WorkflowApiError(
      500,
      "internal_error",
      "Unexpected server error",
      true,
      dependencies.createUuid()
    );
  }
};

const successResponse = (
  status: 200 | 201,
  body: WorkflowVersionResponseV1
): WorkflowHttpResponse => ({
  statusCode: status,
  body: JSON.stringify(body),
  requestId: body.request_id,
});

/** Authentication completes before any request body bytes are parsed. */
export const handleWorkflowLifecycleV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: WorkflowLifecycleApiDependencies
): Promise<boolean> => {
  const kind = routeKind(url.pathname);
  if (!kind) return false;

  const headerRequestId = requestIdFromHeader(req, dependencies.createUuid);
  let principal: AuthenticatedPrincipal;
  try {
    principal = await authenticateBearer(req.headers.authorization, dependencies.identityRepository);
  } catch (error) {
    let auditId = dependencies.createUuid();
    const reasonCode = error instanceof SecurityError
      ? "credential_rejected"
      : "authentication_dependency_failure";
    try {
      auditId = await dependencies.repository.recordAuthenticationFailure(auditId, reasonCode);
    } catch {
      // Authentication remains uniform when the aggregate sink is unavailable.
    }
    req.resume();
    sendResponse(res, {
      statusCode: 401,
      body: await errorBody(
        dependencies,
        new WorkflowApiError(401, "unauthorized", "Authentication required", false, auditId),
        {
          tenantId: null,
          credentialId: null,
          requestId: headerRequestId.requestId,
          auditId,
        }
      ),
      requestId: headerRequestId.requestId,
      wwwAuthenticate: true,
      closeConnection: true,
    });
    return true;
  }

  const operation = rateOperation(kind);
  try {
    requireCoarsePermission(principal, kind);
    if (!headerRequestId.valid) {
      throw new WorkflowApiError(400, "invalid_request", "X-Request-Id must be a UUID");
    }
    if (kind === "get" && req.method !== "GET") {
      throw new WorkflowApiError(400, "invalid_request", "Only GET is supported");
    }
    if (kind !== "get" && req.method !== "POST") {
      throw new WorkflowApiError(400, "invalid_request", "Only POST is supported");
    }
    if (kind === "get" && requestMayHaveUnreadBody(req)) {
      throw new WorkflowApiError(400, "invalid_request", "GET request body is not allowed");
    }

    const blockedAuditId = dependencies.createUuid();
    const rate = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
      dependencies.repository.consumeRateLimit(client, {
        tenantId: principal.tenantId,
        principalId: principal.principalId,
        operation,
        limit: dependencies.rateLimit,
        windowSeconds: dependencies.rateWindowSeconds,
        now: dependencies.now().toISOString(),
        blockedAuditId,
      })
    );
    if (!rate.allowed) {
      throw new WorkflowApiError(
        429,
        "rate_limit_exceeded",
        "Rate limit exceeded",
        true,
        blockedAuditId,
        rate.retryAfterSeconds
      );
    }

    if (kind === "get") {
      const workflowVersionId = url.pathname.slice(WORKFLOWS_ROUTE_PREFIX.length);
      if (!isCanonicalUuid(workflowVersionId) || workflowVersionId.includes("/")) {
        throw new WorkflowApiError(400, "invalid_request", "Workflow version id must be a UUID");
      }
      const record = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
        dependencies.repository.get(client, principal.tenantId, workflowVersionId)
      );
      if (!record) throw new WorkflowApiError(404, "not_found", "Workflow not found");

      const auditId = dependencies.createUuid();
      const createdAt = dependencies.now().toISOString();
      const response = responseFor(
        record,
        headerRequestId.requestId,
        principal.credentialId,
        auditId,
        createdAt
      );
      const validators = await dependencies.validators;
      if (!validators.workflowVersion(response)) {
        throw new WorkflowApiError(500, "internal_error", "Workflow response validation failed", true);
      }
      await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
        dependencies.repository.recordAudit(client, {
          auditId,
          tenantId: principal.tenantId,
          principalId: principal.principalId,
          eventType: "rag.workflow.read",
          entityId: record.workflowVersionId,
          outcome: "success",
          reasonCode: "workflow_read",
          requestId: headerRequestId.requestId,
          operation: "workflow_read_v1",
        })
      );
      sendResponse(res, successResponse(200, response));
      return true;
    }

    const idempotencyKey = singleHeader(req.headers["idempotency-key"]);
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new WorkflowApiError(400, "invalid_request", "Invalid Idempotency-Key");
    }
    if (!contentTypeIsJson(req)) {
      throw new WorkflowApiError(400, "invalid_request", "Content-Type must be application/json");
    }

    let parsed: unknown;
    try {
      parsed = await readJsonBody<unknown>(req, MAX_WORKFLOW_REQUEST_BYTES);
    } catch (error) {
      if (error instanceof HttpError) {
        throw new WorkflowApiError(400, "invalid_request", "Request body must be valid JSON");
      }
      throw error;
    }

    const result = await executeMutation(
      kind,
      parsed,
      principal,
      headerRequestId.requestId,
      idempotencyKey,
      dependencies
    );
    sendResponse(res, successResponse(result.status, result.body));
    return true;
  } catch (error) {
    req.resume();
    const normalized = normalizeError(error);
    const audited = await persistErrorAudit(
      dependencies,
      principal,
      headerRequestId.requestId,
      operation,
      normalized
    );
    const auditId = audited.auditId ?? dependencies.createUuid();
    sendResponse(res, {
      statusCode: audited.statusCode,
      body: await errorBody(dependencies, audited, {
        tenantId: principal.tenantId,
        credentialId: principal.credentialId,
        requestId: headerRequestId.requestId,
        auditId,
      }),
      requestId: headerRequestId.requestId,
      ...(audited.retryAfterSeconds
        ? { retryAfterSeconds: audited.retryAfterSeconds }
        : {}),
      closeConnection:
        audited.statusCode === 400 ||
        audited.statusCode === 403 ||
        audited.statusCode === 429,
    });
    return true;
  }
};
