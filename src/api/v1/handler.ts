import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError, readJsonBody } from "../../http.js";
import {
  authenticateBearer,
  isCanonicalUuid,
  requirePermission,
  requireTenantMatch,
  SecurityError,
  tenantIdsEqual,
  withTenantTransaction,
  type AuthenticatedPrincipal,
  type TenantTransactionClient,
} from "../../security/index.js";
import { detectProductBoundaryViolation } from "./boundary.js";
import { validationDetails } from "./contracts.js";
import {
  ApiV1Error,
  buildApiError,
  forbiddenError,
  internalError,
  serializeValidatedApiError,
  unauthorizedError,
} from "./errors.js";
import { mapEvidenceBundleV1, mapProcedureWorkflowV1 } from "./mapper.js";
import {
  PROCEDURE_QUERY_OPERATION,
  type IdempotencyScope,
  type ProcedureQueryApiDependencies,
  type ProcedureQueryAuditRecord,
  type ProcedureQueryRequestV1,
  type V1HttpResponse,
} from "./types.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

const sendV1Response = (res: ServerResponse, response: V1HttpResponse): void => {
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

const requestIdFromHeader = (
  req: IncomingMessage,
  createUuid: () => string
): { requestId: string; valid: boolean } => {
  const value = singleHeader(req.headers["x-request-id"]);
  return isCanonicalUuid(value)
    ? { requestId: value.toLowerCase(), valid: true }
    : { requestId: createUuid(), valid: false };
};

const errorBody = async (
  dependencies: ProcedureQueryApiDependencies,
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
    // Preserve a safe, structured response even when the contract registry is
    // unavailable or a validator itself fails. Never substitute raw internals.
    return JSON.stringify(buildApiError(error, errorContext));
  }
};

const auditRecord = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  eventType: string,
  outcome: ProcedureQueryAuditRecord["outcome"],
  reasonCode: string,
  optional: Pick<ProcedureQueryAuditRecord, "requestedOutput" | "idempotencyKeySha256"> = {}
): ProcedureQueryAuditRecord => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  eventType,
  outcome,
  reasonCode,
  ...optional,
});

const recordDecision = async (
  dependencies: ProcedureQueryApiDependencies,
  principal: AuthenticatedPrincipal,
  record: ProcedureQueryAuditRecord
): Promise<void> => {
  await withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => dependencies.persistence.recordAudit(client, record)
  );
};

const knownErrorResponse = async (
  dependencies: ProcedureQueryApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  error: ApiV1Error,
  event: {
    eventType: string;
    outcome: ProcedureQueryAuditRecord["outcome"];
    reasonCode: string;
    requestedOutput?: ProcedureQueryRequestV1["requested_output"];
    idempotencyKeySha256?: string;
  }
): Promise<V1HttpResponse> => {
  const auditId = dependencies.createUuid();
  try {
    await recordDecision(
      dependencies,
      principal,
      auditRecord(
        principal,
        requestId,
        auditId,
        event.eventType,
        event.outcome,
        event.reasonCode,
        {
          ...(event.requestedOutput ? { requestedOutput: event.requestedOutput } : {}),
          ...(event.idempotencyKeySha256
            ? { idempotencyKeySha256: event.idempotencyKeySha256 }
            : {}),
        }
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
    const fallback = internalError();
    return {
      statusCode: 500,
      body: await errorBody(dependencies, fallback, {
        tenantId: principal.tenantId,
        credentialId: principal.credentialId,
        requestId,
        auditId: fallbackAuditId,
      }),
      requestId,
    };
  }
};

const contentTypeIsJson = (req: IncomingMessage): boolean => {
  const value = singleHeader(req.headers["content-type"]);
  return Boolean(value && /^application\/json(?:\s*;|$)/i.test(value));
};

const requestInputError = (code: string, message: string, field: string): ApiV1Error =>
  new ApiV1Error(400, code, message, [{ field, issue: message }]);

const idempotencyError = (kind: "conflict" | "in_progress"): ApiV1Error =>
  kind === "conflict"
    ? new ApiV1Error(
        409,
        "idempotency_conflict",
        "Idempotency-Key was already used with a different request",
        [],
        false
      )
    : new ApiV1Error(
        409,
        "request_in_progress",
        "An identical request with this Idempotency-Key is still in progress",
        [],
        true
      );

const validStoredReplay = async (
  dependencies: ProcedureQueryApiDependencies,
  claim: Extract<Awaited<ReturnType<ProcedureQueryApiDependencies["persistence"]["claimIdempotency"]>>, { kind: "replay" }>,
  principal: AuthenticatedPrincipal,
  request: ProcedureQueryRequestV1
): Promise<boolean> => {
  if (claim.statusCode !== 200 || !isCanonicalUuid(claim.originalAuditId)) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(claim.responseBody) as unknown;
  } catch {
    return false;
  }
  const validators = await dependencies.validators;
  const responseValidator =
    request.requested_output === "evidence_bundle"
      ? validators.evidenceBundle
      : request.requested_output === "procedure_workflow"
        ? validators.workflow
        : null;
  if (!responseValidator || !responseValidator(parsed) || !parsed || typeof parsed !== "object") {
    return false;
  }
  const response = parsed as {
    tenant_id?: unknown;
    request_id?: unknown;
    provenance?: { credential_id?: unknown; audit_id?: unknown };
  };
  return (
    tenantIdsEqual(String(response.tenant_id ?? ""), principal.tenantId) &&
    tenantIdsEqual(String(response.tenant_id ?? ""), request.tenant_id) &&
    tenantIdsEqual(String(response.request_id ?? ""), request.request_id) &&
    tenantIdsEqual(String(response.provenance?.credential_id ?? ""), principal.credentialId) &&
    tenantIdsEqual(String(response.provenance?.audit_id ?? ""), claim.originalAuditId)
  );
};

const executeProcedureQuery = async (
  dependencies: ProcedureQueryApiDependencies,
  principal: AuthenticatedPrincipal,
  request: ProcedureQueryRequestV1,
  idempotencyKeySha256: string,
  requestSha256: string
): Promise<V1HttpResponse> => {
  const scope: IdempotencyScope = {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    operation: PROCEDURE_QUERY_OPERATION,
    idempotencyKeySha256,
    requestSha256,
  };

  try {
    return await withTenantTransaction(
      dependencies.transactionPool,
      principal.tenantId,
      async (client) => {
        const claim = await dependencies.persistence.claimIdempotency(client, scope);
        if (claim.kind === "replay") {
          if (!(await validStoredReplay(dependencies, claim, principal, request))) {
            await dependencies.persistence.invalidateCompletedIdempotency(client, scope);
            const auditId = dependencies.createUuid();
            await dependencies.persistence.recordAudit(
              client,
              auditRecord(
                principal,
                request.request_id,
                auditId,
                "integration.procedure_query.idempotency_corrupt",
                "error",
                "stored_response_invalid",
                { requestedOutput: request.requested_output, idempotencyKeySha256 }
              )
            );
            return {
              statusCode: 500,
              body: await errorBody(dependencies, internalError(), {
                tenantId: principal.tenantId,
                credentialId: principal.credentialId,
                requestId: request.request_id,
                auditId,
              }),
              requestId: request.request_id,
            };
          }
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              dependencies.createUuid(),
              "integration.procedure_query.idempotency_replayed",
              "success",
              "idempotency_replay",
              { requestedOutput: request.requested_output, idempotencyKeySha256 }
            )
          );
          return {
            statusCode: claim.statusCode,
            body: claim.responseBody,
            requestId: request.request_id,
          };
        }

        if (claim.kind === "conflict" || claim.kind === "in_progress") {
          const auditId = dependencies.createUuid();
          const error = idempotencyError(claim.kind);
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              auditId,
              claim.kind === "conflict"
                ? "integration.procedure_query.idempotency_conflict"
                : "integration.procedure_query.idempotency_in_progress",
              "blocked",
              claim.kind === "conflict" ? "idempotency_conflict" : "idempotency_in_progress",
              { requestedOutput: request.requested_output, idempotencyKeySha256 }
            )
          );
          return {
            statusCode: error.statusCode,
            body: await errorBody(dependencies, error, {
              tenantId: principal.tenantId,
              credentialId: principal.credentialId,
              requestId: request.request_id,
              auditId,
            }),
            requestId: request.request_id,
          };
        }

        const auditId = dependencies.createUuid();
        const compiled = await dependencies.compiler(request, client);
        const mappingOptions = {
          request,
          workflow: compiled.workflow,
          evidenceRecords: compiled.evidenceRecords,
          auditId,
          credentialId: principal.credentialId,
          createdAt: dependencies.now().toISOString(),
        };
        const mapped =
          request.requested_output === "evidence_bundle"
            ? mapEvidenceBundleV1(mappingOptions)
            : mapProcedureWorkflowV1(mappingOptions);
        const validators = await dependencies.validators;
        const responseIsValid =
          request.requested_output === "evidence_bundle"
            ? validators.evidenceBundle(mapped)
            : validators.workflow(mapped);
        if (!responseIsValid) {
          throw new Error(
            `Generated ${request.requested_output} failed the canonical v1 contract`
          );
        }
        const body = JSON.stringify(mapped);
        await dependencies.persistence.recordAudit(
          client,
          auditRecord(
            principal,
            request.request_id,
            auditId,
            "integration.procedure_query.succeeded",
            "success",
            request.requested_output === "evidence_bundle"
              ? "evidence_bundle_generated"
              : "workflow_generated",
            { requestedOutput: request.requested_output, idempotencyKeySha256 }
          )
        );
        await dependencies.persistence.completeIdempotency(client, scope, {
          statusCode: 200,
          responseBody: body,
          auditId,
        });
        return { statusCode: 200, body, requestId: request.request_id };
      }
    );
  } catch {
    // The failed transaction has rolled back the claim and any partial success
    // audit. The explicit release keeps non-transactional test adapters honest.
    const failureAuditId = dependencies.createUuid();
    try {
      await withTenantTransaction(
        dependencies.transactionPool,
        principal.tenantId,
        async (client) => {
          await dependencies.persistence.releaseIdempotency(client, scope);
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              failureAuditId,
              "integration.procedure_query.failed",
              "error",
              "execution_failed",
              { requestedOutput: request.requested_output, idempotencyKeySha256 }
            )
          );
        }
      );
      return {
        statusCode: 500,
        body: await errorBody(dependencies, internalError(), {
          tenantId: principal.tenantId,
          credentialId: principal.credentialId,
          requestId: request.request_id,
          auditId: failureAuditId,
        }),
        requestId: request.request_id,
      };
    } catch {
      const fallbackAuditId = dependencies.createUuid();
      return {
        statusCode: 500,
        body: await errorBody(dependencies, internalError(), {
          tenantId: principal.tenantId,
          credentialId: principal.credentialId,
          requestId: request.request_id,
          auditId: fallbackAuditId,
        }),
        requestId: request.request_id,
      };
    }
  }
};

const authenticatedRateGate = async (
  dependencies: ProcedureQueryApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<V1HttpResponse | null> =>
  withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const candidateAuditId = dependencies.createUuid();
    const rate = await dependencies.persistence.consumeRateLimit(client, {
      tenantId: principal.tenantId,
      principalId: principal.principalId,
      operation: PROCEDURE_QUERY_OPERATION,
      limit: dependencies.rateLimit,
      windowSeconds: dependencies.rateWindowSeconds,
      blockedAuditId: candidateAuditId,
    });
    if (rate.allowed) return null;
    if (!rate.auditId) throw new Error("Denied rate decision has no aggregate audit identity");

    if (rate.shouldAudit) {
      await dependencies.persistence.recordAudit(
        client,
        auditRecord(
          principal,
          requestId,
          rate.auditId,
          "integration.procedure_query.rate_limited",
          "blocked",
          "rate_limit_exceeded"
        )
      );
    }
    const error = new ApiV1Error(
      429,
      "rate_limit_exceeded",
      "Rate limit exceeded",
      [],
      true
    );
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

const handleAuthenticatedRequest = async (
  req: IncomingMessage,
  dependencies: ProcedureQueryApiDependencies,
  principal: AuthenticatedPrincipal,
  headerRequestId: { requestId: string; valid: boolean }
): Promise<V1HttpResponse> => {
  try {
    requirePermission(principal, "integration:query");
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      forbiddenError(),
      {
        eventType: "integration.procedure_query.authorization_denied",
        outcome: "blocked",
        reasonCode: "permission_denied",
      }
    );
  }

  if (req.method !== "POST") {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError(
        "invalid_method",
        "Only POST is supported for this endpoint",
        "method"
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_method",
      }
    );
  }

  if (!headerRequestId.valid) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError("invalid_request_id", "X-Request-Id must be a UUID", "X-Request-Id"),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_request_id",
      }
    );
  }

  const idempotencyKey = singleHeader(req.headers["idempotency-key"]);
  if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError(
        "invalid_idempotency_key",
        "Idempotency-Key must contain 16 to 128 allowlisted characters",
        "Idempotency-Key"
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "invalid_idempotency_key",
      }
    );
  }
  const idempotencyKeySha256 = sha256(idempotencyKey);

  if (!contentTypeIsJson(req)) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError(
        "unsupported_content_type",
        "Content-Type must be application/json",
        "Content-Type"
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "unsupported_content_type",
        idempotencyKeySha256,
      }
    );
  }

  let parsed: unknown;
  try {
    parsed = await readJsonBody<unknown>(req);
  } catch (error) {
    const reason = error instanceof HttpError ? error.code : "invalid_json";
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError("invalid_request", "Request body must be valid JSON", "/"),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: reason === "body_too_large" ? "body_too_large" : "invalid_json",
        idempotencyKeySha256,
      }
    );
  }

  const validators = await dependencies.validators.catch(() => null);
  if (!validators) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      internalError(),
      {
        eventType: "integration.procedure_query.failed",
        outcome: "error",
        reasonCode: "contract_registry_unavailable",
        idempotencyKeySha256,
      }
    );
  }
  if (!validators.request(parsed)) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      new ApiV1Error(
        400,
        "invalid_request",
        "Request body does not satisfy the v1 contract",
        validationDetails(validators.request.errors)
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "schema_validation_failed",
        idempotencyKeySha256,
      }
    );
  }
  const request = parsed as ProcedureQueryRequestV1;

  if (!tenantIdsEqual(request.request_id, headerRequestId.requestId)) {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      requestInputError(
        "request_id_mismatch",
        "X-Request-Id must equal body request_id",
        "/request_id"
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "request_id_mismatch",
        requestedOutput: request.requested_output,
        idempotencyKeySha256,
      }
    );
  }
  request.request_id = headerRequestId.requestId;

  try {
    requireTenantMatch(principal, request.tenant_id);
    if (!tenantIdsEqual(principal.credentialId, request.provenance.credential_id)) {
      throw new SecurityError(403, "forbidden", "Access denied");
    }
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      forbiddenError(),
      {
        eventType: "integration.procedure_query.tenant_access_denied",
        outcome: "blocked",
        reasonCode: "access_denied",
        requestedOutput: request.requested_output,
        idempotencyKeySha256,
      }
    );
  }

  if (request.case_context.community_id !== request.community_id) {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      requestInputError(
        "community_id_mismatch",
        "case_context.community_id must equal community_id",
        "/case_context/community_id"
      ),
      {
        eventType: "integration.procedure_query.request_rejected",
        outcome: "blocked",
        reasonCode: "community_id_mismatch",
        requestedOutput: request.requested_output,
        idempotencyKeySha256,
      }
    );
  }

  if (request.requested_output === "procedure_assessment") {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      new ApiV1Error(
        503,
        "capability_unavailable",
        "The requested output is not available from this endpoint",
        [
          {
            field: "/requested_output",
            issue:
              "procedure_assessment is not currently available; request evidence_bundle or procedure_workflow",
          },
        ],
        false
      ),
      {
        eventType: "integration.procedure_query.capability_unavailable",
        outcome: "blocked",
        reasonCode: "requested_output_unavailable",
        requestedOutput: request.requested_output,
        idempotencyKeySha256,
      }
    );
  }

  const boundary = detectProductBoundaryViolation(request);
  if (boundary) {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      new ApiV1Error(
        400,
        "product_boundary_violation",
        "This endpoint handles evidence and procedure requests only. Use OS Electoral for electoral strategy or Content Agency for content generation and calendars.",
        [
          {
            field: "/question",
            issue:
              boundary === "electoral_strategy"
                ? "Route electoral strategy work to OS Electoral"
                : "Route content generation and calendars to Content Agency",
          },
        ]
      ),
      {
        eventType: "integration.procedure_query.boundary_rejected",
        outcome: "blocked",
        reasonCode: boundary,
        requestedOutput: request.requested_output,
        idempotencyKeySha256,
      }
    );
  }

  return executeProcedureQuery(
    dependencies,
    principal,
    request,
    idempotencyKeySha256,
    sha256(stableJson(request))
  );
};

/** Authentication is completed before any body bytes are parsed. */
export const handleProcedureQueryV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: ProcedureQueryApiDependencies
): Promise<void> => {
  const headerRequestId = requestIdFromHeader(req, dependencies.createUuid);
  let principal: AuthenticatedPrincipal;
  try {
    principal = await authenticateBearer(req.headers.authorization, dependencies.identityRepository);
  } catch (error) {
    let auditId = dependencies.createUuid();
    const reasonCode =
      error instanceof SecurityError
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
      // Authentication responses remain uniform even if the sanitized audit sink is unavailable.
    }
    sendV1Response(res, {
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
      headerRequestId.requestId
    );
    if (rateResponse) {
      sendV1Response(res, rateResponse);
      return;
    }
    const response = await handleAuthenticatedRequest(
      req,
      dependencies,
      principal,
      headerRequestId
    );
    sendV1Response(res, response);
  } catch {
    const response = await knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      internalError(),
      {
        eventType: "integration.procedure_query.failed",
        outcome: "error",
        reasonCode: "runtime_dependency_failure",
      }
    );
    sendV1Response(res, response);
  }
};
