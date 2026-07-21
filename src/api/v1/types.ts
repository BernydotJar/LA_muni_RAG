import type { ValidateFunction } from "ajv";
import type { AuthenticatedPrincipal, IdentityRepository } from "../../security/index.js";
import type {
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import type { ProcedureWorkflow } from "../../procedure/index.js";
import type { ScopedSearchResult } from "../../search.js";

export const PROCEDURE_QUERY_ROUTE = "/api/v1/procedure-queries";
export const PROCEDURE_QUERY_OPERATION = "procedure_query_v1";

export interface ProcedureQueryRequestV1 {
  schema_version: "v1";
  direction: "inbound";
  product_boundary: "evidence_and_procedure_request_only";
  request_id: string;
  tenant_id: string;
  campaign_id: string;
  community_id: string;
  question: string;
  jurisdiction: string;
  case_context: {
    subject_reference: string;
    community_id: string;
    facts: string[];
    provided_documents: string[];
    constraints: string[];
  };
  requested_depth: "overview" | "deep_dive";
  requested_output: "evidence_bundle" | "claim_pack" | "procedure_workflow" | "procedure_assessment";
  provenance: {
    source_product: "os_electoral" | "content_agency";
    generated_by: "ai" | "human" | "system" | "integration_client" | "import";
    created_at: string;
    source_refs: string[];
    credential_id: string;
    audit_id: string;
  };
}

export interface ApiErrorDetailV1 {
  field: string;
  issue: string;
}

export interface ApiErrorV1 {
  schema_version: "v1";
  response_type: "api_error";
  tenant_id: string | null;
  request_id: string;
  audit_id: string;
  http_status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503;
  retryable: boolean;
  error: {
    code: string;
    message: string;
    details: ApiErrorDetailV1[];
  };
  provenance: {
    source_product: "la_muni_rag";
    generated_by: "system";
    created_at: string;
    source_refs: string[];
    credential_id: string | null;
    audit_id: string;
  };
}

export interface ProcedureQueryContractValidators {
  request: ValidateFunction;
  evidenceBundle: ValidateFunction;
  claimPack: ValidateFunction;
  workflow: ValidateFunction;
  apiError: ValidateFunction;
}

export interface CompiledProcedureWorkflow {
  workflow: ProcedureWorkflow;
  evidenceRecords: ScopedSearchResult[];
}

export interface ProcedureCompilationRequest {
  tenant_id: string;
  question: string;
  requested_depth: "overview" | "deep_dive";
}

export type ProcedureWorkflowCompiler = (
  request: ProcedureCompilationRequest,
  client: TenantTransactionClient
) => Promise<CompiledProcedureWorkflow>;

export type ProcedureQueryAuditOutcome = "success" | "error" | "blocked";

export interface ProcedureQueryAuditRecord {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  eventType: string;
  outcome: ProcedureQueryAuditOutcome;
  reasonCode: string;
  requestedOutput?: ProcedureQueryRequestV1["requested_output"];
  idempotencyKeySha256?: string;
}

export interface AuthenticationFailureRecord {
  auditId: string;
  requestId: string;
  reasonCode: "credential_rejected" | "authentication_dependency_failure";
}

export type IdempotencyClaim =
  | { kind: "new" }
  | {
      kind: "replay";
      statusCode: number;
      responseBody: string;
      originalAuditId: string;
    }
  | { kind: "conflict" }
  | { kind: "in_progress" };

export interface IdempotencyScope {
  tenantId: string;
  principalId: string;
  operation: typeof PROCEDURE_QUERY_OPERATION;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface RateLimitScope {
  tenantId: string;
  principalId: string;
  operation: typeof PROCEDURE_QUERY_OPERATION;
  limit: number;
  windowSeconds: number;
  blockedAuditId: string;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  auditId: string | null;
  shouldAudit: boolean;
}

export interface ProcedureQueryPersistence {
  claimIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<IdempotencyClaim>;
  completeIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope,
    result: { statusCode: number; responseBody: string; auditId: string }
  ): Promise<void>;
  releaseIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void>;
  invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void>;
  consumeRateLimit(
    client: TenantTransactionClient,
    scope: RateLimitScope
  ): Promise<RateLimitDecision>;
  recordAudit(
    client: TenantTransactionClient,
    record: ProcedureQueryAuditRecord
  ): Promise<void>;
}

export interface AuthenticationFailureRecorder {
  recordAuthenticationFailure(
    record: AuthenticationFailureRecord
  ): Promise<{ auditId: string }>;
}

export interface ProcedureQueryApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  persistence: ProcedureQueryPersistence;
  authenticationFailureRecorder: AuthenticationFailureRecorder;
  compiler: ProcedureWorkflowCompiler;
  validators: Promise<ProcedureQueryContractValidators>;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
}

export interface ProcedureQueryExecutionContext {
  principal: AuthenticatedPrincipal;
  request: ProcedureQueryRequestV1;
  requestId: string;
  idempotencyKeySha256: string;
  requestSha256: string;
}

export interface V1HttpResponse {
  statusCode: number;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
}
