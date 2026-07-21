import type { SecurityRole } from "../security/index.js";
import type {
  InitializeWorkflowVersionInput,
  ReviseWorkflowDraftInput,
  WorkflowApprovalInput,
  WorkflowLifecycleActor,
  WorkflowReviewInput,
  WorkflowSupersessionInput,
  WorkflowVersionRecord,
} from "./types.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 300;
const MAX_JURISDICTION_LENGTH = 500;
const MAX_REVIEW_NOTES_LENGTH = 4000;
const MAX_DEFINITION_BYTES = 2 * 1024 * 1024;

const AUTHOR_ROLES = new Set<SecurityRole>([
  "platform_admin",
  "tenant_admin",
  "procedure_author",
]);
const REVIEWER_ROLES = new Set<SecurityRole>([
  "platform_admin",
  "tenant_admin",
  "procedure_reviewer",
]);
const APPROVER_ROLES = new Set<SecurityRole>([
  "platform_admin",
  "tenant_admin",
  "procedure_approver",
]);

export class WorkflowLifecycleError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "WorkflowLifecycleError";
  }
}

const normalizedText = (value: string, field: string, maxLength: number): string => {
  if (typeof value !== "string") {
    throw new WorkflowLifecycleError("workflow_input_invalid", `${field} must be a string`);
  }
  const normalized = value.normalize("NFC").trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new WorkflowLifecycleError("workflow_input_invalid", `${field} is outside policy`);
  }
  return normalized;
};

const canonicalUuid = (value: string, field: string): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new WorkflowLifecycleError("workflow_identity_invalid", `${field} must be a UUID`);
  }
  return value.toLowerCase();
};

const canonicalTime = (value: string, field: string): string => {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new WorkflowLifecycleError("workflow_time_invalid", `${field} must be an ISO timestamp`);
  }
  return new Date(milliseconds).toISOString();
};

const clonedDefinition = (value: Record<string, unknown>): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowLifecycleError(
      "workflow_definition_invalid",
      "workflowDefinition must be a JSON object"
    );
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new WorkflowLifecycleError(
      "workflow_definition_invalid",
      "workflowDefinition must be serializable JSON"
    );
  }
  if (Buffer.byteLength(serialized, "utf8") < 2 || Buffer.byteLength(serialized, "utf8") > MAX_DEFINITION_BYTES) {
    throw new WorkflowLifecycleError(
      "workflow_definition_invalid",
      "workflowDefinition is outside the 2 MB policy"
    );
  }
  return JSON.parse(serialized) as Record<string, unknown>;
};

const hasRole = (actor: WorkflowLifecycleActor, allowed: ReadonlySet<SecurityRole>): boolean =>
  actor.roles.some((role) => allowed.has(role));

const requireRole = (
  actor: WorkflowLifecycleActor,
  allowed: ReadonlySet<SecurityRole>,
  code: string
): void => {
  if (!hasRole(actor, allowed)) {
    throw new WorkflowLifecycleError(code, "The actor is not authorized for this transition");
  }
};

const requireTenant = (record: WorkflowVersionRecord, actor: WorkflowLifecycleActor): void => {
  if (canonicalUuid(actor.tenantId, "actor.tenantId") !== record.tenantId) {
    throw new WorkflowLifecycleError("workflow_tenant_denied", "Workflow tenant access denied");
  }
  canonicalUuid(actor.principalId, "actor.principalId");
};

const requireStatus = (
  record: WorkflowVersionRecord,
  expected: WorkflowVersionRecord["lifecycleStatus"]
): void => {
  if (record.lifecycleStatus !== expected) {
    throw new WorkflowLifecycleError(
      "workflow_transition_invalid",
      `Workflow must be ${expected} for this transition`
    );
  }
};

const cloneRecord = (record: WorkflowVersionRecord): WorkflowVersionRecord =>
  structuredClone(record);

export const initializeWorkflowVersion = (
  input: InitializeWorkflowVersionInput
): WorkflowVersionRecord => {
  const createdAt = canonicalTime(input.now, "now");
  if (!Number.isSafeInteger(input.versionNumber) || input.versionNumber < 1) {
    throw new WorkflowLifecycleError(
      "workflow_version_invalid",
      "versionNumber must be a positive integer"
    );
  }
  if (!(["ai", "human", "import"] as const).includes(input.generationSource)) {
    throw new WorkflowLifecycleError(
      "workflow_generation_source_invalid",
      "generationSource is unsupported"
    );
  }

  // Every newly created workflow version starts as draft. This is mandatory for AI output
  // and intentionally applies to human/imported drafts as the safer publication boundary.
  return {
    workflowVersionId: canonicalUuid(input.workflowVersionId, "workflowVersionId"),
    tenantId: canonicalUuid(input.tenantId, "tenantId"),
    procedureId: canonicalUuid(input.procedureId, "procedureId"),
    versionNumber: input.versionNumber,
    lifecycleStatus: "draft",
    generationSource: input.generationSource,
    createdByPrincipalId: canonicalUuid(input.createdByPrincipalId, "createdByPrincipalId"),
    jurisdiction: normalizedText(input.jurisdiction, "jurisdiction", MAX_JURISDICTION_LENGTH),
    title: normalizedText(input.title, "title", MAX_TITLE_LENGTH),
    workflowDefinition: clonedDefinition(input.workflowDefinition),
    evidenceBundleId: input.evidenceBundleId
      ? canonicalUuid(input.evidenceBundleId, "evidenceBundleId")
      : null,
    revision: 1,
    submittedByPrincipalId: null,
    submittedAt: null,
    latestReview: null,
    approval: null,
    supersededByWorkflowVersionId: null,
    archivedByPrincipalId: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
};

export const reviseWorkflowDraft = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  input: ReviseWorkflowDraftInput
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, AUTHOR_ROLES, "workflow_authorization_denied");
  requireStatus(record, "draft");
  const updated = cloneRecord(record);
  updated.workflowDefinition = clonedDefinition(input.workflowDefinition);
  if (input.title !== undefined) {
    updated.title = normalizedText(input.title, "title", MAX_TITLE_LENGTH);
  }
  if (input.jurisdiction !== undefined) {
    updated.jurisdiction = normalizedText(
      input.jurisdiction,
      "jurisdiction",
      MAX_JURISDICTION_LENGTH
    );
  }
  if (input.evidenceBundleId !== undefined) {
    updated.evidenceBundleId = input.evidenceBundleId
      ? canonicalUuid(input.evidenceBundleId, "evidenceBundleId")
      : null;
  }
  updated.revision += 1;
  updated.updatedAt = canonicalTime(input.now, "now");
  updated.latestReview = null;
  updated.approval = null;
  return updated;
};

export const submitWorkflowForReview = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  now: string
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, AUTHOR_ROLES, "workflow_authorization_denied");
  requireStatus(record, "draft");
  const updated = cloneRecord(record);
  updated.lifecycleStatus = "in_review";
  updated.submittedByPrincipalId = canonicalUuid(actor.principalId, "actor.principalId");
  updated.submittedAt = canonicalTime(now, "now");
  updated.updatedAt = updated.submittedAt;
  updated.latestReview = null;
  updated.approval = null;
  return updated;
};

export const recordWorkflowReview = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  input: WorkflowReviewInput
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, REVIEWER_ROLES, "workflow_review_denied");
  requireStatus(record, "in_review");
  const reviewerPrincipalId = canonicalUuid(actor.principalId, "actor.principalId");
  if (reviewerPrincipalId === record.createdByPrincipalId) {
    throw new WorkflowLifecycleError(
      "workflow_separation_of_duties",
      "The workflow creator cannot review the same version"
    );
  }
  const createdAt = canonicalTime(input.now, "now");
  const updated = cloneRecord(record);
  updated.latestReview = {
    reviewId: canonicalUuid(input.reviewId, "reviewId"),
    reviewerPrincipalId,
    decision: input.decision,
    notes: normalizedText(input.notes, "notes", MAX_REVIEW_NOTES_LENGTH),
    createdAt,
  };
  updated.updatedAt = createdAt;
  if (input.decision === "changes_requested") {
    updated.lifecycleStatus = "draft";
    updated.submittedByPrincipalId = null;
    updated.submittedAt = null;
    updated.approval = null;
  } else if (input.decision !== "recommended_for_approval") {
    throw new WorkflowLifecycleError(
      "workflow_review_invalid",
      "Review decision is unsupported"
    );
  }
  return updated;
};

export const approveWorkflowVersion = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  input: WorkflowApprovalInput
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, APPROVER_ROLES, "workflow_approval_denied");
  requireStatus(record, "in_review");
  const approverPrincipalId = canonicalUuid(actor.principalId, "actor.principalId");
  if (!record.latestReview || record.latestReview.decision !== "recommended_for_approval") {
    throw new WorkflowLifecycleError(
      "workflow_review_required",
      "A recommended human review is required before approval"
    );
  }
  if (
    approverPrincipalId === record.createdByPrincipalId ||
    approverPrincipalId === record.latestReview.reviewerPrincipalId
  ) {
    throw new WorkflowLifecycleError(
      "workflow_separation_of_duties",
      "Creator, reviewer, and approver must be distinct principals"
    );
  }
  const createdAt = canonicalTime(input.now, "now");
  const updated = cloneRecord(record);
  updated.lifecycleStatus = "approved";
  updated.approval = {
    approvalId: canonicalUuid(input.approvalId, "approvalId"),
    approverPrincipalId,
    decision: "approved",
    notes: normalizedText(input.notes, "notes", MAX_REVIEW_NOTES_LENGTH),
    createdAt,
  };
  updated.updatedAt = createdAt;
  return updated;
};

export const supersedeWorkflowVersion = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  input: WorkflowSupersessionInput
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, APPROVER_ROLES, "workflow_approval_denied");
  requireStatus(record, "approved");
  const replacement = canonicalUuid(
    input.replacementWorkflowVersionId,
    "replacementWorkflowVersionId"
  );
  if (replacement === record.workflowVersionId) {
    throw new WorkflowLifecycleError(
      "workflow_supersession_invalid",
      "A workflow version cannot supersede itself"
    );
  }
  const updated = cloneRecord(record);
  updated.lifecycleStatus = "superseded";
  updated.supersededByWorkflowVersionId = replacement;
  updated.updatedAt = canonicalTime(input.now, "now");
  return updated;
};

export const archiveWorkflowVersion = (
  record: WorkflowVersionRecord,
  actor: WorkflowLifecycleActor,
  now: string
): WorkflowVersionRecord => {
  requireTenant(record, actor);
  requireRole(actor, APPROVER_ROLES, "workflow_archive_denied");
  if (record.lifecycleStatus === "archived") {
    throw new WorkflowLifecycleError(
      "workflow_transition_invalid",
      "Archived workflow versions are terminal"
    );
  }
  const archivedAt = canonicalTime(now, "now");
  const updated = cloneRecord(record);
  updated.lifecycleStatus = "archived";
  updated.archivedByPrincipalId = canonicalUuid(actor.principalId, "actor.principalId");
  updated.archivedAt = archivedAt;
  updated.updatedAt = archivedAt;
  return updated;
};
