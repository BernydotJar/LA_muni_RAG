import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import type { QueryEmbeddingProvider } from "../../embeddings/queryEmbedding.js";

export const SEARCH_ROUTE = "/api/v1/search";
export const EVIDENCE_BUNDLES_ROUTE = "/api/v1/evidence-bundles";

export type SearchMode = "keyword" | "phrase" | "semantic" | "hybrid";
export type ExecutedSearchMode = "keyword" | "phrase" | "semantic";
export type SourceRelation = "target" | "national" | "comparative" | "unknown";
export type AuthorityStatus =
  | "official_target_jurisdiction"
  | "official_national"
  | "comparative"
  | "unknown";
export type TemporalStatus =
  | "current_by_stored_dates"
  | "future_by_stored_dates"
  | "expired_by_stored_dates"
  | "undetermined";
export type SearchEvidenceStatus = "supported" | "comparative_reference" | "validation_required";
export type SearchOperation = "search_v1" | "evidence_bundle_create_v1";
export type DocumentType =
  | "constitution" | "law" | "decree" | "regulation" | "municipal_agreement"
  | "council_minutes" | "plan" | "manual" | "procedure" | "form" | "guide"
  | "jurisprudence" | "other";
export type DocumentScope =
  | "national" | "departmental" | "municipal" | "heritage" | "administrative" | "internal";

export interface SearchFiltersV1 {
  document_types: DocumentType[];
  source_relations: SourceRelation[];
  authority_statuses: AuthorityStatus[];
  temporal_statuses: TemporalStatus[];
  source_ids: string[];
}

interface SearchRequestBaseV1 {
  schema_version: "v1";
  request_id: string;
  tenant_id: string;
  query: string;
  jurisdiction: string;
  as_of_date: string;
  mode: SearchMode;
  limit: number;
  filters: SearchFiltersV1;
  provenance: { credential_id: string };
}

export interface SearchRequestV1 extends SearchRequestBaseV1 {
  operation: "search";
}

export interface EvidenceBundleCreateRequestV1 extends SearchRequestBaseV1 {
  operation: "evidence_bundle_create";
}

export type SearchEvidenceRequestV1 = SearchRequestV1 | EvidenceBundleCreateRequestV1;

export interface StoredSearchCandidate {
  tenantId: string;
  sourceId: string;
  sourceKey: string;
  sourceTitle: string;
  sourceRelation: SourceRelation;
  targetJurisdiction: string;
  sourceJurisdiction: string;
  validationState: "unreviewed" | "review_required" | "validated" | "rejected";
  officialSource: boolean;
  officialForTargetJurisdiction: boolean;
  acquisitionState: "not_acquired" | "acquisition_pending" | "acquired" | "access_blocked" | "failed";
  sourceIngestionState: "not_ingested" | "ingestion_pending" | "ingested" | "failed";
  sourceRetrievalState: "not_indexed" | "indexing" | "indexed" | "failed";
  publicationDate: string | null;
  effectiveDate: string | null;
  repealDate: string | null;
  documentId: string;
  documentVersionId: string;
  sectionId: string;
  chunkId: string | null;
  documentTitle: string;
  documentType: DocumentType;
  documentScope: DocumentScope;
  confidentiality: "public" | "internal" | "confidential" | "restricted";
  documentStatus: "draft" | "active" | "superseded" | "repealed" | "archived" | "unknown";
  extractionStatus: "queued" | "processing" | "processed" | "failed" | "superseded";
  sourceUrl: string;
  contentSha256: string;
  citationLabel: string;
  excerpt: string;
  pageStart: number | null;
  pageEnd: number | null;
  articleNumber: string | null;
  keywordScore: number | null;
  phraseMatched: boolean;
  semanticScore: number | null;
}

export interface ClassifiedSearchCandidate extends StoredSearchCandidate {
  authorityStatus: AuthorityStatus;
  temporalStatus: TemporalStatus;
  evidenceStatus: SearchEvidenceStatus;
  matchedModes: ExecutedSearchMode[];
  score: number;
  scoreType: "ts_rank_cd" | "phrase_match" | "cosine_similarity" | "reciprocal_rank_fusion";
  limitations: string[];
}

export interface SearchResultV1 {
  result_id: string;
  source_id: string;
  source_key: string;
  document_id: string;
  document_version_id: string;
  section_id: string;
  chunk_id: string | null;
  title: string;
  document_type: DocumentType;
  document_scope: DocumentScope;
  source_relation: SourceRelation;
  source_jurisdiction: string;
  target_jurisdiction: string;
  authority_status: AuthorityStatus;
  temporal_status: TemporalStatus;
  evidence_status: SearchEvidenceStatus;
  confidentiality: "public";
  official_source: boolean;
  official_for_target_jurisdiction: boolean;
  publication_date: string | null;
  effective_date: string | null;
  repeal_date: string | null;
  citation: {
    label: string;
    excerpt: string;
    source_url: string;
    page_start: number | null;
    page_end: number | null;
    article_number: string | null;
  };
  retrieval: {
    matched_modes: ExecutedSearchMode[];
    score: number;
    score_type: ClassifiedSearchCandidate["scoreType"];
  };
  content_sha256: string;
  limitations: string[];
}

export interface SearchProvenanceV1 {
  source_product: "la_muni_rag";
  generated_by: "system";
  created_at: string;
  source_refs: string[];
  credential_id: string;
  audit_id: string;
}

export interface SearchResponseV1 {
  schema_version: "v1";
  response_type: "search_results";
  request_id: string;
  tenant_id: string;
  query: string;
  jurisdiction: string;
  as_of_date: string;
  requested_mode: SearchMode;
  executed_modes: ExecutedSearchMode[];
  result_count: number;
  results: SearchResultV1[];
  limitations: string[];
  provenance: SearchProvenanceV1;
}

export interface SearchExecutionInput {
  tenantId: string;
  query: string;
  jurisdiction: string;
  asOfDate: string;
  limit: number;
  filters: SearchFiltersV1;
}

export interface SemanticSearchInput extends SearchExecutionInput {
  queryVector: number[];
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

export interface SearchEvidenceAuditInput {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  operation: SearchOperation;
  eventType: string;
  outcome: "success" | "error" | "blocked";
  reasonCode: string;
  resultCount?: number;
  requestedMode?: SearchMode;
}

export interface SearchEvidenceIdempotencyScope {
  tenantId: string;
  principalId: string;
  operation: "evidence_bundle_create_v1";
  idempotencyKeySha256: string;
  requestSha256: string;
  now: string;
  expiresAt: string;
}

export type SearchEvidenceIdempotencyClaim =
  | { kind: "new" }
  | { kind: "conflict" }
  | { kind: "processing" }
  | {
      kind: "replay";
      responseStatus: 200;
      responseBody: string;
      responseSha256: string;
      auditId: string;
    };

export interface SearchEvidenceRepository {
  consumeRateLimit(client: TenantTransactionClient, input: {
    tenantId: string;
    principalId: string;
    operation: SearchOperation;
    limit: number;
    windowSeconds: number;
    now: string;
    blockedAuditId: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number; auditId?: string; shouldAudit?: boolean }>;
  recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string>;
  recordAudit(client: TenantTransactionClient, input: SearchEvidenceAuditInput): Promise<void>;
  searchKeyword(client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]>;
  searchPhrase(client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]>;
  searchSemantic(client: TenantTransactionClient, input: SemanticSearchInput): Promise<StoredSearchCandidate[]>;
  claimIdempotency(
    client: TenantTransactionClient,
    input: SearchEvidenceIdempotencyScope
  ): Promise<SearchEvidenceIdempotencyClaim>;
  completeIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope & {
    responseStatus: 200;
    responseBody: string;
    responseSha256: string;
    auditId: string;
    completedAt: string;
  }): Promise<void>;
  releaseIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void>;
  invalidateCompletedIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void>;
}

export interface SearchEvidenceValidators {
  searchRequest: ValidateFunction;
  searchResponse: ValidateFunction;
  evidenceBundleRequest: ValidateFunction;
  evidenceBundle: ValidateFunction;
  apiError: ValidateFunction;
}

export interface SearchEvidenceApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  repository: SearchEvidenceRepository;
  validators: Promise<SearchEvidenceValidators>;
  queryEmbeddingProvider: QueryEmbeddingProvider | null;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
  idempotencyTtlSeconds: number;
}

export class SearchEvidenceRepositoryError extends Error {
  constructor(public readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SearchEvidenceRepositoryError";
  }
}
