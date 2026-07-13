import type { DomainPack } from "./types.js";

export class DomainPackValidationError extends Error {
  readonly code = "invalid_domain_pack_contract";

  constructor(message: string) {
    super(message);
    this.name = "DomainPackValidationError";
  }
}

const requireNonEmpty = (value: string, field: string): void => {
  if (!value.trim()) {
    throw new DomainPackValidationError(`${field} is required`);
  }
};

const assertUnique = (values: string[], field: string): void => {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new DomainPackValidationError(`${field} contains duplicate value: ${value}`);
    seen.add(value);
  }
};

export const validateDomainPack = (pack: DomainPack): DomainPack => {
  requireNonEmpty(pack.id, "id");
  requireNonEmpty(pack.name, "name");
  requireNonEmpty(pack.language, "language");
  requireNonEmpty(pack.branding.productName, "branding.productName");
  requireNonEmpty(pack.branding.assistantName, "branding.assistantName");
  requireNonEmpty(pack.branding.primaryLabel, "branding.primaryLabel");

  if (pack.workflowTypes.length === 0) throw new DomainPackValidationError(`${pack.id} must define workflow types`);
  if (pack.sourceAuthorityClasses.length === 0) throw new DomainPackValidationError(`${pack.id} must define source authority classes`);
  if (pack.classifierRules.length === 0) throw new DomainPackValidationError(`${pack.id} must define classifier rules`);
  if (pack.workflowTemplates.length === 0) throw new DomainPackValidationError(`${pack.id} must define workflow templates`);

  const workflowTypeIds = pack.workflowTypes.map((item) => item.id);
  const authorityIds = pack.sourceAuthorityClasses.map((item) => item.id);
  const feedbackIds = pack.feedbackTypes.map((item) => item.id);
  assertUnique(workflowTypeIds, `${pack.id}.workflowTypes`);
  assertUnique(authorityIds, `${pack.id}.sourceAuthorityClasses`);
  assertUnique(pack.classifierRules.map((item) => item.id), `${pack.id}.classifierRules`);
  assertUnique(pack.workflowTemplates.map((item) => item.workflowType), `${pack.id}.workflowTemplates`);
  assertUnique(feedbackIds, `${pack.id}.feedbackTypes`);

  const workflowTypeSet = new Set(workflowTypeIds);
  for (const rule of pack.classifierRules) {
    if (!workflowTypeSet.has(rule.workflowType)) {
      throw new DomainPackValidationError(`${pack.id}.classifierRules references unknown workflow type: ${rule.workflowType}`);
    }
  }
  for (const template of pack.workflowTemplates) {
    if (!workflowTypeSet.has(template.workflowType)) {
      throw new DomainPackValidationError(`${pack.id}.workflowTemplates references unknown workflow type: ${template.workflowType}`);
    }
    if (template.steps.length === 0) {
      throw new DomainPackValidationError(`${pack.id}.${template.workflowType} must define at least one step`);
    }
  }

  const authoritySet = new Set(authorityIds);
  for (const rule of pack.governanceRules) {
    for (const authorityClass of rule.appliesToAuthorityClasses ?? []) {
      if (!authoritySet.has(authorityClass)) {
        throw new DomainPackValidationError(`${pack.id}.governanceRules references unknown authority class: ${authorityClass}`);
      }
    }
  }

  return pack;
};
