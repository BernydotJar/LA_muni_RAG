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
  type SecurityPermission,
  type TenantTransactionClient,
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
  CatalogRepositoryError,
  DOCUMENTS_ROUTE,
  PROCEDURES_ROUTE,
  SOURCES_ROUTE,
  type CatalogApiDependencies,
  type CatalogAuditInput,
  type CatalogCursor,
  type CatalogIdempotencyScope,
  type CatalogListInput,
  type CatalogOperation,
  type CatalogPageResponseV1,
  type CatalogProvenanceV1,
  type DocumentCreateRequestV1,
  type DocumentItemV1,
  type DocumentPageResponseV1,
  type DocumentResponseV1,
  type IngestionJobPageResponseV1,
  type IngestionJobSummaryV1,
  type ProcedurePageResponseV1,
  type ProcedureSummaryV1,
  type SafeIngestionJobState,
  type SourceCreateRequestV1,
  type SourceItemV1,
  type SourcePageResponseV1,
  type SourceResponseV1,
  type StoredDocument,
  type StoredIngestionJobSummary,
  type StoredProcedureSummary,
  type StoredSource,
} from "./catalogTypes.js";
import { INGESTION_JOBS_ROUTE } from "./ingestionTypes.js";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const WWW_AUTHENTICATE = 'Bearer realm="la-muni-rag"';
const MAX_BODY_BYTES = 128 * 1024;
const COMPARATIVE_WARNING =
  "Referencia comparativa de otra municipalidad. No define por sí sola el procedimiento oficial de La Antigua Guatemala. Requiere corroboración con fuente nacional o de La Antigua Guatemala.";

type RouteKind = "source_create" | "source_list" | "document_create" | "document_list" | "ingestion_job_list" | "procedure_list";
type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;

interface CatalogHttpResponse {
  statusCode: 200 | 201 | ErrorStatus;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
  closeConnection?: boolean;
}

class CatalogApiError extends Error {
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
    this.name = "CatalogApiError";
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
  if (pathname === SOURCES_ROUTE) {
    if (req.method === "POST") return "source_create";
    if (req.method === "GET") return "source_list";
  }
  if (pathname === DOCUMENTS_ROUTE) {
    if (req.method === "POST") return "document_create";
    if (req.method === "GET") return "document_list";
  }
  if (pathname === INGESTION_JOBS_ROUTE && req.method === "GET") return "ingestion_job_list";
  if (pathname === PROCEDURES_ROUTE && req.method === "GET") return "procedure_list";
  return null;
};

const operationFor = (kind: RouteKind): CatalogOperation => `${kind}_v1`;
const isWrite = (kind: RouteKind): boolean => kind === "source_create" || kind === "document_create";
const permissionFor = (kind: RouteKind): SecurityPermission => {
  if (kind === "source_create") return "source:write";
  if (kind === "source_list") return "source:read";
  if (kind === "document_create") return "document:write";
  if (kind === "document_list") return "document:read";
  if (kind === "ingestion_job_list") return "document:ingest";
  return "procedure:read";
};
const entityTableFor = (kind: RouteKind): string => {
  if (kind.startsWith("source")) return "sources";
  if (kind.startsWith("document")) return "documents";
  if (kind === "ingestion_job_list") return "ingestion_jobs";
  return "procedures";
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
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const assertPublicUrlHasNoEmbeddedCredential = (value: string | null): void => {
  if (value === null) return;
  let url: URL;
  try { url = new URL(value); }
  catch { throw new CatalogApiError(400, "invalid_request", "Invalid public URL"); }
  if (url.username || url.password) {
    throw new CatalogApiError(400, "invalid_request", "Public URL cannot contain credentials");
  }
  const sensitiveNames = new Set([
    "access_token", "token", "sig", "signature", "api_key", "key", "auth", "se", "sp",
  ]);
  for (const name of url.searchParams.keys()) {
    const normalized = name.toLowerCase();
    if (sensitiveNames.has(normalized) || normalized.startsWith("x-amz-") || normalized.startsWith("x-goog-")) {
      throw new CatalogApiError(400, "invalid_request", "Public URL cannot contain temporary credentials");
    }
  }
};

const sendResponse = (res: ServerResponse, response: CatalogHttpResponse): void => {
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

const apiErrorFor = (error: CatalogApiError): ApiV1Error => {
  if (error.code === "unauthorized") return unauthorizedError();
  if (error.code === "forbidden") return forbiddenError();
  if (error.code === "not_found") return notFoundError();
  if (error.code === "internal_error") return internalError();
  const messages: Record<string, string> = {
    invalid_request: "Request validation failed",
    idempotency_conflict: "Idempotency-Key was already used with a different request",
    request_in_progress: "An identical request with this Idempotency-Key is still in progress",
    source_conflict: "Source registration conflicts with an existing source",
    document_conflict: "Document registration conflicts with an existing document",
    rate_limit_exceeded: "Rate limit exceeded",
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
  dependencies: CatalogApiDependencies,
  error: CatalogApiError,
  context: { tenantId: string | null; credentialId: string | null; requestId: string; auditId: string }
): Promise<string> => {
  const identity = { ...context, createdAt: dependencies.now().toISOString() };
  try {
    const validators = await dependencies.validators;
    return serializeValidatedApiError(apiErrorFor(error), identity, validators);
  } catch {
    return JSON.stringify(buildApiError(apiErrorFor(error), identity));
  }
};

const normalizeError = (error: unknown): CatalogApiError => {
  if (error instanceof CatalogApiError) return error;
  if (error instanceof CatalogRepositoryError) {
    if (error.code === "not_found") return new CatalogApiError(404, "not_found", "Resource not found");
    return error.code === "duplicate_source"
      ? new CatalogApiError(409, "source_conflict", error.message)
      : new CatalogApiError(409, "document_conflict", error.message);
  }
  if (error instanceof SecurityError) {
    return error.statusCode === 401
      ? new CatalogApiError(401, "unauthorized", "Authentication required")
      : new CatalogApiError(403, "forbidden", "Access denied");
  }
  if (error instanceof HttpError) return new CatalogApiError(400, "invalid_request", "Request validation failed");
  return new CatalogApiError(500, "internal_error", "Unexpected server error", true);
};

const provenance = (
  principal: AuthenticatedPrincipal,
  auditId: string,
  createdAt: string,
  sourceRefs: string[]
): CatalogProvenanceV1 => ({
  source_product: "la_muni_rag",
  generated_by: "system",
  created_at: createdAt,
  source_refs: sourceRefs,
  credential_id: principal.credentialId,
  audit_id: auditId,
});

const sourceItem = (record: StoredSource): SourceItemV1 => ({
  source_id: record.sourceId,
  source_key: record.sourceKey,
  title: record.title,
  category: record.category,
  target_jurisdiction: record.targetJurisdiction,
  source_jurisdiction: record.sourceJurisdiction,
  source_relation: record.sourceRelation,
  discovery_status: record.discoveryStatus,
  discovery_url: record.discoveryUrl,
  artifact_url: record.artifactUrl,
  observed_version: record.observedVersion,
  publication_date: record.publicationDate,
  effective_date: record.effectiveDate,
  limitations: record.limitations,
  validation_state: record.validationState,
  official_source: record.officialSource,
  official_for_target_jurisdiction: record.officialForTargetJurisdiction,
  acquisition_state: record.acquisitionState,
  ingestion_state: record.ingestionState,
  retrieval_state: record.retrievalState,
  created_by_principal_id: record.createdByPrincipalId,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const documentItem = (record: StoredDocument): DocumentItemV1 => ({
  document_id: record.documentId,
  source_id: record.sourceId,
  title: record.title,
  document_type: record.documentType,
  document_scope: record.documentScope,
  issuing_authority: record.issuingAuthority,
  official_source: record.officialSource,
  document_status: record.documentStatus,
  confidentiality: record.confidentiality,
  registered_by_principal_id: record.registeredByPrincipalId,
  created_at: record.createdAt,
  updated_at: record.updatedAt,
  version: {
    document_version_id: record.version.documentVersionId,
    version_label: record.version.versionLabel,
    source_url: record.version.sourceUrl,
    original_filename: record.version.originalFilename,
    mime_type: record.version.mimeType,
    content_sha256: record.version.contentSha256,
    page_count: record.version.pageCount,
    extraction_state: record.version.extractionState,
    created_at: record.version.createdAt,
  },
  artifact_acceptance: {
    state: record.artifactAcceptance.state,
    artifact_object_id: record.artifactAcceptance.artifactObjectId,
    artifact_scan_id: record.artifactAcceptance.artifactScanId,
    accepted_until: record.artifactAcceptance.acceptedUntil,
  },
  ingestion_state: record.ingestionState,
  retrieval_state: record.retrievalState,
});

const safeJobState = (job: StoredIngestionJobSummary, now: string): SafeIngestionJobState => {
  if (job.status === "queued" && job.lastErrorRetryable === true && Date.parse(job.availableAt) > Date.parse(now)) {
    return "retry_wait";
  }
  return job.status;
};
const ingestionJobItem = (job: StoredIngestionJobSummary, now: string): IngestionJobSummaryV1 => ({
  job_id: job.jobId,
  document_version_id: job.documentVersionId,
  status: safeJobState(job, now),
  attempt_count: job.attemptCount,
  max_attempts: job.maxAttempts,
  available_at: job.availableAt,
  started_at: job.startedAt ?? null,
  finished_at: job.finishedAt ?? null,
  last_error_code: job.lastErrorCode,
  last_error_retryable: job.lastErrorRetryable,
  created_at: job.createdAt,
  updated_at: job.updatedAt,
});
const procedureItem = (record: StoredProcedureSummary): ProcedureSummaryV1 => ({
  procedure_id: record.procedureId,
  procedure_key: record.procedureKey,
  title: record.title,
  jurisdiction: record.jurisdiction,
  latest_version_number: record.latestVersionNumber,
  latest_lifecycle_status: record.latestLifecycleStatus,
  approved_workflow_version_id: record.approvedWorkflowVersionId,
  approved_version_number: record.approvedVersionNumber,
  approval_state: record.approvedWorkflowVersionId ? "approved" : "unapproved",
  created_at: record.createdAt,
  updated_at: record.updatedAt,
});

const auditInput = (
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  operation: CatalogOperation,
  kind: RouteKind,
  outcome: CatalogAuditInput["outcome"],
  reasonCode: string,
  entityId: string | null
): CatalogAuditInput => ({
  auditId,
  tenantId: principal.tenantId,
  principalId: principal.principalId,
  credentialId: principal.credentialId,
  requestId,
  operation,
  eventType: `rag.catalog.${kind}`,
  entityTable: entityTableFor(kind),
  entityId,
  outcome,
  reasonCode,
});

const encodeCursor = (cursor: CatalogCursor | null): string | null => cursor
  ? Buffer.from(JSON.stringify({ created_at: cursor.createdAt, id: cursor.id }), "utf8").toString("base64url")
  : null;
const parseCursor = (value: string | null): CatalogCursor | null => {
  if (!value) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new CatalogApiError(400, "invalid_request", "Invalid cursor");
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>;
    if (Object.keys(parsed).sort().join(",") !== "created_at,id"
      || typeof parsed.created_at !== "string"
      || !Number.isFinite(Date.parse(parsed.created_at))
      || !isCanonicalUuid(parsed.id)) {
      throw new Error("invalid cursor shape");
    }
    return { createdAt: new Date(parsed.created_at).toISOString(), id: parsed.id.toLowerCase() };
  } catch {
    throw new CatalogApiError(400, "invalid_request", "Invalid cursor");
  }
};
const parseLimit = (value: string | null): number => {
  if (!value) return 25;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 100) {
    throw new CatalogApiError(400, "invalid_request", "Invalid limit");
  }
  return number;
};

const FILTERS: Record<Exclude<RouteKind, "source_create" | "document_create">, readonly string[]> = {
  source_list: ["discovery_status", "source_relation", "category"],
  document_list: ["document_type", "confidentiality", "source_id", "document_status"],
  ingestion_job_list: ["document_version_id", "status"],
  procedure_list: ["lifecycle_status"],
};
const parseListInput = (
  url: URL,
  kind: Exclude<RouteKind, "source_create" | "document_create">,
  principal: AuthenticatedPrincipal
): CatalogListInput => {
  const allowed = new Set(["tenant_id", "limit", "cursor", ...FILTERS[kind]]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) {
      throw new CatalogApiError(400, "invalid_request", "Invalid query parameters");
    }
  }
  const tenantId = url.searchParams.get("tenant_id")?.trim();
  if (!tenantId || !isCanonicalUuid(tenantId)) throw new CatalogApiError(400, "invalid_request", "tenant_id is required");
  requireTenantMatch(principal, tenantId);
  const filters: Record<string, string> = {};
  for (const name of FILTERS[kind]) {
    const value = url.searchParams.get(name)?.trim();
    if (value) filters[name] = value;
  }
  for (const name of ["source_id", "document_version_id"]) {
    if (filters[name] && !isCanonicalUuid(filters[name])) throw new CatalogApiError(400, "invalid_request", `Invalid ${name}`);
  }
  return {
    tenantId: principal.tenantId,
    limit: parseLimit(url.searchParams.get("limit")),
    cursor: parseCursor(url.searchParams.get("cursor")),
    filters,
  };
};

const validateListFilters = (kind: RouteKind, filters: Record<string, string>): void => {
  const enums: Record<string, readonly string[]> = {
    discovery_status: ["identified", "access_blocked", "unverified", "missing_source"],
    source_relation: ["target", "national", "comparative", "unknown"],
    category: ["constitution", "national_law", "national_regulation", "planning", "budget", "organization", "procedure_manual", "function_manual", "council_record", "form", "community_record", "public_portal", "other"],
    document_type: ["constitution", "law", "decree", "regulation", "municipal_agreement", "council_minutes", "plan", "manual", "procedure", "form", "guide", "jurisprudence", "other"],
    confidentiality: ["public", "internal", "confidential", "restricted"],
    document_status: ["draft", "active", "superseded", "repealed", "archived", "unknown"],
    status: ["queued", "processing", "processed", "failed", "superseded", "cancelled"],
    lifecycle_status: ["draft", "in_review", "approved", "superseded", "archived"],
  };
  for (const [key, value] of Object.entries(filters)) {
    if (enums[key] && !enums[key].includes(value)) {
      throw new CatalogApiError(400, "invalid_request", `Invalid ${key}`);
    }
  }
  void kind;
};

const persistErrorAudit = async (
  dependencies: CatalogApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  operation: CatalogOperation,
  kind: RouteKind,
  error: CatalogApiError
): Promise<CatalogApiError> => {
  const auditId = error.auditId ?? dependencies.createUuid();
  if (error.auditAlreadyRecorded) return error;
  try {
    await withTenantTransaction(dependencies.transactionPool, principal.tenantId, (client) =>
      dependencies.repository.recordAudit(client, auditInput(
        principal, requestId, auditId, operation, kind,
        error.statusCode >= 500 ? "error" : "blocked",
        error.code, null
      ))
    );
    return new CatalogApiError(
      error.statusCode, error.code, error.message, error.retryable, auditId, error.retryAfterSeconds, true
    );
  } catch {
    return new CatalogApiError(500, "internal_error", "Unexpected server error", true, dependencies.createUuid());
  }
};

const runRateGate = async (
  dependencies: CatalogApiDependencies,
  principal: AuthenticatedPrincipal,
  operation: CatalogOperation,
  requestId: string,
  kind: RouteKind
): Promise<void> => {
  const blockedAuditId = dependencies.createUuid();
  const rate = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const decision = await dependencies.repository.consumeRateLimit(client, {
      tenantId: principal.tenantId,
      principalId: principal.principalId,
      operation,
      limit: dependencies.rateLimit,
      windowSeconds: dependencies.rateWindowSeconds,
      now: dependencies.now().toISOString(),
      blockedAuditId,
    });
    if (!decision.allowed && decision.shouldAudit) {
      await dependencies.repository.recordAudit(client, auditInput(
        principal,
        requestId,
        decision.auditId ?? blockedAuditId,
        operation,
        kind,
        "blocked",
        "rate_limit_exceeded",
        null
      ));
    }
    return decision;
  });
  if (!rate.allowed) {
    throw new CatalogApiError(
      429, "rate_limit_exceeded", "Rate limit exceeded", true,
      rate.auditId ?? blockedAuditId, rate.retryAfterSeconds, true
    );
  }
  void requestId;
  void kind;
};

const executeList = async (
  dependencies: CatalogApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  kind: Exclude<RouteKind, "source_create" | "document_create">,
  input: CatalogListInput
): Promise<string> => {
  const auditId = dependencies.createUuid();
  const createdAt = dependencies.now().toISOString();
  const operation = operationFor(kind);
  return withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    let response: SourcePageResponseV1 | DocumentPageResponseV1 | IngestionJobPageResponseV1 | ProcedurePageResponseV1;
    let refs: string[];
    const validators = await dependencies.validators;
    if (kind === "source_list") {
      const page = await dependencies.repository.listSources(client, input);
      refs = page.items.map((item) => item.sourceId);
      response = {
        schema_version: "v1", response_type: "source_catalog_page", request_id: requestId,
        tenant_id: principal.tenantId, items: page.items.map(sourceItem), next_cursor: encodeCursor(page.nextCursor),
        provenance: provenance(principal, auditId, createdAt, refs),
      };
      if (!validators.sourcePage(response)) throw new Error("source catalog page contract failure");
    } else if (kind === "document_list") {
      const page = await dependencies.repository.listDocuments(client, input);
      refs = page.items.map((item) => item.documentId);
      response = {
        schema_version: "v1", response_type: "document_catalog_page", request_id: requestId,
        tenant_id: principal.tenantId, items: page.items.map(documentItem), next_cursor: encodeCursor(page.nextCursor),
        provenance: provenance(principal, auditId, createdAt, refs),
      };
      if (!validators.documentPage(response)) throw new Error("document catalog page contract failure");
    } else if (kind === "ingestion_job_list") {
      const page = await dependencies.repository.listIngestionJobs(client, input);
      refs = page.items.map((item) => item.jobId);
      response = {
        schema_version: "v1", response_type: "ingestion_job_catalog_page", request_id: requestId,
        tenant_id: principal.tenantId, items: page.items.map((item) => ingestionJobItem(item, createdAt)),
        next_cursor: encodeCursor(page.nextCursor), provenance: provenance(principal, auditId, createdAt, refs),
      };
      if (!validators.ingestionJobPage(response)) throw new Error("ingestion job page contract failure");
    } else {
      const page = await dependencies.repository.listProcedures(client, input);
      refs = page.items.map((item) => item.procedureId);
      response = {
        schema_version: "v1", response_type: "procedure_catalog_page", request_id: requestId,
        tenant_id: principal.tenantId, items: page.items.map(procedureItem), next_cursor: encodeCursor(page.nextCursor),
        provenance: provenance(principal, auditId, createdAt, refs),
      };
      if (!validators.procedurePage(response)) throw new Error("procedure catalog page contract failure");
    }
    await dependencies.repository.recordAudit(client, auditInput(
      principal, requestId, auditId, operation, kind, "success", `${kind}_success`, null
    ));
    return JSON.stringify(response);
  });
};

const requireRequestIdentity = (
  request: SourceCreateRequestV1 | DocumentCreateRequestV1,
  requestId: string,
  principal: AuthenticatedPrincipal
): void => {
  if (!tenantIdsEqual(request.request_id, requestId)
    || !tenantIdsEqual(request.tenant_id, principal.tenantId)
    || !tenantIdsEqual(request.provenance.credential_id, principal.credentialId)) {
    throw new CatalogApiError(403, "forbidden", "Access denied");
  }
};

const sourceResponse = (
  record: StoredSource,
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  createdAt: string
): SourceResponseV1 => ({
  schema_version: "v1",
  response_type: "source_catalog_item",
  request_id: requestId,
  tenant_id: principal.tenantId,
  source: sourceItem(record),
  provenance: provenance(principal, auditId, createdAt, [record.sourceId]),
});
const documentResponse = (
  record: StoredDocument,
  principal: AuthenticatedPrincipal,
  requestId: string,
  auditId: string,
  createdAt: string
): DocumentResponseV1 => ({
  schema_version: "v1",
  response_type: "document_catalog_item",
  request_id: requestId,
  tenant_id: principal.tenantId,
  document: documentItem(record),
  limitations: [
    "A registered digest does not prove acquisition, clean malware scan, extraction, ingestion, retrieval quality, validity or legal applicability.",
  ],
  provenance: provenance(principal, auditId, createdAt, [record.sourceId, record.documentId, record.version.documentVersionId]),
});

const sourceLimitations = (request: SourceCreateRequestV1): string[] =>
  request.source_relation === "comparative"
    ? [...new Set([...request.limitations, COMPARATIVE_WARNING])]
    : [...request.limitations];

const initialSourceFromReplay = (
  request: SourceCreateRequestV1,
  response: SourceResponseV1,
  principal: AuthenticatedPrincipal
): StoredSource => ({
  sourceId: response.source.source_id,
  tenantId: principal.tenantId,
  sourceKey: request.source_key,
  title: request.title,
  category: request.category,
  targetJurisdiction: request.target_jurisdiction,
  sourceJurisdiction: request.source_jurisdiction,
  sourceRelation: request.source_relation,
  discoveryStatus: request.discovery_status,
  discoveryUrl: request.discovery_url,
  artifactUrl: request.artifact_url,
  observedVersion: request.observed_version,
  publicationDate: request.publication_date,
  effectiveDate: request.effective_date,
  limitations: sourceLimitations(request),
  validationState: "unreviewed",
  officialSource: false,
  officialForTargetJurisdiction: false,
  acquisitionState: "not_acquired",
  ingestionState: "not_ingested",
  retrievalState: "not_indexed",
  createdByPrincipalId: principal.principalId,
  createdAt: response.source.created_at,
  updatedAt: response.source.created_at,
});

const initialDocumentFromReplay = (
  request: DocumentCreateRequestV1,
  response: DocumentResponseV1,
  principal: AuthenticatedPrincipal,
  persisted: StoredDocument
): StoredDocument => ({
  documentId: response.document.document_id,
  tenantId: principal.tenantId,
  sourceId: request.source_id,
  title: request.title,
  documentType: request.document_type,
  documentScope: request.document_scope,
  issuingAuthority: request.issuing_authority,
  officialSource: persisted.officialSource,
  documentStatus: "draft",
  confidentiality: request.confidentiality,
  registeredByPrincipalId: principal.principalId,
  createdAt: response.document.created_at,
  updatedAt: response.document.created_at,
  version: {
    documentVersionId: response.document.version.document_version_id,
    versionLabel: request.version.version_label,
    sourceUrl: request.version.source_url,
    originalFilename: request.version.original_filename,
    mimeType: request.version.mime_type,
    contentSha256: request.version.content_sha256,
    pageCount: request.version.page_count,
    extractionState: "queued",
    createdAt: response.document.version.created_at,
  },
  artifactAcceptance: {
    state: "not_accepted",
    artifactObjectId: null,
    artifactScanId: null,
    acceptedUntil: null,
  },
  ingestionState: "not_started",
  retrievalState: "not_indexed",
});

const replayIdentityMatches = (
  response: SourceResponseV1 | DocumentResponseV1,
  principal: AuthenticatedPrincipal,
  requestId: string,
  claimAuditId: string
): boolean =>
  tenantIdsEqual(response.request_id, requestId)
  && tenantIdsEqual(response.tenant_id, principal.tenantId)
  && tenantIdsEqual(response.provenance.credential_id, principal.credentialId)
  && tenantIdsEqual(response.provenance.audit_id, claimAuditId);

const validateReplay = async (
  dependencies: CatalogApiDependencies,
  kind: "source_create" | "document_create",
  scope: CatalogIdempotencyScope,
  client: TenantTransactionClient,
  claim: Extract<Awaited<ReturnType<CatalogApiDependencies["repository"]["claimIdempotency"]>>, { kind: "replay" }>,
  request: SourceCreateRequestV1 | DocumentCreateRequestV1,
  principal: AuthenticatedPrincipal,
  requestId: string
): Promise<string | null> => {
  let valid = sha256(claim.responseBody) === claim.responseSha256;
  try {
    const parsed = JSON.parse(claim.responseBody) as SourceResponseV1 | DocumentResponseV1;
    const validators = await dependencies.validators;
    valid = valid
      && replayIdentityMatches(parsed, principal, requestId, claim.auditId)
      && (kind === "source_create"
        ? validators.sourceResponse(parsed)
        : validators.documentResponse(parsed));
    if (!valid) throw new Error("replay identity or schema mismatch");

    if (kind === "source_create") {
      const sourceResponseBody = parsed as SourceResponseV1;
      const sourceRequest = request as SourceCreateRequestV1;
      const persisted = await dependencies.repository.getSource(
        client,
        principal.tenantId,
        sourceResponseBody.source.source_id
      );
      if (!persisted
        || persisted.sourceKey !== sourceRequest.source_key
        || persisted.createdByPrincipalId !== principal.principalId) {
        throw new Error("replay source identity mismatch");
      }
      const expected = sourceResponse(
        initialSourceFromReplay(sourceRequest, sourceResponseBody, principal),
        principal,
        requestId,
        claim.auditId,
        sourceResponseBody.provenance.created_at
      );
      valid = JSON.stringify(expected) === claim.responseBody;
    } else {
      const documentResponseBody = parsed as DocumentResponseV1;
      const documentRequest = request as DocumentCreateRequestV1;
      const persisted = await dependencies.repository.getDocument(
        client,
        principal.tenantId,
        documentResponseBody.document.document_id
      );
      if (!persisted
        || persisted.sourceId !== documentRequest.source_id
        || persisted.version.documentVersionId !== documentResponseBody.document.version.document_version_id
        || persisted.version.contentSha256 !== documentRequest.version.content_sha256
        || persisted.registeredByPrincipalId !== principal.principalId) {
        throw new Error("replay document identity mismatch");
      }
      const expected = documentResponse(
        initialDocumentFromReplay(documentRequest, documentResponseBody, principal, persisted),
        principal,
        requestId,
        claim.auditId,
        documentResponseBody.provenance.created_at
      );
      valid = JSON.stringify(expected) === claim.responseBody;
    }
  } catch {
    valid = false;
  }
  if (!valid) {
    await dependencies.repository.invalidateCompletedIdempotency(client, scope);
    return null;
  }
  return claim.responseBody;
};

const executeWrite = async (
  dependencies: CatalogApiDependencies,
  principal: AuthenticatedPrincipal,
  requestId: string,
  kind: "source_create" | "document_create",
  request: SourceCreateRequestV1 | DocumentCreateRequestV1,
  idempotencyKey: string
): Promise<string> => {
  const now = dependencies.now().toISOString();
  const operation = operationFor(kind) as CatalogIdempotencyScope["operation"];
  const scope: CatalogIdempotencyScope = {
    tenantId: principal.tenantId,
    principalId: principal.principalId,
    operation,
    idempotencyKeySha256: sha256(idempotencyKey),
    requestSha256: sha256(canonicalJson(request)),
    now,
    expiresAt: new Date(Date.parse(now) + dependencies.idempotencyTtlSeconds * 1000).toISOString(),
  };
  const result = await withTenantTransaction(dependencies.transactionPool, principal.tenantId, async (client) => {
    const claim = await dependencies.repository.claimIdempotency(client, scope);
    if (claim.kind === "conflict") throw new CatalogApiError(409, "idempotency_conflict", "Idempotency conflict");
    if (claim.kind === "processing") throw new CatalogApiError(409, "request_in_progress", "Request in progress", true);
    if (claim.kind === "replay") {
      const replay = await validateReplay(
        dependencies, kind, scope, client, claim, request, principal, requestId
      );
      return replay === null
        ? { kind: "replay_invalid" as const }
        : { kind: "body" as const, body: replay };
    }
    try {
      const auditId = dependencies.createUuid();
      const validators = await dependencies.validators;
      let body: string;
      let entityId: string;
      if (kind === "source_create") {
        const sourceRequest = request as SourceCreateRequestV1;
        const limitations = sourceLimitations(sourceRequest);
        const record = await dependencies.repository.createSource(client, {
          sourceId: dependencies.createUuid(),
          request: { ...sourceRequest, limitations },
          principal,
          now,
        });
        const response = sourceResponse(record, principal, requestId, auditId, now);
        if (!validators.sourceResponse(response)) {
          throw new Error(`Generated source response failed contract: ${JSON.stringify(validationDetails(validators.sourceResponse.errors))}`);
        }
        body = JSON.stringify(response);
        entityId = record.sourceId;
      } else {
        const record = await dependencies.repository.createDocument(client, {
          documentId: dependencies.createUuid(),
          documentVersionId: dependencies.createUuid(),
          request: request as DocumentCreateRequestV1,
          principal,
          now,
        });
        if (!record) throw new CatalogApiError(404, "not_found", "Resource not found");
        const response = documentResponse(record, principal, requestId, auditId, now);
        if (!validators.documentResponse(response)) {
          throw new Error(`Generated document response failed contract: ${JSON.stringify(validationDetails(validators.documentResponse.errors))}`);
        }
        body = JSON.stringify(response);
        entityId = record.documentId;
      }
      await dependencies.repository.recordAudit(client, auditInput(
        principal, requestId, auditId, operation, kind, "success", `${kind}_success`, entityId
      ));
      await dependencies.repository.completeIdempotency(client, {
        ...scope,
        responseStatus: 201,
        responseBody: body,
        responseSha256: sha256(body),
        auditId,
        completedAt: now,
      });
      return { kind: "body" as const, body };
    } catch (error) {
      try { await dependencies.repository.releaseIdempotency(client, scope); } catch { /* transaction rollback removes the claim */ }
      throw error;
    }
  });
  if (result.kind === "replay_invalid") {
    throw new CatalogApiError(500, "replay_invalid", "Stored response could not be safely replayed", true);
  }
  return result.body;
};

export const handleCatalogV1 = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  dependencies: CatalogApiDependencies
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
    try { auditId = await dependencies.repository.recordAuthenticationFailure(auditId, reasonCode); } catch { /* uniform */ }
    req.resume();
    sendResponse(res, {
      statusCode: 401,
      body: await errorBody(dependencies, new CatalogApiError(401, "unauthorized", "Authentication required"), {
        tenantId: null, credentialId: null, requestId: headerRequestId.requestId, auditId,
      }),
      requestId: headerRequestId.requestId,
      wwwAuthenticate: true,
      closeConnection: true,
    });
    return true;
  }

  const operation = operationFor(kind);
  try {
    requirePermission(principal, permissionFor(kind));
    if (!headerRequestId.valid) throw new CatalogApiError(400, "invalid_request", "X-Request-Id must be a UUID");
    if (!isWrite(kind) && requestMayHaveUnreadBody(req)) {
      throw new CatalogApiError(400, "invalid_request", "GET request body is not allowed");
    }
    await runRateGate(dependencies, principal, operation, headerRequestId.requestId, kind);

    if (!isWrite(kind)) {
      const listKind = kind as Exclude<RouteKind, "source_create" | "document_create">;
      const input = parseListInput(url, listKind, principal);
      validateListFilters(kind, input.filters);
      const body = await executeList(dependencies, principal, headerRequestId.requestId, listKind, input);
      sendResponse(res, { statusCode: 200, body, requestId: headerRequestId.requestId });
      return true;
    }

    const idempotencyKey = singleHeader(req.headers["idempotency-key"]);
    if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      throw new CatalogApiError(400, "invalid_request", "Invalid Idempotency-Key");
    }
    if (!contentTypeIsJson(req)) throw new CatalogApiError(400, "invalid_request", "Content-Type must be application/json");
    let parsed: unknown;
    try { parsed = await readJsonBody(req, MAX_BODY_BYTES); }
    catch { throw new CatalogApiError(400, "invalid_request", "Request body must be valid JSON"); }
    const validators = await dependencies.validators;
    const validator = kind === "source_create" ? validators.sourceRequest : validators.documentRequest;
    if (!validator(parsed)) {
      throw new CatalogApiError(400, "invalid_request", "Request validation failed");
    }
    const request = parsed as SourceCreateRequestV1 | DocumentCreateRequestV1;
    if ((kind === "source_create" && request.operation !== "source_create")
      || (kind === "document_create" && request.operation !== "document_create")) {
      throw new CatalogApiError(400, "invalid_request", "Request operation does not match route");
    }
    requireRequestIdentity(request, headerRequestId.requestId, principal);
    if (kind === "source_create") {
      const source = request as SourceCreateRequestV1;
      assertPublicUrlHasNoEmbeddedCredential(source.discovery_url);
      assertPublicUrlHasNoEmbeddedCredential(source.artifact_url);
      if (source.discovery_status === "missing_source" && (source.discovery_url || source.artifact_url)) {
        throw new CatalogApiError(400, "invalid_request", "missing_source cannot include URLs");
      }
    } else {
      assertPublicUrlHasNoEmbeddedCredential((request as DocumentCreateRequestV1).version.source_url);
    }
    const body = await executeWrite(
      dependencies, principal, headerRequestId.requestId,
      kind as "source_create" | "document_create", request, idempotencyKey
    );
    sendResponse(res, { statusCode: 201, body, requestId: headerRequestId.requestId });
    return true;
  } catch (error) {
    req.resume();
    const normalized = normalizeError(error);
    const audited = await persistErrorAudit(
      dependencies, principal, headerRequestId.requestId, operation, kind, normalized
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
