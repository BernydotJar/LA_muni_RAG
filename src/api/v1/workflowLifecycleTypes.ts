import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import type {
  WorkflowApprovalRecord,
  WorkflowGenerationSource,
  WorkflowReviewDecision,
  WorkflowReviewRecord,
  WorkflowVersionRecord,
} from "../../workflowLifecycle/types.js";

export type WorkflowLifecyclePrincipal = AuthenticatedPrincipal;

export const WORKFLOW_DRAFTS_ROUTE = "/api/v1/workflow-drafts";
export const WORKFLOW_REVIEWS_ROUTE = "/api/v1/workflow-reviews";
export const WORKFLOW_APPROVALS_ROUTE = "/api/v1/workflow-approvals";
export const WORKFLOWS_ROUTE_PREFIX = "/api/v1/workflows/";

export type WorkflowLifecycleOperation =
  | "workflow_draft_create_v1"
  | "workflow_submit_review_v1"
  | "workflow_record_review_v1"
  | "workflow_approve_v1"
  | "workflow_supersede_v1"
  | "workflow_archive_v1";

export type WorkflowLifecycleRateOperation =
  | "workflow_draft_create_v1"
  | "workflow_review_write_v1"
  | "workflow_approval_write_v1"
  | "workflow_read_v1";

export interface WorkflowDraftRequestV1 {
  schema_version: "v1";
  request_id: string;
  tenant_id: string;
  procedure_key: string;
  generation_source: WorkflowGenerationSource;
  workflow_definition: Record<string, unknown>;
  evidence_bundle_id?: string | null;
  provenance: { credential_id: string };
}

export interface WorkflowReviewRequestV1 {
  schema_version: "v1";
  request_id: string;
  tenant_id: string;
  workflow_version_id: string;
  action: "submit_for_review" | "record_review";
  decision?: WorkflowReviewDecision;
  notes?: string;
  provenance: { credential_id: string };
}

export interface WorkflowApprovalRequestV1 {
  schema_version: "v1";
  request_id: string;
  tenant_id: string;
  workflow_version_id: string;
  action: "approve" | "supersede" | "archive";
  replacement_workflow_version_id?: string;
  notes: string;
  provenance: { credential_id: string };
}

export interface StoredWorkflowVersion extends WorkflowVersionRecord {
  procedureKey: string;
}

export interface WorkflowVersionResponseV1 {
  schema_version: "v1";
  response_type: "workflow_version";
  request_id: string;
  tenant_id: string;
  procedure_id: string;
  procedure_key: string;
  workflow_version_id: string;
  version_number: number;
  lifecycle_status: WorkflowVersionRecord["lifecycleStatus"];
  generation_source: WorkflowGenerationSource;
  revision: number;
  title: string;
  jurisdiction: string;
  workflow_definition: Record<string, unknown>;
  evidence_bundle_id: string | null;
  submitted_by_principal_id: string | null;
  submitted_at: string | null;
  latest_review: null | {
    review_id: string;
    reviewer_principal_id: string;
    decision: WorkflowReviewDecision;
    notes: string;
    created_at: string;
  };
  approval: null | {
    approval_id: string;
    approver_principal_id: string;
    decision: "approved";
    notes: string;
    created_at: string;
  };
  superseded_by_workflow_version_id: string | null;
  archived_by_principal_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  limitations: string[];
  provenance: {
    credential_id: string;
    audit_id: string;
    created_at: string;
  };
}

export interface WorkflowLifecycleValidators {
  draftRequest: ValidateFunction;
  reviewRequest: ValidateFunction;
  approvalRequest: ValidateFunction;
  workflowVersion: ValidateFunction;
  procedureWorkflow: ValidateFunction;
  apiError: ValidateFunction;
}

export interface LifecycleAuditInput {
  auditId: string;
  tenantId: string;
  principalId: string;
  eventType: string;
  entityId: string | null;
  outcome: "success" | "error" | "blocked";
  reasonCode: string;
  requestId: string;
  operation: string;
}

export interface LifecycleIdempotencyScope {
  tenantId: string;
  principalId: string;
  operation: WorkflowLifecycleOperation;
  idempotencyKeySha256: string;
  requestSha256: string;
  now: string;
  expiresAt: string;
}

export type LifecycleIdempotencyClaim =
  | { kind: "new" }
  | { kind: "conflict" }
  | { kind: "processing" }
  | {
      kind: "replay";
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      expiresAt: string;
    };

export interface WorkflowLifecycleRepository {
  consumeRateLimit(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: WorkflowLifecycleRateOperation;
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  claimIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<LifecycleIdempotencyClaim>;
  completeIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void>;
  releaseIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void>;
  invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void>;
  recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string>;
  recordAudit(client: TenantTransactionClient, input: LifecycleAuditInput): Promise<void>;
  createDraft(
    client: TenantTransactionClient,
    input: {
      procedureId: string;
      workflowVersionId: string;
      request: WorkflowDraftRequestV1;
      principal: WorkflowLifecyclePrincipal;
      now: string;
    }
  ): Promise<StoredWorkflowVersion>;
  get(
    client: TenantTransactionClient,
    tenantId: string,
    workflowVersionId: string,
    forUpdate?: boolean
  ): Promise<StoredWorkflowVersion | null>;
  submitForReview(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion>;
  recordReview(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { reviewId: string; decision: WorkflowReviewDecision; notes: string; now: string }
  ): Promise<StoredWorkflowVersion>;
  approve(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { approvalId: string; notes: string; now: string }
  ): Promise<StoredWorkflowVersion>;
  supersede(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: {
      replacementWorkflowVersionId: string;
      approvalId: string;
      notes: string;
      now: string;
    }
  ): Promise<StoredWorkflowVersion>;
  archive(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion>;
}

export interface WorkflowLifecycleApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  repository: WorkflowLifecycleRepository;
  validators: Promise<WorkflowLifecycleValidators> | WorkflowLifecycleValidators;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
  idempotencyTtlSeconds: number;
}

export const mapReview = (review: WorkflowReviewRecord | null): WorkflowVersionResponseV1["latest_review"] =>
  review
    ? {
        review_id: review.reviewId,
        reviewer_principal_id: review.reviewerPrincipalId,
        decision: review.decision,
        notes: review.notes,
        created_at: review.createdAt,
      }
    : null;

export const mapApproval = (
  approval: WorkflowApprovalRecord | null
): WorkflowVersionResponseV1["approval"] =>
  approval
    ? {
        approval_id: approval.approvalId,
        approver_principal_id: approval.approverPrincipalId,
        decision: "approved",
        notes: approval.notes,
        created_at: approval.createdAt,
      }
    : null;
