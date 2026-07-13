import type { DomainPack, DomainWorkflowTemplate } from "../domain/types.js";
import type { EditableWorkflowTemplate } from "./types.js";

const toSafeId = (value: string, fallback: string): string => {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
};

export const convertDomainWorkflowTemplate = (
  template: DomainWorkflowTemplate,
  domainPack: DomainPack
): EditableWorkflowTemplate => ({
  domainPackId: domainPack.id,
  workflowId: toSafeId(template.workflowType, "workflow"),
  workflowType: template.workflowType,
  title: template.title,
  description:
    domainPack.workflowTypes.find((item) => item.id === template.workflowType)?.description ??
    template.defaultSummary,
  defaultSummary: template.defaultSummary,
  validationWarning: template.validationWarning,
  governanceRules: domainPack.governanceRules.map((rule) => rule.id),
  evidenceRequirement: "required",
  authoritative: false,
  steps: template.steps.map((step, index) => ({
    id: toSafeId(step.title, `step-${index + 1}`),
    order: index + 1,
    label: step.title,
    action: step.action,
    requiredDocuments: [...step.requiredDocuments],
    outputDocuments: [...step.outputDocuments],
    allowedSourceAuthorities: domainPack.sourceAuthorityClasses.map((authority) => authority.id),
    governanceRules: domainPack.governanceRules.map((rule) => rule.id),
    evidencePatterns: [...step.evidencePatterns],
    humanValidationRequired: true,
    notes: step.notes,
  })),
});
