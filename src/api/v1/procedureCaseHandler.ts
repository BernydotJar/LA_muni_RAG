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
} from "../../security/index.js";
import {
  ApiV1Error,
  buildApiError,
  forbiddenError,
  internalError,
  serializeValidatedApiError,
  unauthorizedError,
} from "./errors.js";
import {
  PROCEDURE_CASES_ROUTE,
  PROCEDURE_CASES_ROUTE_PREFIX,
  ProcedureCaseError,
  type ProcedureCaseApiDependencies,
  type ProcedureCaseAuditInput,
  type ProcedureCaseCreateRequestV1,
  type ProcedureCaseIdempotencyScope,
  type ProcedureCaseRequestV1,
  type ProcedureCaseResponseV1,
  type ProcedureCaseUpdateRequestV1,
  type StoredProcedureCase,
} from "./procedureCaseTypes.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';
const MAX_CASE_REQUEST_BYTES = 512 * 1024;

type RouteKind = "create" | "read" | "update";
type CaseOperation = ProcedureCaseAuditInput["operation"];
type CaseStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;

interface CaseHttpResponse {
  statusCode: CaseStatus | 200 | 201;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
  closeConnection?: boolean;
}

class CaseApiError extends Error {
  constructor(
    public readonly statusCode: CaseStatus,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly auditId?: string,
    public readonly retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "CaseApiError";
  }
}

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

const requestIdFromHeader = (
  req: IncomingMessage,
  createUuid: () => string
): { requestId: string; valid: boolean } => {
  const value = singleHeader(req.headers["x-request-id"]);
  return isCanonicalUuid(value)
    ? { requestId: value.toLowerCase(), valid: true }
    : { requestId: createUuid(), valid: false };
};

const routeKind = (req: IncomingMessage, pathname: string): RouteKind | null => {
  if (pathname === PROCEDURE_CASES_ROUTE) return req.method === "POST" ? "create" : null;
  if (!pathname.startsWith(PROCEDURE_CASES_ROUTE_PREFIX)) return null;
  if (req.method === "GET") return "read";
  if (req.method === "PATCH") return "update";
  return null;
};

const operationFor = (kind: RouteKind): CaseOperation => {
  if (kind === "create") return "procedure_case_create_v1";
  if (kind === "update") return "procedure_case_update_v1";
  return "procedure_case_read_v1";
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

const sendResponse = (res: ServerResponse, response: CaseHttpResponse): void => {
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

const apiErrorFor = (error: CaseApiError): ApiV1Error => {
  if (error.code === "unauthorized") return unauthorizedError();
  if (error.code === "forbidden") return forbiddenError();
  if (error.code === "internal_error") return internalError();
  const messages: Record<string, string> = {
    invalid_request: "Request validation failed",
    not_found: "Resource not found",
    workflow_not_approved: "An approved workflow version is required",
    case_conflict: "Procedure case already exists",
    revision_conflict: "Procedure case revision conflict",
    invalid_transition: "Procedure case transition is not allowed",
    idempotency_conflict: "Idempotency-Key was already used with a different request",
    request_in_progress: "An identical request with this Idempotency-Key is still in progress",
    rate_limit_exceeded: "Rate limit exceeded",
  };
  return new ApiV1Error(
    error.statusCode,
    error.code,
    messages[error.code] ?? "Unexpected server error",
    [],
    error.retryable
  );
};

const errorBody = async (
  dependencies: ProcedureCaseApiDependencies,
  error: CaseApiError,
  context: {
    tenantId: string | null;
    credentialId: string | null;
    requestId: string;
    auditId: string;
  }
): Promise<string> => {
  const identity = { ...context, createdAt: dependencies.now().toISOString() };
  try {
    const validators = await dependencies.validators;
    return serializeValidatedApiError(apiErrorFor(error), identity, validators);
  } catch {
    return JSON.stringify(buildApiError(apiErrorFor(error), identity));
  }
};

const normalizeError = (error: unknown): CaseApiError => {
  if (error instanceof CaseApiError) return error;
  if (error instanceof ProcedureCaseError) {
    if (error.code === "workflow_not_approved" || error.code === "case_conflict") {
      return new CaseApiError(409, error.code, error.message);
    }
    if (
      error.code === "case_not_found" ||
      error.code === "step_not_found" ||
      error.code === "document_not_found" ||
      error.code === "blocker_not_found"
    ) {
      return new CaseApiError(404, "not_found", "Resource not found");
    }
    return new CaseApiError(409, error.code, error.message);
  }
  if (error instanceof SecurityError) {
    return error.statusCode === 401
      ? new CaseApiError(401, "unauthorized", "Authentication required")
      : new CaseApiError(403, "forbidden", "Access denied");
  }
  if (error instanceof HttpError) {
    return new CaseApiError(400, "invalid_request", "Request validation failed");
  }
  return new CaseApiError(500, "internal_error", "Unexpected server error", true);
};

const responseFor = (
  record: StoredProcedureCase,
  requestId: string,
  credentialId: string,
  auditId: string,
  createdAt: string
): ProcedureCaseResponseV1 => ({
  schema_version: "v1",
  response_type: "procedure_case",
  request_id: requestId,
  tenant_id: record.tenantId,
  case: {
    case_id: record.caseId,
    case_key: record.caseKey,
    workflow_version_id: record.workflowVersionId,
    workflow_version_number: record.workflowVersionNumber,
    jurisdiction: record.jurisdiction,
    subject_reference: record.subjectReference,
    community_reference: record.communityReference,
    status: record.status,
    validation_state: record.validationState,
    current_step_id: record.currentStepId,
    follow_up_at: record.followUpAt,
    operational_note: record.operationalNote,
    revision: record.revision,
    created_by_principal_id: record.createdByPrincipalId,
    updated_by_principal_id: record.updatedByPrincipalId,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    steps: record.steps.map((step) => ({
      step_id: step.stepId,
      title: step.title,
      ordinal: step.ordinal,
      state: step.state,
      updated_by_principal_id: step.updatedByPrincipalId,
      updated_at: step.updatedAt,
    })),
    documents: record.documents.map((document) => ({
      document_reference_id: document.documentReferenceId,
      requirement_id: document.requirementId,
      document_version_id: document.documentVersionId,
      state: document.state,
      note: document.note,
      updated_by_principal_id: document.updatedByPrincipalId,
      created_at: document.createdAt,
      updated_at: document.updatedAt,
    })),
    blockers: record.blockers.map((blocker) => ({
      blocker_id: blocker.blockerId,
      blocker_code: blocker.blockerCode,
      description: blocker.description,
      resolved_at: blocker.resolvedAt,
      resolved_by_principal_id: blocker.resolvedByPrincipalId,
      created_by_principal_id: blocker.createdByPrincipalId,
      created_at: blocker.createdAt,
    })),
    audit_trail: record.events.map((event) => ({
      event_id: event.eventId,
      actor_principal_id: event.actorPrincipalId,
      event_type: event.eventType,
      revision: event.revision,
      details: structuredClone(event.details),
      created_at: event.createdAt,
    })),
  },
  limitations: [
    "Operational case tracking does not prove legal compliance, municipal approval, reception, liquidation, payment, or institutional closure.",
    "Document states describe references recorded in this system and require human validation against the authoritative source.",
    "A workflow approval is a governance decision about a version; it does not prove applicability to every case fact.",
  ],
  provenance: { credential_id: credentialId, audit_id: auditId, created_at: createdAt },
});

const auditInput = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  operation: CaseOperation,
  eventType: string,
  outcome: ProcedureCaseAuditInput["outcome"],
  reasonCode: string,
  entityId: string | null
): ProcedureCaseAuditInput => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  eventType,
  entityId,
  outcome,
  reasonCode,
  operation,
});

const persistErrorAudit = async (
  dependencies: ProcedureCaseApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: CaseOperation,
  error: CaseApiError
): Promise<CaseApiError> => {
  const auditId = error.auditId ?? dependencies.createUuid();
  try {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
      dependencies.repository.recordAudit(
        client,
        auditInput(
          principal,
          requestId,
          auditId,
          operation,
          "rag.procedure_case.request_rejected",
          error.statusCode === 429 || error.statusCode === 403 ? "blocked" : "error",
          error.code,
          null
        )
      )
    );
    return new CaseApiError(
      error.statusCode,
      error.code,
      error.message,
      error.retryable,
      auditId,
      error.retryAfterSeconds
    );
  } catch {
    return new CaseApiError(500, "internal_error", "Unexpected server error", true, dependencies.createUuid());
  }
};

const requireCoarsePermission = (
  principal: AuthenticatedPrincipal,
  kind: RouteKind
): void => {
  if (kind === "read") return requirePermission(principal, "case:read");
  if (kind === "create") return requirePermission(principal, "case:write");
  if (!hasPermission(principal, "case:write") && !hasPermission(principal, "procedure:review")) {
    throw new SecurityError(403, "forbidden", "Access denied");
  }
};

const requireActionPermission = (
  principal: AuthenticatedPrincipal,
  request: ProcedureCaseRequestV1
): void => {
  if (request.operation === "create") return requirePermission(principal, "case:write");
  if (request.action.type === "set_validation_state") {
    return requirePermission(principal, "procedure:review");
  }
  return requirePermission(principal, "case:write");
};

const requireRequestIdentity = (
  body: ProcedureCaseRequestV1,
  requestId: string,
  principal: AuthenticatedPrincipal
): void => {
  if (!tenantIdsEqual(body.request_id, requestId)) {
    throw new CaseApiError(400, "invalid_request", "Request identity mismatch");
  }
  try {
    requireTenantMatch(principal, body.tenant_id);
    if (!tenantIdsEqual(body.provenance.credential_id, principal.credentialId)) {
      throw new SecurityError(403, "forbidden", "Access denied");
    }
  } catch {
    throw new CaseApiError(403, "forbidden", "Access denied");
  }
};

const idempotencyScope = (
  dependencies: ProcedureCaseApiDependencies,
  principal: AuthenticatedPrincipal,
  operation: "procedure_case_create_v1" | "procedure_case_update_v1",
  key: string,
  request: ProcedureCaseRequestV1
): ProcedureCaseIdempotencyScope => {
  const now = dependencies.now();
  return {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    operation,
    idempotencyKeySha256: sha256(key),
    requestSha256: sha256(canonicalJson(request)),
    now: now.toISOString(),
    expiresAt: new Date(now.getTime() + dependencies.idempotencyTtlSeconds * 1000).toISOString(),
  };
};

const replayResponse = async (
  dependencies: ProcedureCaseApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  scope: ProcedureCaseIdempotencyScope,
  responseStatus: 200 | 201,
  responseBody: string,
  auditId: string
): Promise<{ status: 200 | 201; body: string }> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseBody);
  } catch {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
      dependencies.repository.invalidateCompletedIdempotency(client, scope)
    );
    throw new CaseApiError(500, "internal_error", "Stored replay is invalid", true);
  }
  const validators = await dependencies.validators;
  const body = parsed as Partial<ProcedureCaseResponseV1>;
  if (
    !validators.response(parsed) ||
    body.tenant_id !== principal.tenantId ||
    body.request_id !== requestId ||
    body.provenance?.credential_id !== principal.credentialId ||
    body.provenance?.audit_id !== auditId
  ) {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
      dependencies.repository.invalidateCompletedIdempotency(client, scope)
    );
    throw new CaseApiError(500, "internal_error", "Stored replay is invalid", true);
  }
  return { status: responseStatus, body: responseBody };
};

const executeMutation = async (
  kind: "create" | "update",
  request: ProcedureCaseRequestV1,
  principal: AuthenticatedPrincipal,
  requestId: string,
  idempotencyKey: string,
  pathCaseId: string | null,
  dependencies: ProcedureCaseApiDependencies
): Promise<{ status: 200 | 201; body: string }> => {
  const operation = kind === "create" ? "procedure_case_create_v1" : "procedure_case_update_v1";
  const scope = idempotencyScope(dependencies, principal, operation, idempotencyKey, request);
  return withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const claim = await dependencies.repository.claimIdempotency(client, scope);
    if (claim.kind === "conflict") {
      throw new CaseApiError(409, "idempotency_conflict", "Idempotency conflict");
    }
    if (claim.kind === "processing") {
      throw new CaseApiError(409, "request_in_progress", "Request in progress", true);
    }
    if (claim.kind === "replay") {
      return replayResponse(
        dependencies,
        principal,
        requestId,
        scope,
        claim.responseStatus,
        claim.responseBody,
        claim.auditId
      );
    }

    try {
      const now = dependencies.now().toISOString();
      const auditId = dependencies.createUuid();
      let record: StoredProcedureCase;
      let status: 200 | 201;
      let reasonCode: string;
      let eventType: string;
      if (kind === "create") {
        const creation = await dependencies.repository.create(client, {
          caseId: dependencies.createUuid(),
          eventId: dependencies.createUuid(),
          request: request as ProcedureCaseCreateRequestV1,
          principal,
          now,
          requestSha256: scope.requestSha256,
        });
        if (creation.kind === "replay") {
          return replayResponse(
            dependencies,
            principal,
            requestId,
            scope,
            creation.responseStatus,
            creation.responseBody,
            creation.auditId
          );
        }
        record = creation.record;
        status = 201;
        reasonCode = "procedure_case_created";
        eventType = "rag.procedure_case.created";
      } else {
        const update = request as ProcedureCaseUpdateRequestV1;
        if (!pathCaseId || !tenantIdsEqual(update.case_id, pathCaseId)) {
          throw new CaseApiError(400, "invalid_request", "Case path identity mismatch");
        }
        const current = await dependencies.repository.get(
          client,
          principal.tenantId,
          update.case_id,
          true
        );
        if (!current) throw new ProcedureCaseError("case_not_found", "Procedure case not found");
        record = await dependencies.repository.applyAction(client, current, {
          request: update,
          principal,
          eventId: dependencies.createUuid(),
          entityId: dependencies.createUuid(),
          now,
        });
        status = 200;
        reasonCode = `procedure_case_${update.action.type}`;
        eventType = `rag.procedure_case.${update.action.type}`;
      }
      const response = responseFor(record, requestId, principal.credentialId, auditId, now);
      const validators = await dependencies.validators;
      if (!validators.response(response)) {
        throw new Error("Generated ProcedureCase response failed the canonical v1 contract");
      }
      const body = JSON.stringify(response);
      if (kind === "create") {
        await dependencies.repository.sealCreation(client, {
          tenantId: principal.tenantId,
          caseId: record.caseId,
          principalId: principal.principalId,
          requestSha256: scope.requestSha256,
          responseBody: body,
          auditId,
        });
      }
      await dependencies.repository.recordAudit(
        client,
        auditInput(
          principal,
          requestId,
          auditId,
          operation,
          eventType,
          "success",
          reasonCode,
          record.caseId
        )
      );
      await dependencies.repository.completeIdempotency(client, {
        ...scope,
        responseStatus: status,
        responseBody: body,
        auditId,
        completedAt: now,
      });
      return { status, body };
    } catch (error) {
      await dependencies.repository.releaseIdempotency(client, scope);
      throw error;
    }
  });
};

export const handleProcedureCaseV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: ProcedureCaseApiDependencies
): Promise<boolean> => {
  const kind = routeKind(req, url.pathname);
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
      // Keep the tenantless response uniform when the bounded sink is unavailable.
    }
    req.resume();
    sendResponse(res, {
      statusCode: 401,
      body: await errorBody(
        dependencies,
        new CaseApiError(401, "unauthorized", "Authentication required"),
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

  const operation = operationFor(kind);
  try {
    requireCoarsePermission(principal, kind);
    if (!headerRequestId.valid) {
      throw new CaseApiError(400, "invalid_request", "X-Request-Id must be a UUID");
    }
    if (kind === "read" && requestMayHaveUnreadBody(req)) {
      throw new CaseApiError(400, "invalid_request", "GET request body is not allowed");
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
      throw new CaseApiError(
        429,
        "rate_limit_exceeded",
        "Rate limit exceeded",
        true,
        blockedAuditId,
        rate.retryAfterSeconds
      );
    }

    const pathCaseId = url.pathname.startsWith(PROCEDURE_CASES_ROUTE_PREFIX)
      ? url.pathname.slice(PROCEDURE_CASES_ROUTE_PREFIX.length)
      : null;
    if (pathCaseId && (!isCanonicalUuid(pathCaseId) || pathCaseId.includes("/"))) {
      throw new CaseApiError(400, "invalid_request", "Case id must be a UUID");
    }

    if (kind === "read") {
      const record = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
        dependencies.repository.get(client, principal.tenantId, pathCaseId!)
      );
      if (!record) throw new CaseApiError(404, "not_found", "Resource not found");
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
      if (!validators.response(response)) {
        throw new CaseApiError(500, "internal_error", "Case response validation failed", true);
      }
      await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
        dependencies.repository.recordAudit(
          client,
          auditInput(
            principal,
            headerRequestId.requestId,
            auditId,
            operation,
            "rag.procedure_case.read",
            "success",
            "procedure_case_read",
            record.caseId
          )
        )
      );
      sendResponse(res, {
        statusCode: 200,
        body: JSON.stringify(response),
        requestId: headerRequestId.requestId,
      });
      return true;
    }

    const idempotencyKey = singleHeader(req.headers["idempotency-key"]);
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new CaseApiError(400, "invalid_request", "Invalid Idempotency-Key");
    }
    if (!contentTypeIsJson(req)) {
      throw new CaseApiError(400, "invalid_request", "Content-Type must be application/json");
    }
    let parsed: unknown;
    try {
      parsed = await readJsonBody<unknown>(req, MAX_CASE_REQUEST_BYTES);
    } catch (error) {
      if (error instanceof HttpError) {
        throw new CaseApiError(400, "invalid_request", "Request body must be valid JSON");
      }
      throw error;
    }
    const validators = await dependencies.validators;
    if (!validators.request(parsed)) {
      throw new CaseApiError(400, "invalid_request", "Request validation failed");
    }
    const request = parsed as ProcedureCaseRequestV1;
    if ((kind === "create" && request.operation !== "create") ||
        (kind === "update" && request.operation !== "update")) {
      throw new CaseApiError(400, "invalid_request", "Request operation does not match route");
    }
    requireRequestIdentity(request, headerRequestId.requestId, principal);
    requireActionPermission(principal, request);
    const result = await executeMutation(
      kind,
      request,
      principal,
      headerRequestId.requestId,
      idempotencyKey,
      pathCaseId,
      dependencies
    );
    sendResponse(res, {
      statusCode: result.status,
      body: result.body,
      requestId: headerRequestId.requestId,
    });
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
      ...(audited.retryAfterSeconds ? { retryAfterSeconds: audited.retryAfterSeconds } : {}),
      closeConnection:
        audited.statusCode === 400 ||
        audited.statusCode === 403 ||
        audited.statusCode === 429,
    });
    return true;
  }
};
