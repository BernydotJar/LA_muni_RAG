import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";

export const SOURCES_ROUTE = "/api/v1/sources";
export const DOCUMENTS_ROUTE = "/api/v1/documents";
export const PROCEDURES_ROUTE = "/api/v1/procedures";

export type CatalogOperation =
  | "source_create_v1"
  | "source_list_v1"
  | "document_create_v1"
  | "document_list_v1"
  | "ingestion_job_list_v1"
  | "procedure_list_v1";

export type SourceCategory =
  | "constitution"
  | "national_law"
  | "national_regulation"
  | "planning"
  | "budget"
  | "organization"
  | "procedure_manual"
  | "function_manual"
  | "council_record"
  | "form"
  | "community_record"
  | "public_portal"
  | "other";
export type SourceRelation = "target" | "national" | "comparative" | "unknown";
export type SourceDiscoveryStatus = "identified" | "access_blocked" | "unverified" | "missing_source";
export type SourceValidationState = "unreviewed" | "review_required" | "validated" | "rejected";
export type SourceAcquisitionState = "not_acquired" | "acquisition_pending" | "acquired" | "access_blocked" | "failed";
export type SourceIngestionState = "not_ingested" | "ingestion_pending" | "ingested" | "failed";
export type SourceRetrievalState = "not_indexed" | "indexing" | "indexed" | "failed";

export interface SourceCreateRequestV1 {
  schema_version: "v1";
  operation: "source_create";
  request_id: string;
  tenant_id: string;
  source_key: string;
  title: string;
  category: SourceCategory;
  target_jurisdiction: string;
  source_jurisdiction: string;
  source_relation: SourceRelation;
  discovery_status: SourceDiscoveryStatus;
  discovery_url: string | null;
  artifact_url: string | null;
  observed_version: string | null;
  publication_date: string | null;
  effective_date: string | null;
  limitations: string[];
  provenance: { credential_id: string };
}

export interface StoredSource {
  sourceId: string;
  tenantId: string;
  sourceKey: string;
  title: string;
  category: SourceCategory;
  targetJurisdiction: string;
  sourceJurisdiction: string;
  sourceRelation: SourceRelation;
  discoveryStatus: SourceDiscoveryStatus;
  discoveryUrl: string | null;
  artifactUrl: string | null;
  observedVersion: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  limitations: string[];
  validationState: SourceValidationState;
  officialSource: boolean;
  officialForTargetJurisdiction: boolean;
  acquisitionState: SourceAcquisitionState;
  ingestionState: SourceIngestionState;
  retrievalState: SourceRetrievalState;
  createdByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceItemV1 {
  source_id: string;
  source_key: string;
  title: string;
  category: SourceCategory;
  target_jurisdiction: string;
  source_jurisdiction: string;
  source_relation: SourceRelation;
  discovery_status: SourceDiscoveryStatus;
  discovery_url: string | null;
  artifact_url: string | null;
  observed_version: string | null;
  publication_date: string | null;
  effective_date: string | null;
  limitations: string[];
  validation_state: SourceValidationState;
  official_source: boolean;
  official_for_target_jurisdiction: boolean;
  acquisition_state: SourceAcquisitionState;
  ingestion_state: SourceIngestionState;
  retrieval_state: SourceRetrievalState;
  created_by_principal_id: string;
  created_at: string;
  updated_at: string;
}

export interface SourceResponseV1 {
  schema_version: "v1";
  response_type: "source_catalog_item";
  request_id: string;
  tenant_id: string;
  source: SourceItemV1;
  provenance: CatalogProvenanceV1;
}

export type DocumentType =
  | "constitution" | "law" | "decree" | "regulation" | "municipal_agreement"
  | "council_minutes" | "plan" | "manual" | "procedure" | "form" | "guide"
  | "jurisprudence" | "other";
export type DocumentScope = "national" | "departmental" | "municipal" | "heritage" | "administrative" | "internal";
export type Confidentiality = "public" | "internal" | "confidential" | "restricted";

export interface DocumentCreateRequestV1 {
  schema_version: "v1";
  operation: "document_create";
  request_id: string;
  tenant_id: string;
  source_id: string;
  title: string;
  document_type: DocumentType;
  document_scope: DocumentScope;
  issuing_authority: string | null;
  confidentiality: Confidentiality;
  version: {
    version_label: string;
    source_url: string | null;
    original_filename: string | null;
    mime_type: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "text/plain" | "text/markdown";
    content_sha256: string;
    page_count: number | null;
  };
  provenance: { credential_id: string };
}

export type ArtifactAcceptanceState = "not_accepted" | "scanning" | "accepted" | "rejected" | "superseded";
export type SafeIngestionJobState = "queued" | "processing" | "retry_wait" | "processed" | "failed" | "cancelled" | "superseded";
export type RetrievalState = "not_indexed" | "indexing" | "indexed" | "failed";

export interface StoredDocument {
  documentId: string;
  tenantId: string;
  sourceId: string;
  title: string;
  documentType: DocumentType;
  documentScope: DocumentScope;
  issuingAuthority: string | null;
  officialSource: boolean;
  documentStatus: "draft" | "active" | "superseded" | "repealed" | "archived" | "unknown";
  confidentiality: Confidentiality;
  registeredByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
  version: {
    documentVersionId: string;
    versionLabel: string;
    sourceUrl: string | null;
    originalFilename: string | null;
    mimeType: string | null;
    contentSha256: string;
    pageCount: number | null;
    extractionState: "queued" | "processing" | "processed" | "failed" | "superseded";
    createdAt: string;
  };
  artifactAcceptance: {
    state: ArtifactAcceptanceState;
    artifactObjectId: string | null;
    artifactScanId: string | null;
    acceptedUntil: string | null;
  };
  ingestionState: "not_started" | SafeIngestionJobState;
  retrievalState: RetrievalState;
}

export interface DocumentItemV1 {
  document_id: string;
  source_id: string;
  title: string;
  document_type: DocumentType;
  document_scope: DocumentScope;
  issuing_authority: string | null;
  official_source: boolean;
  document_status: StoredDocument["documentStatus"];
  confidentiality: Confidentiality;
  registered_by_principal_id: string;
  created_at: string;
  updated_at: string;
  version: {
    document_version_id: string;
    version_label: string;
    source_url: string | null;
    original_filename: string | null;
    mime_type: string | null;
    content_sha256: string;
    page_count: number | null;
    extraction_state: StoredDocument["version"]["extractionState"];
    created_at: string;
  };
  artifact_acceptance: {
    state: ArtifactAcceptanceState;
    artifact_object_id: string | null;
    artifact_scan_id: string | null;
    accepted_until: string | null;
  };
  ingestion_state: StoredDocument["ingestionState"];
  retrieval_state: RetrievalState;
}

export interface DocumentResponseV1 {
  schema_version: "v1";
  response_type: "document_catalog_item";
  request_id: string;
  tenant_id: string;
  document: DocumentItemV1;
  limitations: string[];
  provenance: CatalogProvenanceV1;
}

export interface StoredIngestionJobSummary {
  tenantId: string;
  jobId: string;
  documentVersionId: string;
  status: "queued" | "processing" | "processed" | "failed" | "superseded" | "cancelled";
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastErrorCode: string | null;
  lastErrorRetryable: boolean | null;
  createdAt: string;
  updatedAt: string;
  internal?: Record<string, unknown>;
}

export interface IngestionJobSummaryV1 {
  job_id: string;
  document_version_id: string;
  status: SafeIngestionJobState;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error_code: string | null;
  last_error_retryable: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface StoredProcedureSummary {
  tenantId: string;
  procedureId: string;
  procedureKey: string;
  title: string;
  jurisdiction: string;
  latestVersionNumber: number | null;
  latestLifecycleStatus: "draft" | "in_review" | "approved" | "superseded" | "archived" | null;
  approvedWorkflowVersionId: string | null;
  approvedVersionNumber: number | null;
  createdAt: string;
  updatedAt: string;
  internalWorkflowDefinition?: Record<string, unknown>;
}

export interface ProcedureSummaryV1 {
  procedure_id: string;
  procedure_key: string;
  title: string;
  jurisdiction: string;
  latest_version_number: number | null;
  latest_lifecycle_status: StoredProcedureSummary["latestLifecycleStatus"];
  approved_workflow_version_id: string | null;
  approved_version_number: number | null;
  approval_state: "approved" | "unapproved";
  created_at: string;
  updated_at: string;
}

export interface CatalogProvenanceV1 {
  source_product: "la_muni_rag";
  generated_by: "system";
  created_at: string;
  source_refs: string[];
  credential_id: string;
  audit_id: string;
}

export interface CatalogPageResponseV1<T, R extends string> {
  schema_version: "v1";
  response_type: R;
  request_id: string;
  tenant_id: string;
  items: T[];
  next_cursor: string | null;
  provenance: CatalogProvenanceV1;
}

export type SourcePageResponseV1 = CatalogPageResponseV1<SourceItemV1, "source_catalog_page">;
export type DocumentPageResponseV1 = CatalogPageResponseV1<DocumentItemV1, "document_catalog_page">;
export type IngestionJobPageResponseV1 = CatalogPageResponseV1<IngestionJobSummaryV1, "ingestion_job_catalog_page">;
export type ProcedurePageResponseV1 = CatalogPageResponseV1<ProcedureSummaryV1, "procedure_catalog_page">;

export interface CatalogCursor {
  createdAt: string;
  id: string;
}

export interface CatalogListInput {
  tenantId: string;
  limit: number;
  cursor: CatalogCursor | null;
  filters: Record<string, string>;
}

export interface CatalogPage<T> {
  items: T[];
  nextCursor: CatalogCursor | null;
}

export interface CatalogAuditInput {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  operation: CatalogOperation;
  eventType: string;
  entityTable: string;
  entityId: string | null;
  outcome: "success" | "error" | "blocked";
  reasonCode: string;
}

export interface CatalogIdempotencyScope {
  tenantId: string;
  principalId: string;
  operation: "source_create_v1" | "document_create_v1";
  idempotencyKeySha256: string;
  requestSha256: string;
  now: string;
  expiresAt: string;
}

export type CatalogIdempotencyClaim =
  | { kind: "new" }
  | { kind: "conflict" }
  | { kind: "processing" }
  | { kind: "replay"; responseStatus: 201; responseBody: string; responseSha256: string; auditId: string };

export interface CatalogRepository {
  consumeRateLimit(client: TenantTransactionClient, input: {
    tenantId: string;
    principalId: string;
    operation: CatalogOperation;
    limit: number;
    windowSeconds: number;
    now: string;
    blockedAuditId: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number; auditId?: string; shouldAudit?: boolean }>;
  claimIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<CatalogIdempotencyClaim>;
  completeIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope & {
    responseStatus: 201;
    responseBody: string;
    responseSha256: string;
    auditId: string;
    completedAt: string;
  }): Promise<void>;
  releaseIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void>;
  invalidateCompletedIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void>;
  recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string>;
  recordAudit(client: TenantTransactionClient, input: CatalogAuditInput): Promise<void>;
  createSource(client: TenantTransactionClient, input: {
    sourceId: string;
    request: SourceCreateRequestV1;
    principal: AuthenticatedPrincipal;
    now: string;
  }): Promise<StoredSource>;
  getSource(client: TenantTransactionClient, tenantId: string, sourceId: string): Promise<StoredSource | null>;
  listSources(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredSource>>;
  createDocument(client: TenantTransactionClient, input: {
    documentId: string;
    documentVersionId: string;
    request: DocumentCreateRequestV1;
    principal: AuthenticatedPrincipal;
    now: string;
  }): Promise<StoredDocument | null>;
  getDocument(client: TenantTransactionClient, tenantId: string, documentId: string): Promise<StoredDocument | null>;
  listDocuments(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredDocument>>;
  listIngestionJobs(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredIngestionJobSummary>>;
  listProcedures(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredProcedureSummary>>;
}

export interface CatalogValidators {
  sourceRequest: ValidateFunction;
  sourceResponse: ValidateFunction;
  sourcePage: ValidateFunction;
  documentRequest: ValidateFunction;
  documentResponse: ValidateFunction;
  documentPage: ValidateFunction;
  ingestionJobPage: ValidateFunction;
  procedurePage: ValidateFunction;
  apiError: ValidateFunction;
}

export interface CatalogApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  repository: CatalogRepository;
  validators: Promise<CatalogValidators>;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
  idempotencyTtlSeconds: number;
}

export class CatalogRepositoryError extends Error {
  constructor(public readonly code: "duplicate_source" | "duplicate_document" | "not_found", message: string) {
    super(message);
    this.name = "CatalogRepositoryError";
  }
}
