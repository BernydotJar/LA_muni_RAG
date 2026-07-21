import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import type {
  ApiErrorV1,
  ProcedureWorkflowCompiler,
} from "./types.js";

export const CLAIM_PACK_ROUTE = "/api/v1/claim-packs";
export const CLAIM_PACK_OPERATION = "claim_pack_v1";

export interface ClaimPackRequestV1 {
  schema_version: "v1";
  direction: "inbound";
  product_boundary: "claims_and_evidence_request_only";
  request_id: string;
  tenant_id: string;
  question: string;
  jurisdiction: string;
  case_context: {
    subject_reference: string;
    facts: string[];
    provided_documents: string[];
    constraints: string[];
  };
  requested_depth: "overview" | "deep_dive";
  provenance: {
    source_product: "content_agency";
    generated_by: "ai" | "human" | "system" | "integration_client" | "import";
    created_at: string;
    source_refs: string[];
    credential_id: string;
    audit_id: string;
  };
}

export interface ClaimPackContractValidators {
  request: ValidateFunction;
  claimPack: ValidateFunction;
  apiError: ValidateFunction;
}

export type ClaimPackAuditOutcome = "success" | "error" | "blocked";

export interface ClaimPackAuditRecord {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  eventType: string;
  outcome: ClaimPackAuditOutcome;
  reasonCode: string;
  idempotencyKeySha256?: string;
}

export interface ClaimPackAuthenticationFailureRecord {
  auditId: string;
  requestId: string;
  reasonCode: "credential_rejected" | "authentication_dependency_failure";
}

export interface ClaimPackAuthenticationFailureRecorder {
  recordAuthenticationFailure(
    record: ClaimPackAuthenticationFailureRecord
  ): Promise<{ auditId: string }>;
}

export type ClaimPackIdempotencyClaim =
  | { kind: "new" }
  | {
      kind: "replay";
      statusCode: number;
      responseBody: string;
      originalAuditId: string;
    }
  | { kind: "conflict" }
  | { kind: "in_progress" };

export interface ClaimPackIdempotencyScope {
  tenantId: string;
  principalId: string;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface ClaimPackRateLimitScope {
  tenantId: string;
  principalId: string;
  limit: number;
  windowSeconds: number;
  blockedAuditId: string;
}

export interface ClaimPackRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  auditId: string | null;
  shouldAudit: boolean;
}

export interface ClaimPackPersistence {
  claimIdempotency(
    client: TenantTransactionClient,
    scope: ClaimPackIdempotencyScope
  ): Promise<ClaimPackIdempotencyClaim>;
  completeIdempotency(
    client: TenantTransactionClient,
    scope: ClaimPackIdempotencyScope,
    result: { statusCode: number; responseBody: string; auditId: string }
  ): Promise<void>;
  releaseIdempotency(
    client: TenantTransactionClient,
    scope: ClaimPackIdempotencyScope
  ): Promise<void>;
  invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    scope: ClaimPackIdempotencyScope
  ): Promise<void>;
  consumeRateLimit(
    client: TenantTransactionClient,
    scope: ClaimPackRateLimitScope
  ): Promise<ClaimPackRateLimitDecision>;
  recordAudit(
    client: TenantTransactionClient,
    record: ClaimPackAuditRecord
  ): Promise<void>;
}

export interface ClaimPackApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  persistence: ClaimPackPersistence;
  authenticationFailureRecorder: ClaimPackAuthenticationFailureRecorder;
  compiler: ProcedureWorkflowCompiler;
  validators: Promise<ClaimPackContractValidators>;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
  validitySeconds: number;
}

export interface ClaimPackExecutionContext {
  principal: AuthenticatedPrincipal;
  request: ClaimPackRequestV1;
  requestId: string;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface ClaimPackHttpResponse {
  statusCode: ApiErrorV1["http_status"] | 200;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
}
