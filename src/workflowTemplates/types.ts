export type WorkflowEvidenceRequirement = "none" | "recommended" | "required";

export interface EditableWorkflowTemplateStep {
  id: string;
  order: number;
  label: string;
  action: string;
  requiredDocuments: string[];
  outputDocuments: string[];
  allowedSourceAuthorities: string[];
  governanceRules: string[];
  evidencePatterns: string[];
  humanValidationRequired?: boolean;
  notes?: string;
}

export interface EditableWorkflowTemplate {
  domainPackId: string;
  workflowId: string;
  workflowType: string;
  title: string;
  description: string;
  defaultSummary: string;
  validationWarning: string;
  governanceRules: string[];
  evidenceRequirement: WorkflowEvidenceRequirement;
  authoritative: boolean;
  steps: EditableWorkflowTemplateStep[];
}

export interface EditableWorkflowTemplateCollection {
  schemaVersion: 1;
  domainPackId: string;
  templates: EditableWorkflowTemplate[];
}
