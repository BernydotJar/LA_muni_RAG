import type { ValidateFunction } from "ajv";
import type {
  AuthenticatedPrincipal,
  IdentityRepository,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";

export const PROCEDURE_CASES_ROUTE = "/api/v1/procedure-cases";
export const PROCEDURE_CASES_ROUTE_PREFIX = "/api/v1/procedure-cases/";

export type ProcedureCaseStatus = "active" | "blocked" | "ready_for_review" | "closed";
export type ProcedureCaseValidationState =
  | "unreviewed"
  | "in_review"
  | "validated"
  | "changes_required";
export type ProcedureCaseStepState =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_review"
  | "completed";
export type ProcedureCaseDocumentState = "missing" | "requested" | "received" | "reviewed";

export interface ProcedureCaseCreateRequestV1 {
  schema_version: "v1";
  operation: "create";
  request_id: string;
  tenant_id: string;
  case_key: string;
  workflow_version_id: string;
  jurisdiction: string;
  subject_reference?: string;
  community_reference?: string;
  follow_up_at?: string | null;
  provenance: { credential_id: string };
}

export type ProcedureCaseActionV1 =
  | { type: "set_step_state"; step_id: string; state: ProcedureCaseStepState }
  | {
      type: "record_document";
      requirement_id: string;
      state: ProcedureCaseDocumentState;
      document_version_id?: string | null;
      note?: string;
    }
  | { type: "add_blocker"; blocker_code: string; description: string }
  | { type: "resolve_blocker"; blocker_id: string }
  | { type: "set_follow_up"; follow_up_at: string | null }
  | { type: "set_validation_state"; validation_state: ProcedureCaseValidationState }
  | { type: "append_note"; note: string }
  | { type: "close_case"; note: string };

export interface ProcedureCaseUpdateRequestV1 {
  schema_version: "v1";
  operation: "update";
  request_id: string;
  tenant_id: string;
  case_id: string;
  expected_revision: number;
  action: ProcedureCaseActionV1;
  provenance: { credential_id: string };
}

export type ProcedureCaseRequestV1 = ProcedureCaseCreateRequestV1 | ProcedureCaseUpdateRequestV1;

export interface ProcedureCaseStepRecord {
  stepId: string;
  title: string;
  ordinal: number;
  state: ProcedureCaseStepState;
  updatedByPrincipalId: string;
  updatedAt: string;
}

export interface ProcedureCaseDocumentRecord {
  documentReferenceId: string;
  requirementId: string;
  documentVersionId: string | null;
  state: ProcedureCaseDocumentState;
  note: string | null;
  updatedByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcedureCaseBlockerRecord {
  blockerId: string;
  blockerCode: string;
  description: string;
  resolvedAt: string | null;
  resolvedByPrincipalId: string | null;
  createdByPrincipalId: string;
  createdAt: string;
}

export interface ProcedureCaseEventRecord {
  eventId: string;
  actorPrincipalId: string;
  eventType: string;
  revision: number;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface StoredProcedureCase {
  caseId: string;
  tenantId: string;
  caseKey: string;
  workflowVersionId: string;
  workflowVersionNumber: number;
  jurisdiction: string;
  subjectReference: string | null;
  communityReference: string | null;
  status: ProcedureCaseStatus;
  validationState: ProcedureCaseValidationState;
  currentStepId: string | null;
  followUpAt: string | null;
  operationalNote: string | null;
  revision: number;
  createdByPrincipalId: string;
  updatedByPrincipalId: string;
  createdAt: string;
  updatedAt: string;
  steps: ProcedureCaseStepRecord[];
  documents: ProcedureCaseDocumentRecord[];
  blockers: ProcedureCaseBlockerRecord[];
  events: ProcedureCaseEventRecord[];
}

export interface ProcedureCaseResponseV1 {
  schema_version: "v1";
  response_type: "procedure_case";
  request_id: string;
  tenant_id: string;
  case: {
    case_id: string;
    case_key: string;
    workflow_version_id: string;
    workflow_version_number: number;
    jurisdiction: string;
    subject_reference: string | null;
    community_reference: string | null;
    status: ProcedureCaseStatus;
    validation_state: ProcedureCaseValidationState;
    current_step_id: string | null;
    follow_up_at: string | null;
    operational_note: string | null;
    revision: number;
    created_by_principal_id: string;
    updated_by_principal_id: string;
    created_at: string;
    updated_at: string;
    steps: Array<{
      step_id: string;
      title: string;
      ordinal: number;
      state: ProcedureCaseStepState;
      updated_by_principal_id: string;
      updated_at: string;
    }>;
    documents: Array<{
      document_reference_id: string;
      requirement_id: string;
      document_version_id: string | null;
      state: ProcedureCaseDocumentState;
      note: string | null;
      updated_by_principal_id: string;
      created_at: string;
      updated_at: string;
    }>;
    blockers: Array<{
      blocker_id: string;
      blocker_code: string;
      description: string;
      resolved_at: string | null;
      resolved_by_principal_id: string | null;
      created_by_principal_id: string;
      created_at: string;
    }>;
    audit_trail: Array<{
      event_id: string;
      actor_principal_id: string;
      event_type: string;
      revision: number;
      details: Record<string, unknown>;
      created_at: string;
    }>;
  };
  limitations: string[];
  provenance: {
    credential_id: string;
    audit_id: string;
    created_at: string;
  };
}

export interface ProcedureCaseValidators {
  request: ValidateFunction;
  response: ValidateFunction;
  apiError: ValidateFunction;
}

export interface ProcedureCaseAuditInput {
  auditId: string;
  tenantId: string;
  principalId: string;
  credentialId: string;
  requestId: string;
  eventType: string;
  entityId: string | null;
  outcome: "success" | "error" | "blocked";
  reasonCode: string;
  operation: "procedure_case_create_v1" | "procedure_case_update_v1" | "procedure_case_read_v1";
}

export interface ProcedureCaseIdempotencyScope {
  tenantId: string;
  principalId: string;
  operation: "procedure_case_create_v1" | "procedure_case_update_v1";
  idempotencyKeySha256: string;
  requestSha256: string;
  now: string;
  expiresAt: string;
}

export type ProcedureCaseIdempotencyClaim =
  | { kind: "new" }
  | { kind: "conflict" }
  | { kind: "processing" }
  | { kind: "replay"; responseStatus: 200 | 201; responseBody: string; auditId: string };

export type ProcedureCaseCreateResult =
  | { kind: "created"; record: StoredProcedureCase }
  | { kind: "replay"; responseStatus: 201; responseBody: string; auditId: string };

export interface ProcedureCaseRepository {
  consumeRateLimit(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: ProcedureCaseAuditInput["operation"];
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
  claimIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<ProcedureCaseIdempotencyClaim>;
  completeIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void>;
  releaseIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void>;
  invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void>;
  recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string>;
  recordAudit(client: TenantTransactionClient, input: ProcedureCaseAuditInput): Promise<void>;
  create(
    client: TenantTransactionClient,
    input: {
      caseId: string;
      eventId: string;
      request: ProcedureCaseCreateRequestV1;
      principal: AuthenticatedPrincipal;
      now: string;
      requestSha256: string;
    }
  ): Promise<ProcedureCaseCreateResult>;
  sealCreation(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      caseId: string;
      principalId: string;
      requestSha256: string;
      responseBody: string;
      auditId: string;
    }
  ): Promise<void>;
  get(
    client: TenantTransactionClient,
    tenantId: string,
    caseId: string,
    forUpdate?: boolean
  ): Promise<StoredProcedureCase | null>;
  applyAction(
    client: TenantTransactionClient,
    record: StoredProcedureCase,
    input: {
      request: ProcedureCaseUpdateRequestV1;
      principal: AuthenticatedPrincipal;
      eventId: string;
      entityId: string;
      now: string;
    }
  ): Promise<StoredProcedureCase>;
}

export interface ProcedureCaseApiDependencies {
  identityRepository: IdentityRepository;
  transactionPool: TenantTransactionPool;
  repository: ProcedureCaseRepository;
  validators: Promise<ProcedureCaseValidators> | ProcedureCaseValidators;
  now: () => Date;
  createUuid: () => string;
  rateLimit: number;
  rateWindowSeconds: number;
  idempotencyTtlSeconds: number;
}

export class ProcedureCaseError extends Error {
  constructor(
    public readonly code:
      | "workflow_not_approved"
      | "case_conflict"
      | "case_not_found"
      | "revision_conflict"
      | "step_not_found"
      | "document_not_found"
      | "blocker_not_found"
      | "invalid_transition",
    message: string
  ) {
    super(message);
    this.name = "ProcedureCaseError";
  }
}
