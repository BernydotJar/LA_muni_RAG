export type DomainPackId = "municipal-antigua" | "hr" | "finance" | "sales-sop" | "custom";

export type DomainAuthorityLevel = "primary" | "national" | "comparative" | "context" | "unknown";

export type DomainDocumentConfidentiality = "public" | "internal" | "restricted";

export interface DomainBranding {
  productName: string;
  assistantName: string;
  organizationName?: string;
  primaryLabel: string;
}

export interface DomainWorkflowType {
  id: string;
  label: string;
  description: string;
  retrievalHints: string[];
}

export interface DomainSourceAuthority {
  id: string;
  label: string;
  description: string;
  authorityLevel: DomainAuthorityLevel;
  titleKeywords: string[];
  sourceTypes: string[];
  externalReference?: boolean;
}

export interface DomainClassifierRule {
  id: string;
  workflowType: string;
  keywords: string[];
  retrievalQueries: string[];
}

export interface DomainWorkflowTemplateStep {
  title: string;
  action: string;
  requiredDocuments: string[];
  outputDocuments: string[];
  evidencePatterns: string[];
  notes?: string;
}

export interface DomainWorkflowTemplate {
  workflowType: string;
  title: string;
  defaultSummary: string;
  validationWarning: string;
  steps: DomainWorkflowTemplateStep[];
}

export interface DomainGovernanceRule {
  id: string;
  label: string;
  warning: string;
  appliesToAuthorityClasses?: string[];
  appliesWhenNoLocalEvidence?: boolean;
}

export interface DomainFeedbackType {
  id: string;
  label: string;
  description: string;
}

export interface DomainEvaluationCase {
  id: string;
  query: string;
  expectedWorkflowType: string;
  expectedAuthorityClass?: string;
  notes: string;
}

export interface DomainPack {
  id: DomainPackId;
  name: string;
  description: string;
  language: string;
  branding: DomainBranding;
  workflowTypes: DomainWorkflowType[];
  sourceAuthorityClasses: DomainSourceAuthority[];
  classifierRules: DomainClassifierRule[];
  workflowTemplates: DomainWorkflowTemplate[];
  governanceRules: DomainGovernanceRule[];
  feedbackTypes: DomainFeedbackType[];
  exampleQueries: string[];
  evaluationCases: DomainEvaluationCase[];
}

export interface DomainDocumentMetadata {
  domainPackId: string;
  sourceAuthorityClass: string;
  documentType: string;
  jurisdiction?: string;
  organization?: string;
  confidentiality?: DomainDocumentConfidentiality;
  effectiveDate?: string;
  expirationDate?: string;
  tags?: string[];
}

export interface DomainPackSummary {
  id: DomainPackId;
  name: string;
  language: string;
  branding: DomainBranding;
}
