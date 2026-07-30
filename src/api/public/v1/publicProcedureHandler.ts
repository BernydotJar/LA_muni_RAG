import { createHash, createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { summarizeDomainPackForUi } from "../../../domain/registry.js";
import type { DomainPack } from "../../../domain/types.js";
import type { EvidenceItem, EvidenceMode } from "../../../evidence.js";
import {
  classifyProcedureQuery,
  composeProcedureWorkflow,
  type ProcedureQueryClassification,
  type ProcedureWorkflow,
  type ProcedureWorkflowDepth,
} from "../../../procedure/index.js";
import { isCanonicalUuid, withTenantTransaction } from "../../../security/index.js";
import { executeSearch } from "../../../searchEvidence/service.js";
import type {
  ClassifiedSearchCandidate,
  SearchExecutionRequestV1,
} from "../../v1/searchEvidenceTypes.js";
import {
  PublicQueryRepositoryError,
  type PublicQueryApiDependencies,
  type PublicQueryAuditInput,
  type PublicQueryErrorV1,
} from "./publicQueryTypes.js";

export const PUBLIC_PROCEDURE_ROUTE = "/api/public/v1/procedure";
export const PUBLIC_DOMAIN_PACK_ROUTE = "/api/public/v1/domain-pack";

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const MAX_QUERY_LENGTH = 800;
const DEFAULT_MAX_RESULTS = 12;
const MAX_CONFIGURED_RESULTS = 20;

type PublicProcedureMode = EvidenceMode;
type PublicErrorStatus = 400 | 403 | 405 | 429 | 500 | 503;

export interface PublicProcedureDependencies {
  gateway: PublicQueryApiDependencies;
  domainPack: DomainPack;
  maxLimit: number;
}

export interface PublicProcedureOptions {
  maxLimit?: number;
}

class PublicProcedureHttpError extends Error {
  constructor(
    public readonly statusCode: PublicErrorStatus,
    public readonly code: PublicQueryErrorV1["error"]["code"],
    message: string,
    public readonly retryable = false,
    public readonly retryAfterSeconds?: number,
    public readonly auditAlreadyRecorded = false
  ) {
    super(message);
    this.name = "PublicProcedureHttpError";
  }
}

const configuredInteger = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error("Public procedure result limit is invalid");
  return parsed;
};

const integerWithin = (value: unknown, minimum: number, maximum: number, fallback: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`Public procedure result limit must be between ${minimum} and ${maximum}`);
  }
  return Number(value);
};

export const createPublicProcedureDependencies = (
  gateway: PublicQueryApiDependencies,
  domainPack: DomainPack,
  options: PublicProcedureOptions = {}
): PublicProcedureDependencies => ({
  gateway,
  domainPack,
  maxLimit: integerWithin(
    options.maxLimit ?? configuredInteger(process.env.PUBLIC_PROCEDURE_MAX_RESULTS),
    1,
    MAX_CONFIGURED_RESULTS,
    DEFAULT_MAX_RESULTS
  ),
});

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

const applyAllowedOrigin = (
  req: IncomingMessage,
  res: ServerResponse,
  allowedOrigins: readonly string[]
): boolean => {
  appendVary(res, "Origin");
  const origin = singleHeader(req.headers.origin);
  if (!origin || !allowedOrigins.includes(origin)) return false;
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-methods", "GET, OPTIONS");
  res.setHeader("access-control-allow-headers", "accept, x-request-id");
  res.setHeader("access-control-expose-headers", "x-request-id, retry-after");
  res.setHeader("access-control-max-age", "600");
  return true;
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

const errorMessages: Record<PublicQueryErrorV1["error"]["code"], string> = {
  invalid_request: "Request validation failed",
  forbidden: "Access denied",
  method_not_allowed: "Method not allowed",
  rate_limit_exceeded: "Rate limit exceeded",
  service_unavailable: "Public procedure service is unavailable",
  internal_error: "Unexpected server error",
};

const serializeError = async (
  dependencies: PublicProcedureDependencies,
  requestId: string,
  error: PublicProcedureHttpError
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
    const validators = await dependencies.gateway.validators;
    if (!validators.error(body)) throw new Error("Public procedure error validation failed");
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
  options: {
    retryAfterSeconds?: number;
    allow?: string;
    close?: boolean;
    cacheControl?: string;
  } = {}
): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": options.cacheControl ?? "no-store",
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
  operation: "public_procedure_v1",
  eventType,
  outcome,
  reasonCode,
  ...optional,
});

const recordAuditSafely = async (
  dependencies: PublicProcedureDependencies,
  input: PublicQueryAuditInput
): Promise<void> => {
  const tenantId = dependencies.gateway.tenantId;
  if (!tenantId) return;
  try {
    await withTenantTransaction(dependencies.gateway.transactionPool, tenantId, async (client) => {
      await dependencies.gateway.publicRepository.recordAudit(client, input);
    });
  } catch {
    // Preserve the primary safe response. Operational alerting must detect audit failures.
  }
};

const runRateGate = async (
  req: IncomingMessage,
  dependencies: PublicProcedureDependencies,
  requestId: string
): Promise<void> => {
  const gateway = dependencies.gateway;
  const tenantId = gateway.tenantId!;
  const secret = gateway.clientKeySecret!;
  const now = gateway.now().toISOString();
  const globalKey = createHash("sha256").update("public-query-global-v1", "utf8").digest("hex");
  const perClientKey = clientKey(req, secret);
  const blocked = await withTenantTransaction(gateway.transactionPool, tenantId, async (client) => {
    for (const input of [
      {
        tenantId,
        clientKeySha256: globalKey,
        operation: "public_query_global_v1" as const,
        limit: gateway.globalRateLimit,
        windowSeconds: gateway.rateWindowSeconds,
        now,
        blockedAuditId: gateway.createUuid(),
      },
      {
        tenantId,
        clientKeySha256: perClientKey,
        operation: "public_query_client_v1" as const,
        limit: gateway.rateLimit,
        windowSeconds: gateway.rateWindowSeconds,
        now,
        blockedAuditId: gateway.createUuid(),
      },
    ]) {
      const decision = await gateway.publicRepository.consumeRateLimit(client, input);
      if (!decision.allowed) {
        if (decision.shouldAudit !== false) {
          await gateway.publicRepository.recordAudit(client, audit(
            decision.auditId ?? input.blockedAuditId,
            tenantId,
            requestId,
            "public.procedure.blocked",
            "blocked",
            "rate_limit_exceeded"
          ));
        }
        return decision;
      }
    }
    return null;
  });
  if (blocked) {
    throw new PublicProcedureHttpError(
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
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || CONTROL_CHARACTER.test(normalized)) return null;
  return normalized.length > maximum ? `${normalized.slice(0, Math.max(1, maximum - 1))}…` : normalized;
};

const safePublicUrl = (value: string): boolean => {
  if (value.length < 1 || value.length > 2048 || CONTROL_CHARACTER.test(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
};

const evidenceFrom = (
  candidate: ClassifiedSearchCandidate,
  mode: PublicProcedureMode
): EvidenceItem | null => {
  const documentTitle = safeText(candidate.documentTitle, 500);
  const sourceType = safeText(candidate.documentType, 80);
  const citationLabel = safeText(candidate.citationLabel, 300);
  const excerpt = safeText(candidate.excerpt, 900);
  if (!documentTitle || !sourceType || !citationLabel || !excerpt || !safePublicUrl(candidate.sourceUrl)) {
    return null;
  }
  return {
    documentTitle,
    sourceType,
    citationLabel,
    pageStart: candidate.pageStart,
    excerpt,
    score: candidate.score,
    retrievalMode: mode,
    matchedModes: candidate.matchedModes,
    sourceUrl: candidate.sourceUrl,
  };
};

const parseMode = (value: string | null): PublicProcedureMode => {
  const mode = value?.trim() || "keyword";
  if (mode !== "keyword" && mode !== "phrase" && mode !== "hybrid") {
    throw new PublicProcedureHttpError(400, "invalid_request", "Invalid mode");
  }
  return mode;
};

const parseDepth = (value: string | null): ProcedureWorkflowDepth => {
  const depth = value?.trim() || "overview";
  if (depth !== "overview" && depth !== "deep_dive") {
    throw new PublicProcedureHttpError(400, "invalid_request", "Invalid depth");
  }
  return depth;
};

const parseLimit = (value: string | null, maximum: number): number => {
  if (value === null || value.trim() === "") return Math.min(8, maximum);
  if (!/^\d{1,2}$/.test(value)) {
    throw new PublicProcedureHttpError(400, "invalid_request", "Invalid limit");
  }
  const parsed = Number(value);
  if (parsed < 1 || parsed > maximum) {
    throw new PublicProcedureHttpError(400, "invalid_request", "Invalid limit");
  }
  return parsed;
};

const parseQuery = (value: string | null): string => {
  const query = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!query || query.length > MAX_QUERY_LENGTH || CONTROL_CHARACTER.test(query)) {
    throw new PublicProcedureHttpError(400, "invalid_request", "Invalid query");
  }
  return query;
};

const normalizeRetrievalQuery = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const RETRIEVAL_STOPWORDS = new Set([
  "para", "como", "cómo", "que", "qué", "con", "del", "las", "los", "una", "uno",
  "por", "sin", "sobre", "procedimiento", "requisitos", "documentos", "responsables",
  "aprobacion", "aprobación",
]);

const fallbackTokensFromHints = (hints: readonly string[]): string[] =>
  hints
    .flatMap((hint) => hint.split(/\s+/))
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}-]+$/gu, "").trim())
    .filter((token) => token.length >= 4 && !RETRIEVAL_STOPWORDS.has(token.toLowerCase()));

export const planPublicProcedureQueries = (
  query: string,
  classification: ProcedureQueryClassification,
  domainPack: DomainPack
): { precise: string[]; fallback: string[] } => {
  const workflowType = domainPack.workflowTypes.find((item) => item.id === classification.procedureType);
  const ruleKeywords = domainPack.classifierRules
    .filter((rule) => rule.workflowType === classification.procedureType)
    .flatMap((rule) => rule.keywords);
  const fallbackCandidates = [
    ...ruleKeywords.slice(0, 4),
    ...fallbackTokensFromHints(workflowType?.retrievalHints ?? []),
    ...ruleKeywords.slice(4),
  ];
  const seen = new Set<string>();
  const unique = (values: readonly string[], maximum: number): string[] => {
    const result: string[] = [];
    for (const value of values) {
      const trimmed = value.replace(/\s+/g, " ").trim();
      const normalized = normalizeRetrievalQuery(trimmed);
      if (!trimmed || !normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(trimmed);
      if (result.length >= maximum) break;
    }
    return result;
  };
  const precise = unique([query, ...classification.retrievalQueries], 4);
  const fallback = unique(fallbackCandidates, 10);
  return { precise, fallback };
};

const searchRequest = (
  dependencies: PublicProcedureDependencies,
  requestId: string,
  query: string,
  mode: "keyword" | "phrase",
  limit: number
): SearchExecutionRequestV1 => ({
  schema_version: "v1",
  operation: "search",
  request_id: requestId,
  tenant_id: dependencies.gateway.tenantId!,
  query,
  jurisdiction: dependencies.gateway.jurisdiction!,
  as_of_date: dependencies.gateway.now().toISOString().slice(0, 10),
  mode,
  limit,
  filters: {
    document_types: [],
    source_relations: [],
    authority_statuses: [],
    temporal_statuses: [],
    source_ids: [],
  },
});

const candidateIdentity = (candidate: ClassifiedSearchCandidate): string =>
  `${candidate.documentVersionId.toLowerCase()}:${candidate.sectionId.toLowerCase()}`;

const retrieveEvidence = async (
  dependencies: PublicProcedureDependencies,
  requestId: string,
  query: string,
  mode: PublicProcedureMode,
  limit: number
): Promise<EvidenceItem[]> => {
  const classification = classifyProcedureQuery(query, dependencies.domainPack);
  const queryPlan = planPublicProcedureQueries(query, classification, dependencies.domainPack);
  return withTenantTransaction(
    dependencies.gateway.transactionPool,
    dependencies.gateway.tenantId!,
    async (client) => {
      const merged = new Map<string, { candidate: ClassifiedSearchCandidate; rank: number }>();
      let rank = 0;
      const add = (candidate: ClassifiedSearchCandidate): void => {
        const identity = candidateIdentity(candidate);
        const current = merged.get(identity);
        if (!current || candidate.score > current.candidate.score) {
          merged.set(identity, { candidate, rank: current?.rank ?? rank });
        }
        rank += 1;
      };

      const modes: Array<"keyword" | "phrase"> = mode === "hybrid"
        ? ["keyword", "phrase"]
        : [mode];
      const runQueries = async (queries: readonly string[]): Promise<void> => {
        for (const retrievalQuery of queries) {
          for (const executionMode of modes) {
            const execution = await executeSearch(
              dependencies.gateway.searchRepository,
              client,
              searchRequest(dependencies, requestId, retrievalQuery, executionMode, limit),
              null
            );
            execution.candidates.forEach(add);
            if (merged.size >= limit) return;
          }
        }
      };

      await runQueries(queryPlan.precise);
      if (merged.size < limit) await runQueries(queryPlan.fallback);

      return [...merged.values()]
        .sort((left, right) => left.rank - right.rank || right.candidate.score - left.candidate.score)
        .map(({ candidate }) => evidenceFrom(candidate, mode))
        .filter((item): item is EvidenceItem => item !== null)
        .slice(0, limit);
    }
  );
};

const normalizeError = (error: unknown): PublicProcedureHttpError => {
  if (error instanceof PublicProcedureHttpError) return error;
  if (error instanceof PublicQueryRepositoryError) {
    return new PublicProcedureHttpError(500, "internal_error", "Unexpected server error", true);
  }
  return new PublicProcedureHttpError(500, "internal_error", "Unexpected server error", true);
};

const enabled = (dependencies: PublicProcedureDependencies): boolean => {
  const gateway = dependencies.gateway;
  return gateway.enabled
    && Boolean(gateway.tenantId)
    && Boolean(gateway.jurisdiction)
    && Boolean(gateway.clientKeySecret);
};

const rejectBrowserCredentials = (req: IncomingMessage): void => {
  if (req.headers.authorization !== undefined || req.headers.cookie !== undefined) {
    throw new PublicProcedureHttpError(400, "invalid_request", "Browser credentials are not accepted");
  }
};

export const handlePublicProcedureV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: PublicProcedureDependencies
): Promise<boolean> => {
  if (url.pathname !== PUBLIC_PROCEDURE_ROUTE && url.pathname !== PUBLIC_DOMAIN_PACK_ROUTE) {
    return false;
  }

  const requestIdentity = requestIdFor(req, dependencies.gateway.createUuid);
  const originAllowed = applyAllowedOrigin(req, res, dependencies.gateway.allowedOrigins);
  if (!originAllowed) {
    req.resume();
    const error = new PublicProcedureHttpError(403, "forbidden", "Access denied");
    send(res, 403, requestIdentity.requestId, await serializeError(dependencies, requestIdentity.requestId, error), { close: true });
    return true;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "cache-control": "no-store" });
    res.end();
    return true;
  }

  if (!enabled(dependencies)) {
    req.resume();
    const error = new PublicProcedureHttpError(503, "service_unavailable", "Public procedure service is unavailable", true);
    send(res, 503, requestIdentity.requestId, await serializeError(dependencies, requestIdentity.requestId, error));
    return true;
  }

  let requestedMode: PublicProcedureMode | undefined;
  try {
    if (req.method !== "GET") {
      throw new PublicProcedureHttpError(405, "method_not_allowed", "Method not allowed");
    }
    if (!requestIdentity.valid) {
      throw new PublicProcedureHttpError(400, "invalid_request", "X-Request-Id must be a UUID");
    }
    rejectBrowserCredentials(req);

    if (url.pathname === PUBLIC_DOMAIN_PACK_ROUTE) {
      send(
        res,
        200,
        requestIdentity.requestId,
        JSON.stringify(summarizeDomainPackForUi(dependencies.domainPack)),
        { cacheControl: "public, max-age=300, stale-while-revalidate=60" }
      );
      return true;
    }

    const query = parseQuery(url.searchParams.get("q"));
    const mode = parseMode(url.searchParams.get("mode"));
    const depth = parseDepth(url.searchParams.get("depth"));
    const limit = parseLimit(url.searchParams.get("limit"), dependencies.maxLimit);
    requestedMode = mode;
    await runRateGate(req, dependencies, requestIdentity.requestId);

    const classification = classifyProcedureQuery(query, dependencies.domainPack);
    const evidence = await retrieveEvidence(
      dependencies,
      requestIdentity.requestId,
      query,
      mode,
      limit
    );
    const workflow: ProcedureWorkflow = composeProcedureWorkflow(
      query,
      mode,
      classification,
      evidence,
      dependencies.domainPack,
      depth
    );

    await recordAuditSafely(dependencies, audit(
      dependencies.gateway.createUuid(),
      dependencies.gateway.tenantId!,
      requestIdentity.requestId,
      "public.procedure.succeeded",
      "success",
      "procedure_completed",
      { requestedMode: mode, resultCount: workflow.citations.length }
    ));
    send(res, 200, requestIdentity.requestId, JSON.stringify(workflow));
    return true;
  } catch (error) {
    req.resume();
    const normalized = normalizeError(error);
    if (!normalized.auditAlreadyRecorded) {
      await recordAuditSafely(dependencies, audit(
        dependencies.gateway.createUuid(),
        dependencies.gateway.tenantId!,
        requestIdentity.requestId,
        normalized.statusCode >= 500 ? "public.procedure.failed" : "public.procedure.blocked",
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
        ...(normalized.statusCode === 405 ? { allow: "GET, OPTIONS" } : {}),
        close: normalized.statusCode === 400 || normalized.statusCode === 403 || normalized.statusCode === 429,
      }
    );
    return true;
  }
};
