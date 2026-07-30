import type { SecurityRole } from "../security/index.js";

export type WorkflowLifecycleStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "superseded"
  | "archived";

export type WorkflowGenerationSource = "ai" | "human" | "import";
export type WorkflowReviewDecision = "changes_requested" | "recommended_for_approval";

export interface WorkflowLifecycleActor {
  principalId: string;
  tenantId: string;
  roles: readonly SecurityRole[];
}

export interface WorkflowReviewRecord {
  reviewId: string;
  reviewerPrincipalId: string;
  decision: WorkflowReviewDecision;
  notes: string;
  createdAt: string;
}

export interface WorkflowApprovalRecord {
  approvalId: string;
  approverPrincipalId: string;
  decision: "approved";
  notes: string;
  createdAt: string;
}

export interface WorkflowVersionRecord {
  workflowVersionId: string;
  tenantId: string;
  procedureId: string;
  versionNumber: number;
  lifecycleStatus: WorkflowLifecycleStatus;
  generationSource: WorkflowGenerationSource;
  createdByPrincipalId: string;
  jurisdiction: string;
  title: string;
  workflowDefinition: Record<string, unknown>;
  evidenceBundleId: string | null;
  revision: number;
  submittedByPrincipalId: string | null;
  submittedAt: string | null;
  latestReview: WorkflowReviewRecord | null;
  approval: WorkflowApprovalRecord | null;
  supersededByWorkflowVersionId: string | null;
  archivedByPrincipalId: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InitializeWorkflowVersionInput {
  workflowVersionId: string;
  tenantId: string;
  procedureId: string;
  versionNumber: number;
  generationSource: WorkflowGenerationSource;
  createdByPrincipalId: string;
  jurisdiction: string;
  title: string;
  workflowDefinition: Record<string, unknown>;
  evidenceBundleId?: string | null;
  now: string;
}

export interface ReviseWorkflowDraftInput {
  workflowDefinition: Record<string, unknown>;
  title?: string;
  jurisdiction?: string;
  evidenceBundleId?: string | null;
  now: string;
}

export interface WorkflowReviewInput {
  reviewId: string;
  decision: WorkflowReviewDecision;
  notes: string;
  now: string;
}

export interface WorkflowApprovalInput {
  approvalId: string;
  notes: string;
  now: string;
}

export interface WorkflowSupersessionInput {
  replacementWorkflowVersionId: string;
  now: string;
}

export interface WorkflowSupersessionApprovalInput extends WorkflowSupersessionInput {
  approvalId: string;
  notes: string;
}

export interface WorkflowSupersessionResult {
  superseded: WorkflowVersionRecord;
  replacement: WorkflowVersionRecord;
}
