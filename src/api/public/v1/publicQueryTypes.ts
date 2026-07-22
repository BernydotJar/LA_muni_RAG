import type { ValidateFunction } from "ajv";
import type { TenantTransactionClient, TenantTransactionPool } from "../../../security/index.js";
import type {
  ExecutedSearchMode,
  SearchEvidenceRepository,
  SearchEvidenceStatus,
  SearchMode,
  AuthorityStatus,
  TemporalStatus,
} from "../../v1/searchEvidenceTypes.js";

export const PUBLIC_QUERY_ROUTE = "/api/public/v1/query";

export type PublicQueryMode = Extract<SearchMode, "keyword" | "phrase">;
export type PublicQueryResponseLabel = "evidence_found" | "insufficient_evidence" | "not_found";
export type PublicQueryConfidence = "high" | "medium" | "low";
export type PublicQueryRateOperation = "public_query_client_v1" | "public_query_global_v1";

export interface PublicQueryRequestV1 {
  message: string;
  mode: PublicQueryMode;
  limit: number;
}

export interface PublicQueryCitationV1 {
  citationLabel: string;
  sourceType: string;
  title: string;
  pageStart: number | null;
  pageEnd: number | null;
  articleNumber: string | null;
  excerpt: string;
  sourceUrl: string;
  authorityStatus: AuthorityStatus;
  temporalStatus: TemporalStatus;
  evidenceStatus: SearchEvidenceStatus;
}

export interface PublicQueryResponseV1 {
  schema_version: "v1";
  response_type: "public_query";
  request_id: string;
  role: "assistant";
  content: string;
  citations: PublicQueryCitationV1[];
  meta: {
    responseLabel: PublicQueryResponseLabel;
    confidence: PublicQueryConfidence;
    evidenceCount: number;
    suggestedAction: string;
    requestedMode: PublicQueryMode;
    executedModes: ExecutedSearchMode[];
    jurisdiction: string;
    asOfDate: string;
    limitations: string[];
  };
}

export interface PublicQueryErrorV1 {
  schema_version: "v1";
  response_type: "public_error";
  request_id: string;
  error: {
    code:
      | "invalid_request"
      | "forbidden"
      | "method_not_allowed"
      | "rate_limit_exceeded"
      | "service_unavailable"
      | "internal_error";
    message: string;
    retryable: boolean;
  };
}

export interface PublicQueryValidators {
  request: ValidateFunction;
  response: ValidateFunction;
  error: ValidateFunction;
}

export interface PublicQueryRateInput {
  tenantId: string;
  clientKeySha256: string;
  operation: PublicQueryRateOperation;
  limit: number;
  windowSeconds: number;
  now: string;
  blockedAuditId: string;
}

export interface PublicQueryRateDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  auditId?: string;
  shouldAudit?: boolean;
}

export interface PublicQueryAuditInput {
  auditId: string;
  tenantId: string;
  requestId: string;
  eventType: "public.query.succeeded" | "public.query.blocked" | "public.query.failed";
  outcome: "success" | "blocked" | "error";
  reasonCode: string;
  requestedMode?: PublicQueryMode;
  resultCount?: number;
}

export interface PublicQueryRepository {
  consumeRateLimit(
    client: TenantTransactionClient,
    input: PublicQueryRateInput
  ): Promise<PublicQueryRateDecision>;
  recordAudit(client: TenantTransactionClient, input: PublicQueryAuditInput): Promise<void>;
}

export interface PublicQueryApiDependencies {
  enabled: boolean;
  tenantId: string | null;
  jurisdiction: string | null;
  allowedOrigins: readonly string[];
  clientKeySecret: string | null;
  rateLimit: number;
  globalRateLimit: number;
  rateWindowSeconds: number;
  maxLimit: number;
  publicRepository: PublicQueryRepository;
  searchRepository: SearchEvidenceRepository;
  transactionPool: TenantTransactionPool;
  validators: Promise<PublicQueryValidators>;
  now: () => Date;
  createUuid: () => string;
}

export class PublicQueryRepositoryError extends Error {
  constructor(public readonly code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PublicQueryRepositoryError";
  }
}
