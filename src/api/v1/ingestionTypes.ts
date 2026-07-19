import type { ValidateFunction } from "ajv";
import type {
  DurableIngestionJob,
  EnqueueIngestionJobInput,
  EnqueueIngestionJobResult,
  IngestionPipelineConfigV1,
} from "../../ingestion/jobTypes.js";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";

export const INGESTION_JOBS_ROUTE = "/api/v1/ingestion-jobs";
export const INGESTION_JOB_ENQUEUE_OPERATION = "ingestion_job_enqueue_v1" as const;
export const INGESTION_JOB_GET_OPERATION = "ingestion_job_get_v1" as const;
export const INGESTION_PIPELINE_PROFILE = "municipal_document_v1" as const;

export type IngestionApiOperation =
  | typeof INGESTION_JOB_ENQUEUE_OPERATION
  | typeof INGESTION_JOB_GET_OPERATION;

export interface IngestionJobRequestV1 {
  schema_version: "v1";
  request_id: string;
  tenant_id: string;
  pipeline_profile: typeof INGESTION_PIPELINE_PROFILE;
  document_version_id: string;
  artifact_sha256: string;
}

export type IngestionJobResponseResult = "new" | "replay" | "duplicate_work" | "status";

export interface IngestionJobResponseV1 {
  schema_version: "v1";
  response_type: "ingestion_job";
  tenant_id: string;
  request_id: string;
  audit_id: string;
  result: IngestionJobResponseResult;
  job: {
    job_id: string;
    document_version_id: string;
    pipeline_profile: typeof INGESTION_PIPELINE_PROFILE;
    status: DurableIngestionJob["status"];
    attempt_count: number;
    max_attempts: number;
    available_at: string;
    started_at: string | null;
    finished_at: string | null;
    lease_expires_at: string | null;
    heartbeat_at: string | null;
    last_error_code: string | null;
    last_error_retryable: boolean | null;
    created_at: string;
    updated_at: string;
  };
  provenance: {
    source_product: "la_muni_rag";
    generated_by: "system";
    created_at: string;
    source_refs: string[];
    credential_id: string;
    audit_id: string;
  };
}

export interface IngestionJobContractValidators {
  request: ValidateFunction;
  response: ValidateFunction;
  apiError: ValidateFunction;
}

export interface IngestionJobApiService {
  enqueue(input: EnqueueIngestionJobInput): Promise<EnqueueIngestionJobResult>;
  get(tenantId: string, jobId: string): Promise<DurableIngestionJob | null>;
}

export interface IngestionApiRateLimitScope {
  tenantId: string;
  principalId: string;
  operation: IngestionApiOperation;
  limit: number;
  windowSeconds: number;
  blockedAuditId: string;
}

export interface IngestionApiRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  auditId: string | null;
  shouldAudit: boolean;
}

export interface IngestionApiAuditRecord {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  operation: IngestionApiOperation;
  eventType: string;
  outcome: "success" | "error" | "blocked";
  reasonCode: string;
  jobId?: string;
}

export interface IngestionAuthenticationFailureRecord {
  auditId: string;
  requestId: string;
  reasonCode: "credential_rejected" | "authentication_dependency_failure";
}

export interface IngestionAuthenticationFailureRecorder {
  recordAuthenticationFailure(
    record: IngestionAuthenticationFailureRecord
  ): Promise<{ auditId: string }>;
}

export interface IngestionApiPersistence {
  consumeRateLimit(
    client: TenantTransactionClient,
    scope: IngestionApiRateLimitScope
  ): Promise<IngestionApiRateLimitDecision>;
  recordAudit(
    client: TenantTransactionClient,
    record: IngestionApiAuditRecord
  ): Promise<void>;
}

export interface IngestionJobApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  persistence: IngestionApiPersistence;
  authenticationFailureRecorder: IngestionAuthenticationFailureRecorder;
  jobService: IngestionJobApiService;
  validators: Promise<IngestionJobContractValidators>;
  pipelineConfig: IngestionPipelineConfigV1 | null;
  maxAttempts: number;
  enqueueRateLimit: number;
  getRateLimit: number;
  rateWindowSeconds: number;
  now: () => Date;
  createUuid: () => string;
}

export interface IngestionApiHttpResponse {
  statusCode: number;
  body: string;
  requestId: string;
  retryAfterSeconds?: number;
  wwwAuthenticate?: boolean;
}

export interface AuthenticatedIngestionContext {
  principal: AuthenticatedPrincipal;
  requestId: string;
}
