export const PROCEDURE_TYPES = [
  "public_works",
  "procurement",
  "project_execution",
  "project_closure",
  "budget",
  "community_request",
  "cocode",
  "council_approval",
  "unknown",
] as const;

export const PROCEDURE_JURISDICTIONS = [
  "Antigua Guatemala",
  "Guatemala national",
  "external reference",
] as const;

export const PROCEDURE_CONFIDENCE = ["high", "medium", "low"] as const;

export const PROCEDURE_FEEDBACK_TYPES = [
  "missing_document",
  "wrong_or_unclear_step",
  "unclear_responsible",
  "missing_legal_basis",
  "missing_deadline",
  "missing_case_evidence",
  "other",
] as const;

export type ProcedureType = (typeof PROCEDURE_TYPES)[number];
export type ProcedureJurisdiction = (typeof PROCEDURE_JURISDICTIONS)[number];
export type ProcedureConfidence = (typeof PROCEDURE_CONFIDENCE)[number];
export type ProcedureFeedbackType = (typeof PROCEDURE_FEEDBACK_TYPES)[number];

export interface ProcedureFeedbackInput {
  domainPackId: string;
  workflowId: string;
  workflowTitle: string;
  procedureType: ProcedureType;
  jurisdiction: ProcedureJurisdiction;
  confidence: ProcedureConfidence;
  query: string;
  stepNumber: string;
  stepTitle: string;
  feedbackType: ProcedureFeedbackType;
  comment: string;
}

export interface ProcedureFeedbackRecord extends ProcedureFeedbackInput {
  id: string;
  isExternalReference: boolean;
  createdAt: string;
  retentionUntil: string;
}

export interface ProcedureFeedbackFilters {
  limit: number;
  feedbackType?: ProcedureFeedbackType;
  workflowId?: string;
}

export interface ProcedureFeedbackListResult {
  items: ProcedureFeedbackRecord[];
  total: number;
}

export interface ProcedureFeedbackRepository {
  create(input: ProcedureFeedbackInput): Promise<ProcedureFeedbackRecord>;
  list(filters: ProcedureFeedbackFilters): Promise<ProcedureFeedbackListResult>;
}

export interface ProcedureFeedbackRateLimiter {
  consume(key: string): boolean;
}

export interface ProcedureFeedbackDependencies {
  repository: ProcedureFeedbackRepository;
  apiToken?: string;
  rateLimiter: ProcedureFeedbackRateLimiter;
}
