import type { EvidenceItem, EvidenceMode } from "../evidence.js";

export type SourceAuthorityClass =
  | "national_law"
  | "municipal_code"
  | "municipal_manual"
  | "mof"
  | "organigram"
  | "pdm_ot"
  | "pom_poa"
  | "budget"
  | "council_minutes"
  | "community_file"
  | "case_file"
  | "war_room"
  | "external_reference"
  | "unknown";

export type ProcedureType =
  | "public_works"
  | "procurement"
  | "project_execution"
  | "project_closure"
  | "budget"
  | "community_request"
  | "cocode"
  | "council_approval"
  | "unknown";

export type ProcedureConfidence = "high" | "medium" | "low";

export type ProcedureGapSeverity = "blocking" | "important" | "nice_to_have";

export type EvidenceUse = "cited_text" | "inference" | "validation_required";

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
  deadline?: string;
  legalBasis: ProcedureCitation[];
  sourceEvidence: ProcedureCitation[];
  confidence: ProcedureConfidence;
  notes?: string;
}

export interface ProcedureGap {
  missingItem: string;
  whyItMatters: string;
  requiredToConfirm: string;
  severity: ProcedureGapSeverity;
}

export interface ProcedureQueryClassification {
  isProcedural: boolean;
  procedureType: ProcedureType;
  caseName?: string;
  communityName?: string;
  asksForExactDeadline: boolean;
  asksForCurrentStatus: boolean;
  mentionsExternalMunicipality: boolean;
  externalMunicipalityName?: string;
  retrievalQueries: string[];
}

export interface ProcedureWorkflow {
  id: string;
  title: string;
  jurisdiction: "Antigua Guatemala" | "Guatemala national" | "external reference";
  procedureType: ProcedureType;
  confidence: ProcedureConfidence;
  summary: string;
  classification: ProcedureQueryClassification;
  steps: ProcedureStep[];
  gaps: ProcedureGap[];
  citations: ProcedureCitation[];
  validationWarning: string;
  metadata: {
    query: string;
    retrievalMode: EvidenceMode;
    evidenceCount: number;
    hasExternalReference: boolean;
    hasAntiguaEvidence: boolean;
    generatedBy: "procedure_workflow_advisor_mvp";
  };
}

export interface ProcedureEvidenceBundle {
  query: string;
  mode: EvidenceMode;
  evidence: EvidenceItem[];
}
