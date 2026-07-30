import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody } from "../../http.js";
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
import { buildEvidenceBundle } from "../../searchEvidence/evidenceBundle.js";
import {
  executeSearch,
  prepareSearchCapability,
  SearchCapabilityError,
  SEARCH_RESPONSE_LIMITATIONS,
  searchResultFromCandidate,
} from "../../searchEvidence/service.js";
import { deterministicUuid } from "./mapper.js";
import {
  ApiV1Error,
  buildApiError,
  forbiddenError,
  internalError,
  serializeValidatedApiError,
  unauthorizedError,
} from "./errors.js";
import {
  EVIDENCE_BUNDLES_ROUTE,
  SEARCH_ROUTE,
  SearchEvidenceRepositoryError,
  type EvidenceBundleCreateRequestV1,
  type SearchEvidenceApiDependencies,
  type SearchEvidenceAuditInput,
  type SearchEvidenceIdempotencyScope,
  type SearchEvidenceRequestV1,
  type SearchOperation,
  type SearchRequestV1,
  type SearchResponseV1,
} from "./searchEvidenceTypes.js";

const MAX_BODY_BYTES = 128 * 1024;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

type RouteKind = "search" | "evidence_bundle_create";
type ErrorStatus = 400 | 401 | 403 | 409 | 429 | 500 | 503;

interface HttpResponse {
  statusCode: 200 | ErrorStatus;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
  closeConnection?: boolean;
}

class SearchEvidenceApiError extends Error {
  constructor(
    public readonly statusCode: ErrorStatus,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly auditId?: string,
    public readonly retryAfterSeconds?: number,
    public readonly auditAlreadyRecorded = false
  ) {
    super(message);
    this.name = "SearchEvidenceApiError";
  }
}

const singleHeader = (value: string | string[] | undefined): string | null =>
  typeof value === "string" ? value : null;
const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
const canonicalJson = (value: unknown): string => {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]));
    }
    return item;
  };
  return JSON.stringify(normalize(value));
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

const contentTypeIsJson = (req: IncomingMessage): boolean => {
  const value = singleHeader(req.headers["content-type"]);
  return Boolean(value && /^application\/json(?:\s*;|$)/i.test(value));
};

const routeKind = (pathname: string): RouteKind | null => {
  if (pathname === SEARCH_ROUTE) return "search";
  if (pathname === EVIDENCE_BUNDLES_ROUTE) return "evidence_bundle_create";
  return null;
};
const operationFor = (kind: RouteKind): SearchOperation =>
  kind === "search" ? "search_v1" : "evidence_bundle_create_v1";

const sendResponse = (res: ServerResponse, response: HttpResponse): void => {
  const headers: Record<string, string | number> = {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(response.body),
    "cache-control": "no-store",
    "x-request-id": response.requestId,
  };
  if (response.retryAfterSeconds) headers["retry-after"] = response.retryAfterSeconds;
  if (response.wwwAuthenticate) headers["www-authenticate"] = WWW_AUTHENTICATE;
  if (response.closeConnection) {
    res.shouldKeepAlive = false;
    headers.connection = "close";
  }
  res.writeHead(response.statusCode, headers);
  res.end(response.body);
};

const apiErrorFor = (error: SearchEvidenceApiError): ApiV1Error => {
  if (error.code === "unauthorized") return unauthorizedError();
  if (error.code === "forbidden") return forbiddenError();
  if (error.code === "internal_error") return internalError();
  const messages: Record<string, string> = {
    invalid_request: "Request validation failed",
    idempotency_conflict: "Idempotency-Key was already used with a different request",
    request_in_progress: "An identical request with this Idempotency-Key is still in progress",
    rate_limit_exceeded: "Rate limit exceeded",
    capability_unavailable: "Requested retrieval capability is unavailable",
    replay_invalid: "Stored response could not be safely replayed",
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
  dependencies: SearchEvidenceApiDependencies,
  error: SearchEvidenceApiError,
  context: { tenantId: string | null; credentialId: string | null; requestId: string; auditId: string }
): Promise<string> => {
  const canonical = apiErrorFor(error);
  const identity = { ...context, createdAt: dependencies.now().toISOString() };
  try {
    return serializeValidatedApiError(canonical, identity, await dependencies.validators);
  } catch {
    return JSON.stringify(buildApiError(canonical, identity));
  }
};

const auditInput = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  operation: SearchOperation,
  eventType: string,
  outcome: SearchEvidenceAuditInput["outcome"],
  reasonCode: string,
  optional: Pick<SearchEvidenceAuditInput, "resultCount" | "requestedMode"> = {}
): SearchEvidenceAuditInput => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  operation,
  eventType,
  outcome,
  reasonCode,
  ...optional,
});

const normalizeError = (error: unknown): SearchEvidenceApiError => {
  if (error instanceof SearchEvidenceApiError) return error;
  if (error instanceof SearchCapabilityError) {
    return new SearchEvidenceApiError(503, "capability_unavailable", error.message, true);
  }
  if (error instanceof SecurityError) {
    return new SearchEvidenceApiError(403, "forbidden", "Access denied");
  }
  if (error instanceof SearchEvidenceRepositoryError) {
    return new SearchEvidenceApiError(500, "internal_error", "Unexpected server error", true);
  }
  return new SearchEvidenceApiError(500, "internal_error", "Unexpected server error", true);
};

const persistErrorAudit = async (
  dependencies: SearchEvidenceApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: SearchOperation,
  error: SearchEvidenceApiError
): Promise<SearchEvidenceApiError> => {
  if (error.auditAlreadyRecorded) return error;
  const auditId = error.auditId ?? dependencies.createUuid();
  try {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
      await dependencies.repository.recordAudit(client, auditInput(
        principal,
        requestId,
        auditId,
        operation,
        `integration.${operation}.failed`,
        error.statusCode >= 500 ? "error" : "blocked",
        error.code
      ));
    });
    return new SearchEvidenceApiError(
      error.statusCode,
      error.code,
      error.message,
      error.retryable,
      auditId,
      error.retryAfterSeconds,
      true
    );
  } catch {
    return new SearchEvidenceApiError(500, "internal_error", "Unexpected server error", true);
  }
};

const runRateGate = async (
  dependencies: SearchEvidenceApiDependencies,
  principal: AuthenticatedPrincipal,
  operation: SearchOperation,
  requestId: string
): Promise<void> => {
  const decision = await withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => {
      const candidateAuditId = dependencies.createUuid();
      const rate = await dependencies.repository.consumeRateLimit(client, {
        tenantId: principal.tenantId,
        principalId: principal.principalId,
        operation,
        limit: dependencies.rateLimit,
        windowSeconds: dependencies.rateWindowSeconds,
        now: dependencies.now().toISOString(),
        blockedAuditId: candidateAuditId,
      });
      if (rate.allowed) return null;
      const auditId = rate.auditId ?? candidateAuditId;
      if (rate.shouldAudit !== false) {
        await dependencies.repository.recordAudit(client, auditInput(
          principal,
          requestId,
          auditId,
          operation,
          `integration.${operation}.rate_limited`,
          "blocked",
          "rate_limit_exceeded"
        ));
      }
      return { auditId, retryAfterSeconds: rate.retryAfterSeconds };
    }
  );
  if (decision) {
    throw new SearchEvidenceApiError(
      429,
      "rate_limit_exceeded",
      "Rate limit exceeded",
      true,
      decision.auditId,
      decision.retryAfterSeconds,
      true
    );
  }
};

const requireIdentity = (
  request: SearchEvidenceRequestV1,
  principal: AuthenticatedPrincipal,
  headerRequestId: string
): void => {
  try {
    requireTenantMatch(principal, request.tenant_id);
  } catch {
    throw new SearchEvidenceApiError(403, "forbidden", "Access denied");
  }
  if (!tenantIdsEqual(request.request_id, headerRequestId)) {
    throw new SearchEvidenceApiError(400, "invalid_request", "Request identity mismatch");
  }
  if (!tenantIdsEqual(request.provenance.credential_id, principal.credentialId)) {
    throw new SearchEvidenceApiError(403, "forbidden", "Access denied");
  }
  if (!request.query.trim() || CONTROL_CHARACTER.test(request.query)) {
    throw new SearchEvidenceApiError(400, "invalid_request", "Invalid query");
  }
  if (!request.jurisdiction.trim() || CONTROL_CHARACTER.test(request.jurisdiction)) {
    throw new SearchEvidenceApiError(400, "invalid_request", "Invalid jurisdiction");
  }
};

const buildSearchResponse = (
  request: SearchRequestV1,
  principal: AuthenticatedPrincipal,
  auditId: string,
  createdAt: string,
  execution: Awaited<ReturnType<typeof executeSearch>>
): SearchResponseV1 => {
  const results = execution.candidates.map(searchResultFromCandidate);
  return {
    schema_version: "v1",
    response_type: "search_results",
    request_id: request.request_id.toLowerCase(),
    tenant_id: request.tenant_id.toLowerCase(),
    query: request.query,
    jurisdiction: request.jurisdiction,
    as_of_date: request.as_of_date,
    requested_mode: request.mode,
    executed_modes: execution.executedModes,
    result_count: results.length,
    results,
    limitations: [...SEARCH_RESPONSE_LIMITATIONS],
    provenance: {
      source_product: "la_muni_rag",
      generated_by: "system",
      created_at: createdAt,
      source_refs: [...new Set(results.map((result) => `source:${result.source_id}`))],
      credential_id: principal.credentialId,
      audit_id: auditId,
    },
  };
};

const executeSearchRequest = async (
  dependencies: SearchEvidenceApiDependencies,
  principal: AuthenticatedPrincipal,
  request: SearchRequestV1
): Promise<string> => {
  // Query embedding is an external network capability. Resolve it before
  // opening the transaction-local tenant context so provider latency never
  // holds a PostgreSQL transaction or connection.
  const preparedSemantic = await prepareSearchCapability(
    request,
    dependencies.queryEmbeddingProvider
  );
  return withTenantTransaction(
    dependencies.transactionPool,
    principal.tenantId,
    async (client) => {
      const auditId = dependencies.createUuid();
      const createdAt = dependencies.now().toISOString();
      const execution = await executeSearch(
        dependencies.repository,
        client,
        request,
        preparedSemantic
      );
      const response = buildSearchResponse(request, principal, auditId, createdAt, execution);
      const validators = await dependencies.validators;
      if (!validators.searchResponse(response)) {
        throw new Error("Generated search response failed the canonical v1 contract");
      }
      await dependencies.repository.recordAudit(client, auditInput(
        principal,
        request.request_id,
        auditId,
        "search_v1",
        "integration.search_v1.succeeded",
        "success",
        "search_completed",
        { resultCount: response.result_count, requestedMode: request.mode }
      ));
      return JSON.stringify(response);
    }
  );
};

const safePublicHttpUrl = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) {
      return false;
    }
    for (const key of parsed.searchParams.keys()) {
      const normalized = key.toLowerCase();
      if (
        ["access_token", "token", "sig", "signature", "api_key", "key", "auth", "se", "sp"].includes(normalized)
        || normalized.startsWith("x-amz-")
        || normalized.startsWith("x-goog-")
      ) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const validStoredBundle = async (
  dependencies: SearchEvidenceApiDependencies,
  request: EvidenceBundleCreateRequestV1,
  principal: AuthenticatedPrincipal,
  claim: Extract<Awaited<ReturnType<SearchEvidenceApiDependencies["repository"]["claimIdempotency"]>>, { kind: "replay" }>
): Promise<boolean> => {
  if (
    claim.responseStatus !== 200
    || !isCanonicalUuid(claim.auditId)
    || sha256(claim.responseBody) !== claim.responseSha256
  ) return false;
  let parsed: unknown;
  try { parsed = JSON.parse(claim.responseBody); } catch { return false; }
  const validators = await dependencies.validators;
  if (!validators.evidenceBundle(parsed) || !parsed || typeof parsed !== "object") return false;
  const body = parsed as {
    evidence_bundle_id?: unknown;
    tenant_id?: unknown;
    request_id?: unknown;
    query?: unknown;
    jurisdiction?: unknown;
    sources?: Array<{
      source_id?: unknown;
      document_id?: unknown;
      document_version_id?: unknown;
      authority_status?: unknown;
      source_url?: unknown;
    }>;
    citations?: Array<{
      citation_id?: unknown;
      source_id?: unknown;
      document_version_id?: unknown;
      section_id?: unknown;
      label?: unknown;
      excerpt?: unknown;
      source_url?: unknown;
      authority_status?: unknown;
      evidence_status?: unknown;
    }>;
    claims?: Array<{
      claim_id?: unknown;
      text?: unknown;
      citation_refs?: unknown;
      evidence_status?: unknown;
    }>;
    contradictions?: Array<{ claim_refs?: unknown }>;
    provenance?: {
      credential_id?: unknown;
      audit_id?: unknown;
      source_refs?: unknown;
    };
  };
  if (
    body.evidence_bundle_id !== deterministicUuid(`evidence-bundle:${request.tenant_id}:${request.request_id}`)
    || !tenantIdsEqual(String(body.tenant_id ?? ""), request.tenant_id)
    || !tenantIdsEqual(String(body.request_id ?? ""), request.request_id)
    || body.query !== request.query
    || body.jurisdiction !== request.jurisdiction
    || !tenantIdsEqual(String(body.provenance?.credential_id ?? ""), principal.credentialId)
    || !tenantIdsEqual(String(body.provenance?.audit_id ?? ""), claim.auditId)
  ) return false;

  const sourceRows = body.sources ?? [];
  const sources = new Map(sourceRows.map((source) => [String(source.source_id ?? ""), source]));
  if (sources.size !== sourceRows.length) return false;
  for (const [sourceId, source] of sources) {
    if (
      !isCanonicalUuid(sourceId)
      || !isCanonicalUuid(source.document_id)
      || !isCanonicalUuid(source.document_version_id)
      || !safePublicHttpUrl(source.source_url)
    ) return false;
  }

  const citationRows = body.citations ?? [];
  const citations = new Map(citationRows.map((citation) => [String(citation.citation_id ?? ""), citation]));
  if (citations.size !== citationRows.length) return false;
  for (const [citationId, citation] of citations) {
    const source = sources.get(String(citation.source_id ?? ""));
    if (
      !source
      || !isCanonicalUuid(citationId)
      || !isCanonicalUuid(citation.document_version_id)
      || !isCanonicalUuid(citation.section_id)
      || citationId !== deterministicUuid(
        `evidence-citation:${request.tenant_id}:${String(citation.document_version_id)}:${String(citation.section_id)}:${String(citation.label ?? "")}`
      )
      || citation.document_version_id !== source.document_version_id
      || citation.authority_status !== source.authority_status
      || citation.source_url !== source.source_url
      || !safePublicHttpUrl(citation.source_url)
      || typeof citation.excerpt !== "string"
      || citation.excerpt.length < 1
    ) return false;
  }

  const claims = body.claims ?? [];
  const claimIds = new Set<string>();
  const inferredClaimIds = new Set<string>();
  for (const claimItem of claims) {
    const claimId = String(claimItem.claim_id ?? "");
    const refs = Array.isArray(claimItem.citation_refs) ? claimItem.citation_refs.map(String) : [];
    if (
      !isCanonicalUuid(claimId)
      || claimIds.has(claimId)
      || refs.length !== 1
      || !citations.has(refs[0]!)
      || (claimItem.evidence_status !== "supported" && claimItem.evidence_status !== "inferred_for_review")
    ) return false;
    const citation = citations.get(refs[0]!)!;
    const source = sources.get(String(citation.source_id ?? ""))!;
    if (claimItem.text !== citation.excerpt) return false;
    if (claimItem.evidence_status === "supported") {
      if (
        citation.evidence_status !== "supported"
        || (source.authority_status !== "official_target_jurisdiction"
          && source.authority_status !== "official_national")
        || claimId !== deterministicUuid(
          `evidence-claim:${request.tenant_id}:${request.request_id}:${refs[0]}`
        )
      ) return false;
    } else {
      if (claimId !== deterministicUuid(
        `evidence-conflict-claim:${request.tenant_id}:${request.request_id}:${refs[0]}`
      )) return false;
      inferredClaimIds.add(claimId);
    }
    claimIds.add(claimId);
  }

  const contradictedClaimIds = new Set<string>();
  for (const contradiction of body.contradictions ?? []) {
    const refs = Array.isArray(contradiction.claim_refs) ? contradiction.claim_refs.map(String) : [];
    if (
      refs.length < 2
      || new Set(refs).size !== refs.length
      || refs.some((ref) => !inferredClaimIds.has(ref))
    ) return false;
    refs.forEach((ref) => contradictedClaimIds.add(ref));
  }
  if ([...inferredClaimIds].some((claimId) => !contradictedClaimIds.has(claimId))) return false;

  const expectedSourceRefs = [...sources.keys()].map((sourceId) => `source:${sourceId}`).sort();
  const actualSourceRefs = Array.isArray(body.provenance?.source_refs)
    ? body.provenance.source_refs.map(String).sort()
    : [];
  return JSON.stringify(actualSourceRefs) === JSON.stringify(expectedSourceRefs);
};

const idempotencyScope = (
  dependencies: SearchEvidenceApiDependencies,
  request: EvidenceBundleCreateRequestV1,
  principal: AuthenticatedPrincipal,
  key: string
): SearchEvidenceIdempotencyScope => {
  const now = dependencies.now().toISOString();
  return {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    operation: "evidence_bundle_create_v1",
    idempotencyKeySha256: sha256(key),
    requestSha256: sha256(canonicalJson(request)),
    now,
    expiresAt: new Date(Date.parse(now) + dependencies.idempotencyTtlSeconds * 1000).toISOString(),
  };
};

const executeBundleRequest = async (
  dependencies: SearchEvidenceApiDependencies,
  principal: AuthenticatedPrincipal,
  request: EvidenceBundleCreateRequestV1,
  idempotencyKey: string
): Promise<string> => {
  const scope = idempotencyScope(dependencies, request, principal, idempotencyKey);
  let claimedNew = false;
  try {
    // Claim or resolve exact replay in a short transaction before invoking any
    // external embedding provider. Replays therefore never depend on provider
    // availability and new work does not hold database locks across the call.
    const claimResult = await withTenantTransaction(
      dependencies.transactionPool,
      principal.tenantId,
      async (client) => {
        const claim = await dependencies.repository.claimIdempotency(client, scope);
        if (claim.kind === "conflict") {
          throw new SearchEvidenceApiError(409, "idempotency_conflict", "Idempotency conflict");
        }
        if (claim.kind === "processing") {
          throw new SearchEvidenceApiError(409, "request_in_progress", "Request in progress", true);
        }
        if (claim.kind === "replay") {
          if (!await validStoredBundle(dependencies, request, principal, claim)) {
            await dependencies.repository.invalidateCompletedIdempotency(client, scope);
            return { kind: "replay_invalid" as const };
          }
          return { kind: "body" as const, body: claim.responseBody };
        }
        return { kind: "new" as const };
      }
    );

    if (claimResult.kind === "replay_invalid") {
      throw new SearchEvidenceApiError(500, "replay_invalid", "Stored response invalid", true);
    }
    if (claimResult.kind === "body") return claimResult.body;
    claimedNew = true;

    const preparedSemantic = await prepareSearchCapability(
      request,
      dependencies.queryEmbeddingProvider
    );
    return await withTenantTransaction(
      dependencies.transactionPool,
      principal.tenantId,
      async (client) => {
        const auditId = dependencies.createUuid();
        const createdAt = dependencies.now().toISOString();
        const execution = await executeSearch(
          dependencies.repository,
          client,
          request,
          preparedSemantic
        );
        const bundle = buildEvidenceBundle({
          request,
          candidates: execution.candidates,
          auditId,
          credentialId: principal.credentialId,
          createdAt,
        });
        const validators = await dependencies.validators;
        if (!validators.evidenceBundle(bundle)) {
          throw new Error("Generated EvidenceBundle failed the canonical v1 contract");
        }
        const body = JSON.stringify(bundle);
        await dependencies.repository.recordAudit(client, auditInput(
          principal,
          request.request_id,
          auditId,
          "evidence_bundle_create_v1",
          "integration.evidence_bundle_create_v1.succeeded",
          "success",
          "evidence_bundle_generated",
          { resultCount: execution.candidates.length, requestedMode: request.mode }
        ));
        await dependencies.repository.completeIdempotency(client, {
          ...scope,
          responseStatus: 200,
          responseBody: body,
          responseSha256: sha256(body),
          auditId,
          completedAt: createdAt,
        });
        return body;
      }
    );
  } catch (error) {
    if (claimedNew) {
      try {
        await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
          await dependencies.repository.releaseIdempotency(client, scope);
        });
      } catch { /* preserve the original safe error; stale claims expire and are retryable */ }
    }
    throw error;
  }
};

export const handleSearchEvidenceV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  dependencies: SearchEvidenceApiDependencies
): Promise<boolean> => {
  const kind = routeKind(pathname);
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
    try { auditId = await dependencies.repository.recordAuthenticationFailure(auditId, reasonCode); }
    catch { /* preserve uniform authentication response */ }
    req.resume();
    sendResponse(res, {
      statusCode: 401,
      body: await errorBody(dependencies, new SearchEvidenceApiError(401, "unauthorized", "Authentication required"), {
        tenantId: null,
        credentialId: null,
        requestId: headerRequestId.requestId,
        auditId,
      }),
      requestId: headerRequestId.requestId,
      wwwAuthenticate: true,
      closeConnection: true,
    });
    return true;
  }

  const operation = operationFor(kind);
  try {
    requirePermission(principal, "evidence:query");
    if (req.method !== "POST") {
      throw new SearchEvidenceApiError(400, "invalid_request", "Only POST is supported");
    }
    if (!headerRequestId.valid) {
      throw new SearchEvidenceApiError(400, "invalid_request", "X-Request-Id must be a UUID");
    }
    await runRateGate(dependencies, principal, operation, headerRequestId.requestId);
    if (!contentTypeIsJson(req)) {
      throw new SearchEvidenceApiError(400, "invalid_request", "Content-Type must be application/json");
    }
    const idempotencyKey = kind === "evidence_bundle_create"
      ? singleHeader(req.headers["idempotency-key"])
      : null;
    if (kind === "evidence_bundle_create" && (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey))) {
      throw new SearchEvidenceApiError(400, "invalid_request", "Invalid Idempotency-Key");
    }
    let parsed: unknown;
    try { parsed = await readJsonBody(req, MAX_BODY_BYTES); }
    catch { throw new SearchEvidenceApiError(400, "invalid_request", "Request body must be valid JSON"); }
    const validators = await dependencies.validators;
    const validator = kind === "search" ? validators.searchRequest : validators.evidenceBundleRequest;
    if (!validator(parsed)) {
      throw new SearchEvidenceApiError(400, "invalid_request", "Request validation failed");
    }
    const request = parsed as SearchEvidenceRequestV1;
    if (
      (kind === "search" && request.operation !== "search")
      || (kind === "evidence_bundle_create" && request.operation !== "evidence_bundle_create")
    ) throw new SearchEvidenceApiError(400, "invalid_request", "Operation does not match route");
    requireIdentity(request, principal, headerRequestId.requestId);

    const body = kind === "search"
      ? await executeSearchRequest(dependencies, principal, request as SearchRequestV1)
      : await executeBundleRequest(
          dependencies,
          principal,
          request as EvidenceBundleCreateRequestV1,
          idempotencyKey!
        );
    sendResponse(res, { statusCode: 200, body, requestId: headerRequestId.requestId });
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
      closeConnection: audited.statusCode === 400 || audited.statusCode === 403 || audited.statusCode === 429,
    });
    return true;
  }
};
