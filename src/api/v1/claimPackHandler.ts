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
import { mapClaimPackV1 } from "./mapper.js";
import {
  type ClaimPackApiDependencies,
  type ClaimPackAuditRecord,
  type ClaimPackHttpResponse,
  type ClaimPackIdempotencyScope,
  type ClaimPackRequestV1,
} from "./claimPackTypes.js";

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

const sendClaimPackResponse = (
  res: ServerResponse,
  response: ClaimPackHttpResponse
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
  dependencies: ClaimPackApiDependencies,
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
  outcome: ClaimPackAuditRecord["outcome"],
  reasonCode: string,
  idempotencyKeySha256?: string
): ClaimPackAuditRecord => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  eventType,
  outcome,
  reasonCode,
  ...(idempotencyKeySha256 ? { idempotencyKeySha256 } : {}),
});

const recordDecision = async (
  dependencies: ClaimPackApiDependencies,
  principal: AuthenticatedPrincipal,
  record: ClaimPackAuditRecord
): Promise<void> => {
  await withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => dependencies.persistence.recordAudit(client, record)
  );
};

const knownErrorResponse = async (
  dependencies: ClaimPackApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  error: ApiV1Error,
  event: {
    eventType: string;
    outcome: ClaimPackAuditRecord["outcome"];
    reasonCode: string;
    idempotencyKeySha256?: string;
  }
): Promise<ClaimPackHttpResponse> => {
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
        event.idempotencyKeySha256
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

type StoredReplayState = "valid" | "expired" | "invalid";

const storedReplayState = async (
  dependencies: ClaimPackApiDependencies,
  claim: {
    statusCode: number;
    responseBody: string;
    originalAuditId: string;
  },
  principal: AuthenticatedPrincipal,
  request: ClaimPackRequestV1
): Promise<StoredReplayState> => {
  if (claim.statusCode !== 200 || !isCanonicalUuid(claim.originalAuditId)) return "invalid";
  let parsed: unknown;
  try {
    parsed = JSON.parse(claim.responseBody) as unknown;
  } catch {
    return "invalid";
  }
  const validators = await dependencies.validators;
  if (!validators.claimPack(parsed) || !parsed || typeof parsed !== "object") return "invalid";
  const body = parsed as Record<string, unknown>;
  const provenance = body.provenance as Record<string, unknown> | undefined;
  if (
    body.response_type !== "claim_pack" ||
    !tenantIdsEqual(String(body.tenant_id ?? ""), principal.tenantId) ||
    !tenantIdsEqual(String(body.request_id ?? ""), request.request_id) ||
    !tenantIdsEqual(String(provenance?.credential_id ?? ""), principal.credentialId) ||
    !tenantIdsEqual(String(provenance?.audit_id ?? ""), claim.originalAuditId)
  ) {
    return "invalid";
  }
  const validUntil = Date.parse(String(body.valid_until ?? ""));
  if (!Number.isFinite(validUntil)) return "invalid";
  return validUntil <= dependencies.now().getTime() ? "expired" : "valid";
};

const insufficientEvidenceError = (): ApiV1Error =>
  new ApiV1Error(
    409,
    "insufficient_evidence",
    "A ClaimPack requires at least one citable claim and a verifiable source link",
    [
      {
        field: "/question",
        issue: "Locate and validate citable evidence before requesting a ClaimPack",
      },
    ]
  );

const executeClaimPack = async (
  dependencies: ClaimPackApiDependencies,
  principal: AuthenticatedPrincipal,
  request: ClaimPackRequestV1,
  idempotencyKeySha256: string,
  requestSha256: string
): Promise<ClaimPackHttpResponse> => {
  const scope: ClaimPackIdempotencyScope = {
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
          const replayState = await storedReplayState(dependencies, claim, principal, request);
          if (replayState !== "valid") {
            await dependencies.persistence.invalidateCompletedIdempotency(client, scope);
            const auditId = dependencies.createUuid();
            await dependencies.persistence.recordAudit(
              client,
              auditRecord(
                principal,
                request.request_id,
                auditId,
                replayState === "expired"
                  ? "integration.claim_pack.idempotency_expired"
                  : "integration.claim_pack.idempotency_corrupt",
                replayState === "expired" ? "blocked" : "error",
                replayState === "expired" ? "stored_response_expired" : "stored_response_invalid",
                idempotencyKeySha256
              )
            );
            const error =
              replayState === "expired"
                ? new ApiV1Error(
                    409,
                    "claim_pack_expired",
                    "The prior ClaimPack expired and must be generated again",
                    [],
                    true
                  )
                : internalError();
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
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              dependencies.createUuid(),
              "integration.claim_pack.idempotency_replayed",
              "success",
              "idempotency_replay",
              idempotencyKeySha256
            )
          );
          return {
            statusCode: 200,
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
                ? "integration.claim_pack.idempotency_conflict"
                : "integration.claim_pack.idempotency_in_progress",
              "blocked",
              claim.kind === "conflict" ? "idempotency_conflict" : "idempotency_in_progress",
              idempotencyKeySha256
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
        const generatedAt = dependencies.now();
        if (!Number.isFinite(generatedAt.getTime())) throw new Error("Invalid ClaimPack clock");
        const validUntil = new Date(
          generatedAt.getTime() + dependencies.validitySeconds * 1000
        ).toISOString();
        const compiled = await dependencies.compiler(request, client);
        const mapped = mapClaimPackV1({
          request,
          workflow: compiled.workflow,
          evidenceRecords: compiled.evidenceRecords,
          auditId,
          credentialId: principal.credentialId,
          createdAt: generatedAt.toISOString(),
          validUntil,
        });
        if (!mapped) {
          await dependencies.persistence.releaseIdempotency(client, scope);
          await dependencies.persistence.recordAudit(
            client,
            auditRecord(
              principal,
              request.request_id,
              auditId,
              "integration.claim_pack.rejected",
              "blocked",
              "insufficient_citable_evidence",
              idempotencyKeySha256
            )
          );
          const error = insufficientEvidenceError();
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

        const validators = await dependencies.validators;
        if (!validators.claimPack(mapped)) {
          throw new Error("Generated ClaimPack failed the canonical v1 contract");
        }
        const body = JSON.stringify(mapped);
        await dependencies.persistence.recordAudit(
          client,
          auditRecord(
            principal,
            request.request_id,
            auditId,
            "integration.claim_pack.succeeded",
            "success",
            "claim_pack_generated",
            idempotencyKeySha256
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
              "integration.claim_pack.failed",
              "error",
              "execution_failed",
              idempotencyKeySha256
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
  dependencies: ClaimPackApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<ClaimPackHttpResponse | null> =>
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
    if (!rate.auditId) throw new Error("Denied ClaimPack rate decision has no audit identity");
    if (rate.shouldAudit) {
      await dependencies.persistence.recordAudit(
        client,
        auditRecord(
          principal,
          requestId,
          rate.auditId,
          "integration.claim_pack.rate_limited",
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
  dependencies: ClaimPackApiDependencies,
  principal: AuthenticatedPrincipal,
  headerRequestId: { requestId: string; valid: boolean }
): Promise<ClaimPackHttpResponse> => {
  try {
    requirePermission(principal, "integration:query");
  } catch {
    return knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      forbiddenError(),
      {
        eventType: "integration.claim_pack.authorization_denied",
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
        eventType: "integration.claim_pack.request_rejected",
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
        eventType: "integration.claim_pack.request_rejected",
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
        eventType: "integration.claim_pack.request_rejected",
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
        eventType: "integration.claim_pack.request_rejected",
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
        eventType: "integration.claim_pack.request_rejected",
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
        eventType: "integration.claim_pack.failed",
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
        "Request body does not satisfy the v1 ClaimPack request contract",
        validationDetails(validators.request.errors)
      ),
      {
        eventType: "integration.claim_pack.request_rejected",
        outcome: "blocked",
        reasonCode: "schema_validation_failed",
        idempotencyKeySha256,
      }
    );
  }
  const request = parsed as ClaimPackRequestV1;

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
        eventType: "integration.claim_pack.request_rejected",
        outcome: "blocked",
        reasonCode: "request_id_mismatch",
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
        eventType: "integration.claim_pack.tenant_access_denied",
        outcome: "blocked",
        reasonCode: "access_denied",
        idempotencyKeySha256,
      }
    );
  }

  const boundaryViolation = detectProductBoundaryViolation(request);
  if (boundaryViolation) {
    return knownErrorResponse(
      dependencies,
      principal,
      request.request_id,
      forbiddenError(),
      {
        eventType: "integration.claim_pack.product_boundary_denied",
        outcome: "blocked",
        reasonCode: boundaryViolation,
        idempotencyKeySha256,
      }
    );
  }

  return executeClaimPack(
    dependencies,
    principal,
    request,
    idempotencyKeySha256,
    sha256(stableJson(request))
  );
};

/** Authentication completes before any request body bytes are parsed. */
export const handleClaimPackV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: ClaimPackApiDependencies
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
    sendClaimPackResponse(res, {
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
      sendClaimPackResponse(res, rateResponse);
      return;
    }
    const response = await handleAuthenticatedRequest(
      req,
      dependencies,
      principal,
      headerRequestId
    );
    sendClaimPackResponse(res, response);
  } catch {
    const response = await knownErrorResponse(
      dependencies,
      principal,
      headerRequestId.requestId,
      internalError(),
      {
        eventType: "integration.claim_pack.failed",
        outcome: "error",
        reasonCode: "runtime_dependency_failure",
      }
    );
    sendClaimPackResponse(res, response);
  }
};
