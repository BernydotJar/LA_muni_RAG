import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, readJsonBody, requestUrl } from "../../http.js";
import { canonicalPipelineConfig } from "../../ingestion/jobIdentity.js";
import {
  IngestionJobError,
  type DurableIngestionJob,
  type EnqueueIngestionJobResult,
} from "../../ingestion/jobTypes.js";
import {
  authenticateBearer,
  isCanonicalUuid,
  requirePermission,
  requireTenantMatch,
  SecurityError,
  tenantIdsEqual,
  withTenantTransaction,
  type AuthenticatedPrincipal,
} from "../../security/index.js";
import { validationDetails } from "./contracts.js";
import {
  ApiV1Error,
  buildApiError,
  forbiddenError,
  internalError,
  notFoundError,
  serializeValidatedApiError,
  unauthorizedError,
} from "./errors.js";
import {
  INGESTION_JOB_ENQUEUE_OPERATION,
  INGESTION_JOB_GET_OPERATION,
  INGESTION_JOBS_ROUTE,
  INGESTION_PIPELINE_PROFILE,
  type IngestionApiAuditRecord,
  type IngestionApiHttpResponse,
  type IngestionApiOperation,
  type IngestionJobApiDependencies,
  type IngestionJobRequestV1,
  type IngestionJobResponseResult,
  type IngestionJobResponseV1,
} from "./ingestionTypes.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';

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

const contentTypeIsJson = (req: IncomingMessage): boolean => {
  const value = singleHeader(req.headers["content-type"]);
  return Boolean(value && /^application\/json(?:\s*;|$)/i.test(value));
};

const sendResponse = (res: ServerResponse, response: IngestionApiHttpResponse): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(response.body),
    "cache-control": "no-store",
    "x-request-id": response.requestId,
  };
  if (response.wwwAuthenticate) headers["www-authenticate"] = WWW_AUTHENTICATE;
  if (response.retryAfterSeconds) headers["retry-after"] = response.retryAfterSeconds;
  res.writeHead(response.statusCode, headers);
  res.end(response.body);
};

const errorBody = async (
  dependencies: IngestionJobApiDependencies,
  error: ApiV1Error,
  context: {
    tenantId: string | null;
    credentialId: string | null;
    requestId: string;
    auditId: string;
  }
): Promise<string> => {
  const errorContext = { ...context, createdAt: dependencies.now().toISOString() };
  try {
    const validators = await dependencies.validators;
    return serializeValidatedApiError(error, errorContext, validators);
  } catch {
    return JSON.stringify(buildApiError(error, errorContext));
  }
};

const requestInputError = (code: string, message: string, field: string): ApiV1Error =>
  new ApiV1Error(400, code, message, [{ field, issue: message }]);

const auditRecord = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  operation: IngestionApiOperation,
  eventType: string,
  outcome: IngestionApiAuditRecord["outcome"],
  reasonCode: string,
  jobId?: string
): IngestionApiAuditRecord => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  operation,
  eventType,
  outcome,
  reasonCode,
  ...(jobId ? { jobId } : {}),
});

const recordDecision = async (
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  record: IngestionApiAuditRecord
): Promise<void> => {
  await withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => dependencies.persistence.recordAudit(client, record)
  );
};

const knownErrorResponse = async (
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: IngestionApiOperation,
  error: ApiV1Error,
  event: {
    eventType: string;
    outcome: IngestionApiAuditRecord["outcome"];
    reasonCode: string;
    jobId?: string;
  }
): Promise<IngestionApiHttpResponse> => {
  const auditId = dependencies.createUuid();
  try {
    await recordDecision(
      dependencies,
      principal,
      auditRecord(
        principal,
        requestId,
        auditId,
        operation,
        event.eventType,
        event.outcome,
        event.reasonCode,
        event.jobId
      )
    );
    return {
      statusCode: error.statusCode,
      body: await errorBody(dependencies, error, {
        tenantId: principal.tenantId,
        credentialId: principal.credentialId,
        requestId,
        auditId,
      }),
      requestId,
      ...(error.statusCode === 429 ? { retryAfterSeconds: 1 } : {}),
    };
  } catch {
    const fallbackAuditId = dependencies.createUuid();
    return {
      statusCode: 500,
      body: await errorBody(dependencies, internalError(), {
        tenantId: principal.tenantId,
        credentialId: principal.credentialId,
        requestId,
        auditId: fallbackAuditId,
      }),
      requestId,
    };
  }
};

const configuredProfileMatches = (
  dependencies: IngestionJobApiDependencies,
  job: DurableIngestionJob
): boolean => {
  if (!dependencies.pipelineConfig) return false;
  try {
    return canonicalPipelineConfig(job.pipelineConfig) ===
      canonicalPipelineConfig(dependencies.pipelineConfig);
  } catch {
    return false;
  }
};

const responseForJob = (
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  result: IngestionJobResponseResult,
  job: DurableIngestionJob
): IngestionJobResponseV1 => ({
  schema_version: "v1",
  response_type: "ingestion_job",
  tenant_id: principal.tenantId,
  request_id: requestId,
  audit_id: auditId,
  result,
  job: {
    job_id: job.jobId,
    document_version_id: job.documentVersionId,
    pipeline_profile: INGESTION_PIPELINE_PROFILE,
    status: job.status,
    attempt_count: job.attemptCount,
    max_attempts: job.maxAttempts,
    available_at: job.availableAt,
    started_at: job.startedAt,
    finished_at: job.finishedAt,
    lease_expires_at: job.leaseExpiresAt,
    heartbeat_at: job.heartbeatAt,
    last_error_code: job.lastErrorCode,
    last_error_retryable: job.lastErrorRetryable,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  },
  provenance: {
    source_product: "la_muni_rag",
    generated_by: "system",
    created_at: dependencies.now().toISOString(),
    source_refs: [job.documentVersionId, job.jobId],
    credential_id: principal.credentialId,
    audit_id: auditId,
  },
});

const successfulResponse = async (
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: IngestionApiOperation,
  result: IngestionJobResponseResult,
  job: DurableIngestionJob,
  statusCode: 200 | 202,
  eventType: string,
  reasonCode: string
): Promise<IngestionApiHttpResponse> => {
  if (!configuredProfileMatches(dependencies, job)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      new ApiV1Error(503, "capability_unavailable", "Ingestion pipeline is unavailable", [], true),
      {
        eventType: "integration.ingestion_job.failed",
        outcome: "error",
        reasonCode: "pipeline_profile_unavailable",
        jobId: job.jobId,
      }
    );
  }
  const auditId = dependencies.createUuid();
  const body = responseForJob(dependencies, principal, requestId, auditId, result, job);
  const validators = await dependencies.validators;
  if (!validators.response(body)) {
    throw new Error("Generated IngestionJobResponse failed the canonical v1 contract");
  }
  await recordDecision(
    dependencies,
    principal,
    auditRecord(
      principal,
      requestId,
      auditId,
      operation,
      eventType,
      "success",
      reasonCode,
      job.jobId
    )
  );
  return { statusCode, body: JSON.stringify(body), requestId };
};

const authenticatedRateGate = async (
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: IngestionApiOperation
): Promise<IngestionApiHttpResponse | null> =>
  withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const candidateAuditId = dependencies.createUuid();
    const rate = await dependencies.persistence.consumeRateLimit(client, {
      tenantId: principal.tenantId,
      principalId: principal.principalId,
      operation,
      limit: operation === INGESTION_JOB_ENQUEUE_OPERATION
        ? dependencies.enqueueRateLimit
        : dependencies.getRateLimit,
      windowSeconds: dependencies.rateWindowSeconds,
      blockedAuditId: candidateAuditId,
    });
    if (rate.allowed) return null;
    if (!rate.auditId) throw new Error("Denied ingestion rate decision has no audit identity");
    if (rate.shouldAudit) {
      await dependencies.persistence.recordAudit(
        client,
        auditRecord(
          principal,
          requestId,
          rate.auditId,
          operation,
          "integration.ingestion_job.rate_limited",
          "blocked",
          "rate_limit_exceeded"
        )
      );
    }
    const error = new ApiV1Error(429, "rate_limit_exceeded", "Rate limit exceeded", [], true);
    return {
      statusCode: 429,
      body: await errorBody(dependencies, error, {
        tenantId: principal.tenantId,
        credentialId: principal.credentialId,
        requestId,
        auditId: rate.auditId,
      }),
      requestId,
      retryAfterSeconds: rate.retryAfterSeconds,
    };
  });

const operationForRequest = (req: IncomingMessage): IngestionApiOperation =>
  req.method === "GET" ? INGESTION_JOB_GET_OPERATION : INGESTION_JOB_ENQUEUE_OPERATION;

const jobIdFromPath = (req: IncomingMessage): string | null => {
  const pathname = requestUrl(req).pathname;
  const match = /^\/api\/v1\/ingestion-jobs\/([^/]+)$/.exec(pathname);
  return match?.[1] ?? null;
};

const capabilityUnavailable = (): ApiV1Error =>
  new ApiV1Error(
    503,
    "capability_unavailable",
    "The configured ingestion pipeline is unavailable",
    [],
    true
  );

const mapJobError = (error: IngestionJobError): ApiV1Error => {
  if (error.code === "ingestion_artifact_identity_mismatch") {
    return new ApiV1Error(
      409,
      "document_version_conflict",
      "Document version is unavailable or does not match the accepted artifact identity"
    );
  }
  // The public schema and server-owned pipeline policy validate all client
  // fields before the durable service runs. Persistence/configuration
  // "*_invalid" failures are therefore server faults, not client 400s.
  return internalError();
};

const handlePost = async (
  req: IncomingMessage,
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<IngestionApiHttpResponse> => {
  const operation = INGESTION_JOB_ENQUEUE_OPERATION;
  const idempotencyKey = singleHeader(req.headers["idempotency-key"]);
  if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      requestInputError(
        "invalid_idempotency_key",
        "Idempotency-Key must contain 16 to 128 allowlisted characters",
        "Idempotency-Key"
      ),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_idempotency_key",
      }
    );
  }
  if (!contentTypeIsJson(req)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      requestInputError(
        "unsupported_content_type",
        "Content-Type must be application/json",
        "Content-Type"
      ),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "unsupported_content_type",
      }
    );
  }

  let parsed: unknown;
  try {
    parsed = await readJsonBody<unknown>(req);
  } catch (error) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      requestInputError("invalid_request", "Request body must be valid JSON", "/"),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode:
          error instanceof HttpError && error.code === "body_too_large"
            ? "body_too_large"
            : "invalid_json",
      }
    );
  }

  const validators = await dependencies.validators.catch(() => null);
  if (!validators) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      internalError(),
      {
        eventType: "integration.ingestion_job.failed",
        outcome: "error",
        reasonCode: "contract_registry_unavailable",
      }
    );
  }
  if (!validators.request(parsed)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      new ApiV1Error(
        400,
        "invalid_request",
        "Request body does not satisfy the v1 contract",
        validationDetails(validators.request.errors)
      ),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "schema_validation_failed",
      }
    );
  }
  const request = parsed as IngestionJobRequestV1;
  if (!tenantIdsEqual(request.request_id, requestId)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      requestInputError(
        "request_id_mismatch",
        "X-Request-Id must equal body request_id",
        "/request_id"
      ),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "request_id_mismatch",
      }
    );
  }
  try {
    requireTenantMatch(principal, request.tenant_id);
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      forbiddenError(),
      {
        eventType: "integration.ingestion_job.tenant_access_denied",
        outcome: "blocked",
        reasonCode: "access_denied",
      }
    );
  }
  if (!dependencies.pipelineConfig) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      capabilityUnavailable(),
      {
        eventType: "integration.ingestion_job.capability_unavailable",
        outcome: "blocked",
        reasonCode: "pipeline_unavailable",
      }
    );
  }

  let result: EnqueueIngestionJobResult;
  try {
    result = await dependencies.jobService.enqueue({
      tenantId: principal.tenantId,
      principalId: principal.principalId,
      documentVersionId: request.document_version_id,
      artifactSha256: request.artifact_sha256,
      idempotencyKey,
      pipelineConfig: dependencies.pipelineConfig,
      maxAttempts: dependencies.maxAttempts,
    });
  } catch (error) {
    const apiError = error instanceof IngestionJobError ? mapJobError(error) : internalError();
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      apiError,
      {
        eventType: "integration.ingestion_job.enqueue_failed",
        outcome: apiError.statusCode >= 500 ? "error" : "blocked",
        reasonCode:
          apiError.code === "document_version_conflict"
            ? "document_version_conflict"
            : apiError.statusCode >= 500
              ? "runtime_dependency_failure"
              : "invalid_request",
      }
    );
  }
  if (result.kind === "conflict") {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      new ApiV1Error(
        409,
        "idempotency_conflict",
        "Idempotency-Key was already used with a different request"
      ),
      {
        eventType: "integration.ingestion_job.idempotency_conflict",
        outcome: "blocked",
        reasonCode: "idempotency_conflict",
      }
    );
  }
  return successfulResponse(
    dependencies,
    principal,
    requestId,
    operation,
    result.kind,
    result.job,
    result.kind === "replay" ? 200 : 202,
    result.kind === "replay"
      ? "integration.ingestion_job.replayed"
      : result.kind === "duplicate_work"
        ? "integration.ingestion_job.deduplicated"
        : "integration.ingestion_job.enqueued",
    result.kind === "replay"
      ? "idempotent_replay"
      : result.kind === "duplicate_work"
        ? "duplicate_work"
        : "job_enqueued"
  );
};

const handleGet = async (
  req: IncomingMessage,
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<IngestionApiHttpResponse> => {
  const operation = INGESTION_JOB_GET_OPERATION;
  const jobId = jobIdFromPath(req);
  if (!isCanonicalUuid(jobId)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      requestInputError("invalid_job_id", "job_id must be a UUID", "job_id"),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_job_id",
      }
    );
  }
  let job: DurableIngestionJob | null;
  try {
    job = await dependencies.jobService.get(principal.tenantId, jobId);
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      internalError(),
      {
        eventType: "integration.ingestion_job.get_failed",
        outcome: "error",
        reasonCode: "runtime_dependency_failure",
        jobId,
      }
    );
  }
  if (!job || !configuredProfileMatches(dependencies, job)) {
    return knownErrorResponse(
      dependencies,
      principal,
      requestId,
      operation,
      notFoundError(),
      {
        eventType: "integration.ingestion_job.not_found",
        outcome: "blocked",
        reasonCode: "not_found",
      }
    );
  }
  return successfulResponse(
    dependencies,
    principal,
    requestId,
    operation,
    "status",
    job,
    200,
    "integration.ingestion_job.status_read",
    "status_read"
  );
};

const handleAuthenticated = async (
  req: IncomingMessage,
  dependencies: IngestionJobApiDependencies,
  principal: AuthenticatedPrincipal,
  headerRequestId: { requestId: string; valid: boolean },
  operation: IngestionApiOperation
): Promise<IngestionApiHttpResponse> => {
  try {
    requirePermission(principal, "document:ingest");
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      operation,
      forbiddenError(),
      {
        eventType: "integration.ingestion_job.authorization_denied",
        outcome: "blocked",
        reasonCode: "permission_denied",
      }
    );
  }
  if (!headerRequestId.valid) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      operation,
      requestInputError("invalid_request_id", "X-Request-Id must be a UUID", "X-Request-Id"),
      {
        eventType: "integration.ingestion_job.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_request_id",
      }
    );
  }

  const pathname = requestUrl(req).pathname;
  if (req.method === "POST" && pathname === INGESTION_JOBS_ROUTE) {
    return handlePost(req, dependencies, principal, headerRequestId.requestId);
  }
  if (req.method === "GET" && pathname.startsWith(`${INGESTION_JOBS_ROUTE}/`)) {
    return handleGet(req, dependencies, principal, headerRequestId.requestId);
  }
  return knownErrorResponse(
    dependencies,
    principal,
    headerRequestId.requestId,
    operation,
    requestInputError("invalid_method", "Unsupported ingestion job operation", "method"),
    {
      eventType: "integration.ingestion_job.request_rejected",
      outcome: "blocked",
      reasonCode: "invalid_method",
    }
  );
};

/** Authentication and rate limiting complete before any request body bytes are parsed. */
export const handleIngestionJobV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: IngestionJobApiDependencies
): Promise<void> => {
  const headerRequestId = requestIdFromHeader(req, dependencies.createUuid);
  const operation = operationForRequest(req);
  let principal: AuthenticatedPrincipal;
  try {
    principal = await authenticateBearer(req.headers.authorization, dependencies.identityRepository);
  } catch (error) {
    let auditId = dependencies.createUuid();
    const reasonCode = error instanceof SecurityError
      ? "credential_rejected"
      : "authentication_dependency_failure";
    try {
      const recorded = await dependencies.authenticationFailureRecorder.recordAuthenticationFailure({
        auditId,
        requestId: headerRequestId.requestId,
        reasonCode,
      });
      if (isCanonicalUuid(recorded.auditId)) auditId = recorded.auditId.toLowerCase();
    } catch {
      // The response remains uniform if the sanitized tenantless sink is unavailable.
    }
    sendResponse(res, {
      statusCode: 401,
      body: await errorBody(dependencies, unauthorizedError(), {
        tenantId: null,
        credentialId: null,
        requestId: headerRequestId.requestId,
        auditId,
      }),
      requestId: headerRequestId.requestId,
      wwwAuthenticate: true,
    });
    return;
  }

  try {
    const rateResponse = await authenticatedRateGate(
      dependencies,
      principal,
      headerRequestId.requestId,
      operation
    );
    if (rateResponse) {
      sendResponse(res, rateResponse);
      return;
    }
    const response = await handleAuthenticated(
      req,
      dependencies,
      principal,
      headerRequestId,
      operation
    );
    sendResponse(res, response);
  } catch {
    const response = await knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      operation,
      internalError(),
      {
        eventType: "integration.ingestion_job.failed",
        outcome: "error",
        reasonCode: "runtime_dependency_failure",
      }
    );
    sendResponse(res, response);
  }
};
