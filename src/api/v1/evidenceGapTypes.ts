import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import type { ApiErrorV1 } from "./types.js";

export const EVIDENCE_GAP_ROUTE = "/api/v1/evidence-gap-requests";
export const EVIDENCE_GAP_OPERATION = "evidence_gap_request_v1";

export interface EvidenceGapRequestV1 {
  schema_version: "v1";
  direction: "inbound";
  product_boundary: "evidence_gap_request_only";
  gap_request_id: string;
  request_id: string;
  tenant_id: string;
  subject: string;
  missing_document: string;
  reason: string;
  priority: "low" | "medium" | "high" | "critical";
  campaign_reference: string;
  jurisdiction: string;
  provenance: {
    source_product: "os_electoral";
    generated_by: "ai" | "human" | "system" | "integration_client" | "import";
    created_at: string;
    source_refs: string[];
    credential_id: string;
    audit_id: string;
  };
}

export interface EvidenceGapResponseV1 {
  schema_version: "v1";
  response_type: "evidence_gap_request";
  product_boundary: "evidence_gap_request_only";
  gap_request_id: string;
  request_id: string;
  tenant_id: string;
  requester_product: "os_electoral";
  jurisdiction: string;
  subject: string;
  missing_document: string;
  reason: string;
  priority: EvidenceGapRequestV1["priority"];
  campaign_reference: string;
  status: "open";
  request_assertion_status: "requester_supplied_unverified";
  submitted_at: string;
  limitations: string[];
  provenance: {
    source_product: "la_muni_rag";
    generated_by: "system";
    created_at: string;
    source_refs: string[];
    credential_id: string;
    audit_id: string;
  };
}

export interface EvidenceGapContractValidators {
  request: ValidateFunction;
  response: ValidateFunction;
  apiError: ValidateFunction;
}

export type EvidenceGapAuditOutcome = "success" | "error" | "blocked";

export interface EvidenceGapAuditRecord {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  gapRequestId?: string;
  eventType: string;
  outcome: EvidenceGapAuditOutcome;
  reasonCode: string;
  idempotencyKeySha256?: string;
}

export interface EvidenceGapAuthenticationFailureRecord {
  auditId: string;
  requestId: string;
  reasonCode: "credential_rejected" | "authentication_dependency_failure";
}

export interface EvidenceGapAuthenticationFailureRecorder {
  recordAuthenticationFailure(
    record: EvidenceGapAuthenticationFailureRecord
  ): Promise<{ auditId: string }>;
}

export type EvidenceGapIdempotencyClaim =
  | { kind: "new" }
  | {
      kind: "replay";
      statusCode: number;
      responseBody: string;
      responseSha256: string;
      originalAuditId: string;
    }
  | { kind: "conflict" }
  | { kind: "in_progress" };

export interface EvidenceGapIdempotencyScope {
  tenantId: string;
  principalId: string;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface EvidenceGapAggregateInput {
  tenantId: string;
  gapRequestId: string;
  requestId: string;
  requesterProduct: "os_electoral";
  jurisdiction: string;
  subject: string;
  missingDocument: string;
  reason: string;
  priority: EvidenceGapRequestV1["priority"];
  campaignReference: string;
  requestSha256: string;
  principalId: string;
  credentialId: string;
  originalAuditId: string;
  responseBody: string;
  responseSha256: string;
  submittedAt: string;
}

export type EvidenceGapAggregateClaim =
  | { kind: "created" }
  | {
      kind: "replay";
      statusCode: 200;
      responseBody: string;
      responseSha256: string;
      originalAuditId: string;
    }
  | { kind: "conflict" };

export interface EvidenceGapRateLimitScope {
  tenantId: string;
  principalId: string;
  limit: number;
  windowSeconds: number;
  blockedAuditId: string;
}

export interface EvidenceGapRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  auditId: string | null;
  shouldAudit: boolean;
}

export interface EvidenceGapPersistence {
  claimIdempotency(
    client: TenantTransactionClient,
    scope: EvidenceGapIdempotencyScope
  ): Promise<EvidenceGapIdempotencyClaim>;
  completeIdempotency(
    client: TenantTransactionClient,
    scope: EvidenceGapIdempotencyScope,
    result: {
      statusCode: 200;
      responseBody: string;
      responseSha256: string;
      auditId: string;
    }
  ): Promise<void>;
  releaseIdempotency(
    client: TenantTransactionClient,
    scope: EvidenceGapIdempotencyScope
  ): Promise<void>;
  invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    scope: EvidenceGapIdempotencyScope
  ): Promise<void>;
  createOrReplayGap(
    client: TenantTransactionClient,
    input: EvidenceGapAggregateInput
  ): Promise<EvidenceGapAggregateClaim>;
  consumeRateLimit(
    client: TenantTransactionClient,
    scope: EvidenceGapRateLimitScope
  ): Promise<EvidenceGapRateLimitDecision>;
  recordAudit(
    client: TenantTransactionClient,
    record: EvidenceGapAuditRecord
  ): Promise<void>;
}

export interface EvidenceGapApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  persistence: EvidenceGapPersistence;
  authenticationFailureRecorder: EvidenceGapAuthenticationFailureRecorder;
  validators: Promise<EvidenceGapContractValidators>;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
}

export interface EvidenceGapExecutionContext {
  principal: AuthenticatedPrincipal;
  request: EvidenceGapRequestV1;
  requestId: string;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface EvidenceGapHttpResponse {
  statusCode: ApiErrorV1["http_status"] | 200;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
}
