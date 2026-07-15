import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import type { DomainPackId } from "../domain/types.js";

export type SourceAuthorityClass = string;
export type ProcedureType = string;
export type ProcedureConfidence = "high" | "medium" | "low";
export type ProcedureGapSeverity = "blocking" | "important" | "nice_to_have";
export type EvidenceUse = "cited_text" | "inference" | "validation_required";
export type ProcedureQueryIntent =
  | "documentary_query"
  | "legal_query"
  | "procedural_query"
  | "case_specific_query"
  | "planning_query"
  | "closure_query";
export type ProcedureRetrievalLane = "normative" | "case_context" | "community_context" | "external_reference";
export type ProcedureStepEvidenceStatus = "supported" | "inferred" | "unsupported";
export type ProcedureDeadlineStatus = "cited" | "not_found" | "not_applicable";

export interface ProcedureCitation {
  citationLabel: string;
  sourceType: string;
  pageStart: number | null;
  excerpt: string;
  sourceUrl?: string | null;
  authorityClass: SourceAuthorityClass;
  evidenceUse: EvidenceUse;
}

export interface ProcedureStep {
  stepNumber: number;
  title: string;
  action: string;
  responsibleRole?: string;
  responsibleUnit?: string;
  requiredDocuments: string[];
  outputDocuments: string[];
  decisionPoint?: string;
  decisionPoints: string[];
  dependencies: string[];
  deadline?: string;
  deadlineStatus: ProcedureDeadlineStatus;
  legalBasis: ProcedureCitation[];
  sourceEvidence: ProcedureCitation[];
  evidenceStatus: ProcedureStepEvidenceStatus;
  evidenceMessage: string;
  confidence: ProcedureConfidence;
  notes?: string;
}

export interface ProcedureGap {
  missingItem: string;
  whyItMatters: string;
  requiredToConfirm: string;
  severity: ProcedureGapSeverity;
}

export interface ProcedureRetrievalPlan {
  lane: ProcedureRetrievalLane;
  queries: string[];
}

export interface ProcedureQueryClassification {
  isProcedural: boolean;
  procedureType: ProcedureType;
  queryIntent: ProcedureQueryIntent;
  caseName?: string;
  communityName?: string;
  asksForExactDeadline: boolean;
  asksForCurrentStatus: boolean;
  mentionsExternalMunicipality: boolean;
  externalMunicipalityName?: string;
  retrievalQueries: string[];
  retrievalPlan: ProcedureRetrievalPlan[];
}

export interface ProcedureEvidenceDiagnostic {
  lane: ProcedureRetrievalLane;
  query: string;
  evidenceCount: number;
}

export interface ProcedureDeepDive {
  queryIntent: ProcedureQueryIntent;
  retrievalDiagnostics: ProcedureEvidenceDiagnostic[];
  evidenceByAuthorityClass: Record<string, number>;
  supportedSteps: number;
  inferredSteps: number;
  unsupportedSteps: number;
  governanceWarnings: string[];
}

export interface ProcedureWorkflow {
  id: string;
  title: string;
  jurisdiction: string;
  procedureType: ProcedureType;
  confidence: ProcedureConfidence;
  summary: string;
  classification: ProcedureQueryClassification;
  steps: ProcedureStep[];
  gaps: ProcedureGap[];
  citations: ProcedureCitation[];
  validationWarning: string;
  deepDive: ProcedureDeepDive;
  metadata: {
    domainPackId: DomainPackId;
    domainPackName: string;
    query: string;
    retrievalMode: EvidenceMode;
    evidenceCount: number;
    hasLocalEvidence: boolean;
    hasExternalReference: boolean;
    hasAntiguaEvidence: boolean;
    generatedBy: "procedure_workflow_advisor_mvp" | "procedure_workflow_advisor_deep_dive";
  };
}

export interface ProcedureEvidenceBundle {
  query: string;
  mode: EvidenceMode;
  evidence: EvidenceItem[];
  diagnostics?: ProcedureEvidenceDiagnostic[];
}
