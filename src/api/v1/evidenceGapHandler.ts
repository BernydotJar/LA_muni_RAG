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
import { mapEvidenceGapResponseV1 } from "./evidenceGapMapper.js";
import type {
  EvidenceGapApiDependencies,
  EvidenceGapAuditRecord,
  EvidenceGapHttpResponse,
  EvidenceGapIdempotencyScope,
  EvidenceGapRequestV1,
} from "./evidenceGapTypes.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';
const AUTHORITY_PROMOTION_PATTERN =
  /\b(?:declara(?:r)?|marca(?:r)?|considera(?:r)?)\b.{0,80}\b(?:oficial|vigente|aplicable)\b/i;

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

const sendEvidenceGapResponse = (
  res: ServerResponse,
  response: EvidenceGapHttpResponse
): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(response.body),
    "cache-control": "no-store",
    "x-request-id": response.requestId,
  };
  if (response.statusCode !== 200) headers.connection = "close";
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
  dependencies: EvidenceGapApiDependencies,
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

const auditRecord = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  eventType: string,
  outcome: EvidenceGapAuditRecord["outcome"],
  reasonCode: string,
  optional: Pick<EvidenceGapAuditRecord, "gapRequestId" | "idempotencyKeySha256"> = {}
): EvidenceGapAuditRecord => ({
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
  dependencies: EvidenceGapApiDependencies,
  principal: AuthenticatedPrincipal,
  record: EvidenceGapAuditRecord
): Promise<void> => {
  await withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => dependencies.persistence.recordAudit(client, record)
  );
};

const knownErrorResponse = async (
  dependencies: EvidenceGapApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  error: ApiV1Error,
  event: {
    eventType: string;
    outcome: EvidenceGapAuditRecord["outcome"];
    reasonCode: string;
    gapRequestId?: string;
    idempotencyKeySha256?: string;
  }
): Promise<EvidenceGapHttpResponse> => {
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
          ...(event.gapRequestId ? { gapRequestId: event.gapRequestId } : {}),
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
        "Idempotency-Key was already used with a different request"
      )
    : new ApiV1Error(
        409,
        "request_in_progress",
        "An identical request with this Idempotency-Key is still in progress",
        [],
        true
      );

const gapConflictError = (): ApiV1Error =>
  new ApiV1Error(
    409,
    "gap_request_conflict",
    "The gap request identity is already bound to a different request"
  );

const validStoredResponse = async (
  dependencies: EvidenceGapApiDependencies,
  stored: {
    statusCode: number;
    responseBody: string;
    responseSha256: string;
    originalAuditId: string;
  },
  principal: AuthenticatedPrincipal,
  request: EvidenceGapRequestV1
): Promise<boolean> => {
  if (
    stored.statusCode !== 200 ||
    !isCanonicalUuid(stored.originalAuditId) ||
    !/^[0-9a-f]{64}$/.test(stored.responseSha256) ||
    sha256(stored.responseBody) !== stored.responseSha256
  ) {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored.responseBody) as unknown;
  } catch {
    return false;
  }
  const validators = await dependencies.validators;
  if (!validators.response(parsed) || !parsed || typeof parsed !== "object") return false;
  const body = parsed as Record<string, unknown>;
  const submittedAt = String(body.submitted_at ?? "");
  if (!Number.isFinite(Date.parse(submittedAt))) return false;
  const expected = mapEvidenceGapResponseV1({
    request,
    auditId: stored.originalAuditId,
    credentialId: principal.credentialId,
    submittedAt,
  });
  return stored.responseBody === JSON.stringify(expected);
};

const executeEvidenceGap = async (
  dependencies: EvidenceGapApiDependencies,
  principal: AuthenticatedPrincipal,
  request: EvidenceGapRequestV1,
  idempotencyKeySha256: string,
  requestSha256: string
): Promise<EvidenceGapHttpResponse> => {
  const scope: EvidenceGapIdempotencyScope = {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
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
          if (!(await validStoredResponse(dependencies, claim, principal, request))) {
            await dependencies.persistence.invalidateCompletedIdempotency(client, scope);
            const auditId = dependencies.createUuid();
            await dependencies.persistence.recordAudit(
              client,
              auditRecord(
                principal,
                request.request_id,
                auditId,
                "integration.evidence_gap.idempotency_corrupt",
                "error",
                "stored_response_invalid",
                { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
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
              "integration.evidence_gap.idempotency_replayed",
              "success",
              "idempotency_replay",
              { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
            )
          );
          return { statusCode: 200, body: claim.responseBody, requestId: request.request_id };
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
                ? "integration.evidence_gap.idempotency_conflict"
                : "integration.evidence_gap.idempotency_in_progress",
              "blocked",
              claim.kind === "conflict" ? "idempotency_conflict" : "idempotency_in_progress",
              { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
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
        const submittedAt = dependencies.now();
        if (!Number.isFinite(submittedAt.getTime())) throw new Error("Invalid EvidenceGap clock");
        const mapped = mapEvidenceGapResponseV1({
          request,
          auditId,
          credentialId: principal.credentialId,
          submittedAt: submittedAt.toISOString(),
        });
        const validators = await dependencies.validators;
        if (!validators.response(mapped)) {
          throw new Error("Generated EvidenceGap response failed the canonical v1 contract");
        }
        const body = JSON.stringify(mapped);
        const responseSha256 = sha256(body);
        const aggregate = await dependencies.persistence.createOrReplayGap(client, {
          tenantId: principal.tenantId,
          gapRequestId: request.gap_request_id,
          requestId: request.request_id,
          requesterProduct: "os_electoral",
          jurisdiction: request.jurisdiction,
          subject: request.subject,
          missingDocument: request.missing_document,
          reason: request.reason,
          priority: request.priority,
          campaignReference: request.campaign_reference,
          requestSha256,
          principalId: principal.principalId,
          credentialId: principal.credentialId,
          originalAuditId: auditId,
          responseBody: body,
          responseSha256,
          submittedAt: submittedAt.toISOString(),
        });

        if (aggregate.kind === "conflict") {
          await dependencies.persistence.releaseIdempotency(client, scope);
          const error = gapConflictError();
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              auditId,
              "integration.evidence_gap.aggregate_conflict",
              "blocked",
              "gap_request_conflict",
              { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
            )
          );
          return {
            statusCode: 409,
            body: await errorBody(dependencies, error, {
              tenantId: principal.tenantId,
              credentialId: principal.credentialId,
              requestId: request.request_id,
              auditId,
            }),
            requestId: request.request_id,
          };
        }

        if (aggregate.kind === "replay") {
          if (!(await validStoredResponse(dependencies, aggregate, principal, request))) {
            await dependencies.persistence.releaseIdempotency(client, scope);
            await dependencies.persistence.recordAudit(
              client,
              auditRecord(
                principal,
                request.request_id,
                auditId,
                "integration.evidence_gap.aggregate_corrupt",
                "error",
                "stored_aggregate_invalid",
                { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
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
              "integration.evidence_gap.aggregate_replayed",
              "success",
              "aggregate_replay",
              { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
            )
          );
          await dependencies.persistence.completeIdempotency(client, scope, {
            statusCode: 200,
            responseBody: aggregate.responseBody,
            responseSha256: aggregate.responseSha256,
            auditId: aggregate.originalAuditId,
          });
          return {
            statusCode: 200,
            body: aggregate.responseBody,
            requestId: request.request_id,
          };
        }

        await dependencies.persistence.recordAudit(
          client,
          auditRecord(
            principal,
            request.request_id,
            auditId,
            "integration.evidence_gap.succeeded",
            "success",
            "evidence_gap_opened",
            { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
          )
        );
        await dependencies.persistence.completeIdempotency(client, scope, {
          statusCode: 200,
          responseBody: body,
          responseSha256,
          auditId,
        });
        return { statusCode: 200, body, requestId: request.request_id };
      }
    );
  } catch {
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
              "integration.evidence_gap.failed",
              "error",
              "execution_failed",
              { gapRequestId: request.gap_request_id, idempotencyKeySha256 }
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
  dependencies: EvidenceGapApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<EvidenceGapHttpResponse | null> =>
  withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const candidateAuditId = dependencies.createUuid();
    const rate = await dependencies.persistence.consumeRateLimit(client, {
      tenantId: principal.tenantId,
      principalId: principal.principalId,
      limit: dependencies.rateLimit,
      windowSeconds: dependencies.rateWindowSeconds,
      blockedAuditId: candidateAuditId,
    });
    if (rate.allowed) return null;
    if (!rate.auditId) throw new Error("Denied EvidenceGap rate decision has no audit identity");
    if (rate.shouldAudit) {
      await dependencies.persistence.recordAudit(
        client,
        auditRecord(
          principal,
          requestId,
          rate.auditId,
          "integration.evidence_gap.rate_limited",
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
  dependencies: EvidenceGapApiDependencies,
  principal: AuthenticatedPrincipal,
  headerRequestId: { requestId: string; valid: boolean }
): Promise<EvidenceGapHttpResponse> => {
  try {
    requirePermission(principal, "integration:query");
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      forbiddenError(),
      {
        eventType: "integration.evidence_gap.authorization_denied",
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
      requestInputError("invalid_method", "Only POST is supported for this endpoint", "method"),
      {
        eventType: "integration.evidence_gap.request_rejected",
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
        eventType: "integration.evidence_gap.request_rejected",
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
        eventType: "integration.evidence_gap.request_rejected",
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
        eventType: "integration.evidence_gap.request_rejected",
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
        eventType: "integration.evidence_gap.request_rejected",
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
        eventType: "integration.evidence_gap.failed",
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
        "Request body does not satisfy the v1 EvidenceGapRequest contract",
        validationDetails(validators.request.errors)
      ),
      {
        eventType: "integration.evidence_gap.request_rejected",
        outcome: "blocked",
        reasonCode: "schema_validation_failed",
        idempotencyKeySha256,
      }
    );
  }
  const request = parsed as EvidenceGapRequestV1;

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
        eventType: "integration.evidence_gap.request_rejected",
        outcome: "blocked",
        reasonCode: "request_id_mismatch",
        gapRequestId: request.gap_request_id,
        idempotencyKeySha256,
      }
    );
  }
  request.request_id = headerRequestId.requestId;
  request.gap_request_id = request.gap_request_id.toLowerCase();
  request.tenant_id = request.tenant_id.toLowerCase();

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
        eventType: "integration.evidence_gap.tenant_access_denied",
        outcome: "blocked",
        reasonCode: "access_denied",
        gapRequestId: request.gap_request_id,
        idempotencyKeySha256,
      }
    );
  }

  const boundary = detectProductBoundaryViolation({
    question: request.subject,
    case_context: {
      facts: [request.missing_document, request.reason],
      constraints: [],
    },
  });
  if (boundary) {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      new ApiV1Error(
        400,
        "product_boundary_violation",
        "EvidenceGapRequest accepts documentary research needs only; electoral strategy belongs to OS Electoral and content production belongs to Content Agency."
      ),
      {
        eventType: "integration.evidence_gap.boundary_rejected",
        outcome: "blocked",
        reasonCode: boundary,
        gapRequestId: request.gap_request_id,
        idempotencyKeySha256,
      }
    );
  }

  if (AUTHORITY_PROMOTION_PATTERN.test(`${request.subject} ${request.reason}`)) {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      new ApiV1Error(
        400,
        "source_authority_not_accepted",
        "A gap request cannot declare a source official, current or applicable"
      ),
      {
        eventType: "integration.evidence_gap.authority_rejected",
        outcome: "blocked",
        reasonCode: "source_authority_declaration",
        gapRequestId: request.gap_request_id,
        idempotencyKeySha256,
      }
    );
  }

  return executeEvidenceGap(
    dependencies,
    principal,
    request,
    idempotencyKeySha256,
    sha256(stableJson(request))
  );
};

/** Authentication completes before any request body bytes are parsed. */
export const handleEvidenceGapV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: EvidenceGapApiDependencies
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
      // Keep uniform authentication responses if the sanitized audit sink is unavailable.
    }
    sendEvidenceGapResponse(res, {
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
      sendEvidenceGapResponse(res, rateResponse);
      return;
    }
    const response = await handleAuthenticatedRequest(
      req,
      dependencies,
      principal,
      headerRequestId
    );
    sendEvidenceGapResponse(res, response);
  } catch {
    const response = await knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      internalError(),
      {
        eventType: "integration.evidence_gap.failed",
        outcome: "error",
        reasonCode: "runtime_dependency_failure",
      }
    );
    sendEvidenceGapResponse(res, response);
  }
};
