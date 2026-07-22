import { createHash, createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../../../http.js";
import { isCanonicalUuid, withTenantTransaction } from "../../../security/index.js";
import {
  executeSearch,
  type SearchExecutionResult,
} from "../../../searchEvidence/service.js";
import type {
  ClassifiedSearchCandidate,
  SearchExecutionRequestV1,
} from "../../v1/searchEvidenceTypes.js";
import {
  PUBLIC_QUERY_ROUTE,
  PublicQueryRepositoryError,
  type PublicQueryApiDependencies,
  type PublicQueryAuditInput,
  type PublicQueryCitationV1,
  type PublicQueryConfidence,
  type PublicQueryErrorV1,
  type PublicQueryMode,
  type PublicQueryRequestV1,
  type PublicQueryResponseLabel,
  type PublicQueryResponseV1,
} from "./publicQueryTypes.js";

const MAX_BODY_BYTES = 8 * 1024;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const PUBLIC_LIMITATION = "La recuperación pública no sustituye revisión jurídica, técnica o municipal.";
const DATE_LIMITATION = "La vigencia y aplicabilidad requieren revisión de las fuentes citadas.";

type PublicErrorStatus = 400 | 403 | 405 | 429 | 500 | 503;

class PublicQueryHttpError extends Error {
  constructor(
    public readonly statusCode: PublicErrorStatus,
    public readonly code: PublicQueryErrorV1["error"]["code"],
    message: string,
    public readonly retryable = false,
    public readonly retryAfterSeconds?: number,
    public readonly auditAlreadyRecorded = false
  ) {
    super(message);
    this.name = "PublicQueryHttpError";
  }
}

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;

const appendVary = (res: ServerResponse, value: string): void => {
  const existing = res.getHeader("vary");
  const values = new Set(
    (Array.isArray(existing) ? existing : String(existing ?? "").split(","))
      .map((item) => item.trim())
      .filter(Boolean)
  );
  values.add(value);
  res.setHeader("vary", [...values].join(", "));
};

const requestIdFor = (
  req: IncomingMessage,
  createUuid: () => string
): { requestId: string; valid: boolean } => {
  const value = singleHeader(req.headers["x-request-id"]);
  if (value === null) return { requestId: createUuid(), valid: true };
  return isCanonicalUuid(value)
    ? { requestId: value.toLowerCase(), valid: true }
    : { requestId: createUuid(), valid: false };
};

const applyAllowedOrigin = (
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: readonly string[]
): boolean => {
  appendVary(res, "Origin");
  const origin = singleHeader(req.headers.origin);
  if (!origin || !allowedOrigins.includes(origin)) return false;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type, x-request-id");
  res.setHeader("access-control-expose-headers", "x-request-id, retry-after");
  res.setHeader("access-control-max-age", "600");
  return true;
};

const errorMessages: Record<PublicQueryErrorV1["error"]["code"], string> = {
  invalid_request: "Request validation failed",
  forbidden: "Access denied",
  method_not_allowed: "Method not allowed",
  rate_limit_exceeded: "Rate limit exceeded",
  service_unavailable: "Public query service is unavailable",
  internal_error: "Unexpected server error",
};

const serializeError = async (
  dependencies: PublicQueryApiDependencies,
  requestId: string,
  error: PublicQueryHttpError
): Promise<string> => {
  const body: PublicQueryErrorV1 = {
    schema_version: "v1",
    response_type: "public_error",
    request_id: requestId,
    error: {
      code: error.code,
      message: errorMessages[error.code],
      retryable: error.retryable,
    },
  };
  try {
    const validators = await dependencies.validators;
    if (!validators.error(body)) throw new Error("Public error validation failed");
  } catch {
    return JSON.stringify(body);
  }
  return JSON.stringify(body);
};

const send = (
  res: ServerResponse,
  statusCode: number,
  requestId: string,
  body: string,
  options: { retryAfterSeconds?: number; allow?: string; close?: boolean } = {}
): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-request-id": requestId,
  };
  if (options.retryAfterSeconds) headers["retry-after"] = options.retryAfterSeconds;
  if (options.allow) headers.allow = options.allow;
  if (options.close) {
    headers.connection = "close";
    res.shouldKeepAlive = false;
  }
  res.writeHead(statusCode, headers);
  res.end(body);
};

const hmacHex = (secret: string, value: string): string =>
  createHmac("sha256", secret).update(value, "utf8").digest("hex");

const clientKey = (req: IncomingMessage, secret: string): string => {
  const address = req.socket.remoteAddress?.slice(0, 128) || "unknown";
  const userAgent = (singleHeader(req.headers["user-agent"]) ?? "unknown")
    .replace(CONTROL_CHARACTER, " ")
    .slice(0, 256);
  return hmacHex(secret, `${address}\n${userAgent}`);
};

const audit = (
  auditId: string,
  tenantId: string,
  requestId: string,
  eventType: PublicQueryAuditInput["eventType"],
  outcome: PublicQueryAuditInput["outcome"],
  reasonCode: string,
  optional: Pick<PublicQueryAuditInput, "requestedMode" | "resultCount"> = {}
): PublicQueryAuditInput => ({
  auditId,
  tenantId,
  requestId,
  eventType,
  outcome,
  reasonCode,
  ...optional,
});

const recordAuditSafely = async (
  dependencies: PublicQueryApiDependencies,
  input: PublicQueryAuditInput
): Promise<void> => {
  if (!dependencies.tenantId) return;
  try {
    await withTenantTransaction(dependencies.transactionPool, dependencies.tenantId, async (client) => {
      await dependencies.publicRepository.recordAudit(client, input);
    });
  } catch {
    // Preserve the primary safe response. Operational alerting must detect audit failures.
  }
};

const runRateGate = async (
  req: IncomingMessage,
  dependencies: PublicQueryApiDependencies,
  requestId: string
): Promise<void> => {
  const tenantId = dependencies.tenantId!;
  const secret = dependencies.clientKeySecret!;
  const now = dependencies.now().toISOString();
  const globalKey = createHash("sha256").update("public-query-global-v1", "utf8").digest("hex");
  const perClientKey = clientKey(req, secret);
  const blocked = await withTenantTransaction(
    dependencies.transactionPool,
    tenantId,
    async (client) => {
      for (const input of [
        {
          tenantId,
          clientKeySha256: globalKey,
          operation: "public_query_global_v1" as const,
          limit: dependencies.globalRateLimit,
          windowSeconds: dependencies.rateWindowSeconds,
          now,
          blockedAuditId: dependencies.createUuid(),
        },
        {
          tenantId,
          clientKeySha256: perClientKey,
          operation: "public_query_client_v1" as const,
          limit: dependencies.rateLimit,
          windowSeconds: dependencies.rateWindowSeconds,
          now,
          blockedAuditId: dependencies.createUuid(),
        },
      ]) {
        const decision = await dependencies.publicRepository.consumeRateLimit(client, input);
        if (!decision.allowed) {
          if (decision.shouldAudit !== false) {
            await dependencies.publicRepository.recordAudit(client, audit(
              decision.auditId ?? input.blockedAuditId,
              tenantId,
              requestId,
              "public.query.blocked",
              "blocked",
              "rate_limit_exceeded"
            ));
          }
          return decision;
        }
      }
      return null;
    }
  );
  if (blocked) {
    throw new PublicQueryHttpError(
      429,
      "rate_limit_exceeded",
      "Rate limit exceeded",
      true,
      blocked.retryAfterSeconds,
      true
    );
  }
};

const safeText = (value: string, maximum: number): string | null => {
  if (!value || CONTROL_CHARACTER.test(value)) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > maximum ? `${normalized.slice(0, Math.max(1, maximum - 1))}…` : normalized;
};

const safePublicUrl = (value: string): boolean => {
  if (value.length < 1 || value.length > 2048 || CONTROL_CHARACTER.test(value)) return false;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:"
      || parsed.username
      || parsed.password
      || parsed.search
      || parsed.hash
    ) return false;
    return true;
  } catch {
    return false;
  }
};

const citationFrom = (candidate: ClassifiedSearchCandidate): PublicQueryCitationV1 | null => {
  const citationLabel = safeText(candidate.citationLabel, 300);
  const sourceType = safeText(candidate.documentType, 64);
  const title = safeText(candidate.documentTitle, 300);
  const excerpt = safeText(candidate.excerpt, 700);
  const articleNumber = candidate.articleNumber === null ? null : safeText(candidate.articleNumber, 120);
  if (!citationLabel || !sourceType || !title || !excerpt || !safePublicUrl(candidate.sourceUrl)) return null;
  return {
    citationLabel,
    sourceType,
    title,
    pageStart: candidate.pageStart,
    pageEnd: candidate.pageEnd,
    articleNumber,
    excerpt,
    sourceUrl: candidate.sourceUrl,
    authorityStatus: candidate.authorityStatus,
    temporalStatus: candidate.temporalStatus,
    evidenceStatus: candidate.evidenceStatus,
  };
};

const labelFor = (citations: PublicQueryCitationV1[]): PublicQueryResponseLabel => {
  if (citations.some((citation) => citation.evidenceStatus === "supported")) return "evidence_found";
  if (citations.length > 0) return "insufficient_evidence";
  return "not_found";
};

const confidenceFor = (citations: PublicQueryCitationV1[]): PublicQueryConfidence => {
  const supported = citations.filter((citation) => citation.evidenceStatus === "supported").length;
  if (supported >= 2) return "high";
  if (supported === 1) return "medium";
  return "low";
};

const contentFor = (label: PublicQueryResponseLabel, citations: PublicQueryCitationV1[]): string => {
  if (label === "not_found") {
    return "No encontré evidencia documental pública suficiente para responder con confianza. Intenta una consulta más específica o solicita que se incorpore y revise la fuente correspondiente.";
  }
  if (label === "insufficient_evidence") {
    return "Encontré referencias documentales públicas, pero no sostienen una respuesta oficial para La Antigua Guatemala. Revisa las citas y corrobora autoridad, vigencia y aplicabilidad.";
  }
  const supported = citations.filter((citation) => citation.evidenceStatus === "supported");
  const noun = supported.length === 1 ? "fragmento documental público" : "fragmentos documentales públicos";
  return `Encontré **${supported.length} ${noun}** relacionado${supported.length === 1 ? "" : "s"} con la consulta. Revisa las citas, la vigencia y la aplicabilidad antes de usar la respuesta como conclusión institucional.`;
};

const suggestedActionFor = (label: PublicQueryResponseLabel): string => {
  if (label === "not_found") return "Reformula la consulta o solicita la incorporación y revisión de una fuente documental.";
  if (label === "insufficient_evidence") return "Corrobora la referencia con una fuente oficial de La Antigua Guatemala o nacional aplicable.";
  return "Revisa la cita, la vigencia y la aplicabilidad antes de tomar una decisión.";
};

const internalSearchRequest = (
  dependencies: PublicQueryApiDependencies,
  requestId: string,
  request: PublicQueryRequestV1
): SearchExecutionRequestV1 => ({
  schema_version: "v1",
  operation: "search",
  request_id: requestId,
  tenant_id: dependencies.tenantId!,
  query: request.message.trim(),
  jurisdiction: dependencies.jurisdiction!,
  as_of_date: dependencies.now().toISOString().slice(0, 10),
  mode: request.mode,
  limit: Math.min(request.limit, dependencies.maxLimit),
  filters: {
    document_types: [],
    source_relations: [],
    authority_statuses: [],
    temporal_statuses: [],
    source_ids: [],
  },
});

const buildResponse = (
  dependencies: PublicQueryApiDependencies,
  requestId: string,
  request: PublicQueryRequestV1,
  execution: SearchExecutionResult
): PublicQueryResponseV1 => {
  const citations = execution.candidates
    .map(citationFrom)
    .filter((citation): citation is PublicQueryCitationV1 => citation !== null)
    .slice(0, Math.min(request.limit, dependencies.maxLimit));
  const responseLabel = labelFor(citations);
  const limitations = [
    PUBLIC_LIMITATION,
    DATE_LIMITATION,
    ...execution.candidates.flatMap((candidate) => candidate.limitations),
  ].map((value) => safeText(value, 500)).filter((value): value is string => Boolean(value));
  return {
    schema_version: "v1",
    response_type: "public_query",
    request_id: requestId,
    role: "assistant",
    content: contentFor(responseLabel, citations),
    citations,
    meta: {
      responseLabel,
      confidence: confidenceFor(citations),
      evidenceCount: citations.length,
      suggestedAction: suggestedActionFor(responseLabel),
      requestedMode: request.mode,
      executedModes: execution.executedModes,
      jurisdiction: dependencies.jurisdiction!,
      asOfDate: dependencies.now().toISOString().slice(0, 10),
      limitations: [...new Set(limitations)].slice(0, 12),
    },
  };
};

const normalizeError = (error: unknown): PublicQueryHttpError => {
  if (error instanceof PublicQueryHttpError) return error;
  if (error instanceof PublicQueryRepositoryError) {
    return new PublicQueryHttpError(500, "internal_error", "Unexpected server error", true);
  }
  return new PublicQueryHttpError(500, "internal_error", "Unexpected server error", true);
};

export const handlePublicQueryV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  dependencies: PublicQueryApiDependencies
): Promise<boolean> => {
  if (pathname !== PUBLIC_QUERY_ROUTE) return false;
  const requestIdentity = requestIdFor(req, dependencies.createUuid);
  const originAllowed = applyAllowedOrigin(req, res, dependencies.allowedOrigins);

  if (!originAllowed) {
    req.resume();
    const error = new PublicQueryHttpError(403, "forbidden", "Access denied");
    send(res, 403, requestIdentity.requestId, await serializeError(dependencies, requestIdentity.requestId, error), { close: true });
    return true;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return true;
  }

  if (!dependencies.enabled || !dependencies.tenantId || !dependencies.jurisdiction || !dependencies.clientKeySecret) {
    req.resume();
    const error = new PublicQueryHttpError(503, "service_unavailable", "Public query service is unavailable", true);
    send(res, 503, requestIdentity.requestId, await serializeError(dependencies, requestIdentity.requestId, error));
    return true;
  }

  let requestedMode: PublicQueryMode | undefined;
  try {
    if (req.method !== "POST") {
      throw new PublicQueryHttpError(405, "method_not_allowed", "Method not allowed");
    }
    if (!requestIdentity.valid) {
      throw new PublicQueryHttpError(400, "invalid_request", "X-Request-Id must be a UUID");
    }
    await runRateGate(req, dependencies, requestIdentity.requestId);
    if (req.headers.authorization !== undefined || req.headers.cookie !== undefined) {
      throw new PublicQueryHttpError(400, "invalid_request", "Browser credentials are not accepted");
    }
    const contentType = singleHeader(req.headers["content-type"]);
    if (!contentType || !/^application\/json(?:\s*;|$)/i.test(contentType)) {
      throw new PublicQueryHttpError(400, "invalid_request", "Content-Type must be application/json");
    }
    let parsed: unknown;
    try {
      parsed = await readJsonBody(req, MAX_BODY_BYTES);
    } catch {
      throw new PublicQueryHttpError(400, "invalid_request", "Request body must be valid JSON");
    }
    const validators = await dependencies.validators;
    if (!validators.request(parsed)) {
      throw new PublicQueryHttpError(400, "invalid_request", "Request validation failed");
    }
    const request = parsed as PublicQueryRequestV1;
    requestedMode = request.mode;
    if (!request.message.trim() || CONTROL_CHARACTER.test(request.message)) {
      throw new PublicQueryHttpError(400, "invalid_request", "Invalid message");
    }

    const internalRequest = internalSearchRequest(dependencies, requestIdentity.requestId, request);
    const body = await withTenantTransaction(
      dependencies.transactionPool,
      dependencies.tenantId,
      async (client) => {
        const execution = await executeSearch(
          dependencies.searchRepository,
          client,
          internalRequest,
          null
        );
        const response = buildResponse(dependencies, requestIdentity.requestId, request, execution);
        if (!validators.response(response)) {
          throw new Error("Generated public query response failed its contract");
        }
        await dependencies.publicRepository.recordAudit(client, audit(
          dependencies.createUuid(),
          dependencies.tenantId!,
          requestIdentity.requestId,
          "public.query.succeeded",
          "success",
          "query_completed",
          { requestedMode: request.mode, resultCount: response.citations.length }
        ));
        return JSON.stringify(response);
      }
    );
    send(res, 200, requestIdentity.requestId, body);
    return true;
  } catch (error) {
    req.resume();
    const normalized = normalizeError(error);
    if (!normalized.auditAlreadyRecorded) {
      await recordAuditSafely(dependencies, audit(
        dependencies.createUuid(),
        dependencies.tenantId,
        requestIdentity.requestId,
        normalized.statusCode >= 500 ? "public.query.failed" : "public.query.blocked",
        normalized.statusCode >= 500 ? "error" : "blocked",
        normalized.code,
        requestedMode ? { requestedMode } : {}
      ));
    }
    send(
      res,
      normalized.statusCode,
      requestIdentity.requestId,
      await serializeError(dependencies, requestIdentity.requestId, normalized),
      {
        ...(normalized.retryAfterSeconds ? { retryAfterSeconds: normalized.retryAfterSeconds } : {}),
        ...(normalized.statusCode === 405 ? { allow: "POST, OPTIONS" } : {}),
        close: normalized.statusCode === 400 || normalized.statusCode === 403 || normalized.statusCode === 429,
      }
    );
    return true;
  }
};
