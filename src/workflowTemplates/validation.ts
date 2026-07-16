import type { DomainPack } from "../domain/types.js";
import type {
  EditableWorkflowTemplate,
  EditableWorkflowTemplateCollection,
  EditableWorkflowTemplateStep,
} from "./types.js";

export class WorkflowTemplateValidationError extends Error {
  readonly code = "invalid_workflow_template";

  constructor(message: string) {
    super(message);
    this.name = "WorkflowTemplateValidationError";
  }
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new WorkflowTemplateValidationError(`${field} is required`);
  }
  return value.trim();
};

const requireSafeId = (value: unknown, field: string): string => {
  const id = requireText(value, field);
  if (!SAFE_ID.test(id)) {
    throw new WorkflowTemplateValidationError(`${field} must be safe kebab-case`);
  }
  return id;
};

const requireStringArray = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value)) {
    throw new WorkflowTemplateValidationError(`${field} must be an array`);
  }
  const items = value.map((item, index) => requireText(item, `${field}[${index}]`));
  if (new Set(items).size !== items.length) {
    throw new WorkflowTemplateValidationError(`${field} contains duplicate values`);
  }
  return items;
};

const validateStep = (
  value: unknown,
  index: number,
  authorityIds: Set<string>,
  governanceIds: Set<string>
): EditableWorkflowTemplateStep => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowTemplateValidationError(`steps[${index}] must be an object`);
  }

  const step = value as Record<string, unknown>;
  const order = step.order;
  if (!Number.isInteger(order) || Number(order) < 1) {
    throw new WorkflowTemplateValidationError(`steps[${index}].order must be a positive integer`);
  }

  const allowedSourceAuthorities = requireStringArray(
    step.allowedSourceAuthorities,
    `steps[${index}].allowedSourceAuthorities`
  );
  for (const authorityId of allowedSourceAuthorities) {
    if (!authorityIds.has(authorityId)) {
      throw new WorkflowTemplateValidationError(
        `steps[${index}] references unknown source authority: ${authorityId}`
      );
    }
  }

  const governanceRules = requireStringArray(step.governanceRules, `steps[${index}].governanceRules`);
  for (const governanceId of governanceRules) {
    if (!governanceIds.has(governanceId)) {
      throw new WorkflowTemplateValidationError(
        `steps[${index}] references unknown governance rule: ${governanceId}`
      );
    }
  }

  return {
    id: requireSafeId(step.id, `steps[${index}].id`),
    order: Number(order),
    label: requireText(step.label, `steps[${index}].label`),
    action: requireText(step.action, `steps[${index}].action`),
    requiredDocuments: requireStringArray(step.requiredDocuments, `steps[${index}].requiredDocuments`),
    outputDocuments: requireStringArray(step.outputDocuments, `steps[${index}].outputDocuments`),
    allowedSourceAuthorities,
    governanceRules,
    evidencePatterns: requireStringArray(step.evidencePatterns, `steps[${index}].evidencePatterns`),
    humanValidationRequired:
      typeof step.humanValidationRequired === "boolean" ? step.humanValidationRequired : undefined,
    notes: typeof step.notes === "string" && step.notes.trim() ? step.notes.trim() : undefined,
  };
};

export const validateEditableWorkflowTemplate = (
  value: unknown,
  domainPack: DomainPack
): EditableWorkflowTemplate => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowTemplateValidationError("template must be an object");
  }

  const template = value as Record<string, unknown>;
  const domainPackId = requireSafeId(template.domainPackId, "domainPackId");
  if (domainPackId !== domainPack.id) {
    throw new WorkflowTemplateValidationError(
      `template domainPackId ${domainPackId} does not match owning pack ${domainPack.id}`
    );
  }

  const workflowType = requireText(template.workflowType, "workflowType");
  if (!domainPack.workflowTypes.some((item) => item.id === workflowType)) {
    throw new WorkflowTemplateValidationError(`unknown workflow type: ${workflowType}`);
  }

  const evidenceRequirement = template.evidenceRequirement;
  if (evidenceRequirement !== "none" && evidenceRequirement !== "recommended" && evidenceRequirement !== "required") {
    throw new WorkflowTemplateValidationError("evidenceRequirement must be none, recommended, or required");
  }

  const authoritative = template.authoritative === true;
  if (authoritative && evidenceRequirement !== "required") {
    throw new WorkflowTemplateValidationError("authoritative templates must require evidence");
  }

  const governanceIds = new Set(domainPack.governanceRules.map((rule) => rule.id));
  const authorityIds = new Set(domainPack.sourceAuthorityClasses.map((authority) => authority.id));
  const governanceRules = requireStringArray(template.governanceRules, "governanceRules");
  for (const governanceId of governanceRules) {
    if (!governanceIds.has(governanceId)) {
      throw new WorkflowTemplateValidationError(`unknown governance rule: ${governanceId}`);
    }
  }

  if (!Array.isArray(template.steps) || template.steps.length === 0) {
    throw new WorkflowTemplateValidationError("steps must contain at least one step");
  }
  const steps = template.steps.map((step, index) =>
    validateStep(step, index, authorityIds, governanceIds)
  );

  const stepIds = steps.map((step) => step.id);
  if (new Set(stepIds).size !== stepIds.length) {
    throw new WorkflowTemplateValidationError("steps contains duplicate ids");
  }
  const orders = steps.map((step) => step.order);
  if (new Set(orders).size !== orders.length) {
    throw new WorkflowTemplateValidationError("steps contains duplicate order values");
  }
  const sortedOrders = [...orders].sort((a, b) => a - b);
  sortedOrders.forEach((order, index) => {
    if (order !== index + 1) {
      throw new WorkflowTemplateValidationError("steps order must be contiguous and start at 1");
    }
  });

  if (evidenceRequirement === "required") {
    steps.forEach((step, index) => {
      if (step.evidencePatterns.length === 0) {
        throw new WorkflowTemplateValidationError(
          `steps[${index}] must define evidencePatterns when evidence is required`
        );
      }
      if (step.allowedSourceAuthorities.length === 0) {
        throw new WorkflowTemplateValidationError(
          `steps[${index}] must define allowedSourceAuthorities when evidence is required`
        );
      }
    });
  }

  return {
    domainPackId,
    workflowId: requireSafeId(template.workflowId, "workflowId"),
    workflowType,
    title: requireText(template.title, "title"),
    description: requireText(template.description, "description"),
    defaultSummary: requireText(template.defaultSummary, "defaultSummary"),
    validationWarning: requireText(template.validationWarning, "validationWarning"),
    governanceRules,
    evidenceRequirement,
    authoritative,
    steps,
  };
};

export const validateEditableWorkflowTemplateCollection = (
  value: unknown,
  domainPack: DomainPack
): EditableWorkflowTemplateCollection => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new WorkflowTemplateValidationError("collection must be an object");
  }
  const collection = value as Record<string, unknown>;
  if (collection.schemaVersion !== 1) {
    throw new WorkflowTemplateValidationError("schemaVersion must be 1");
  }
  if (collection.domainPackId !== domainPack.id) {
    throw new WorkflowTemplateValidationError("collection domainPackId does not match owning pack");
  }
  if (!Array.isArray(collection.templates) || collection.templates.length === 0) {
    throw new WorkflowTemplateValidationError("templates must contain at least one template");
  }

  const templates = collection.templates.map((template) =>
    validateEditableWorkflowTemplate(template, domainPack)
  );
  const workflowIds = templates.map((template) => template.workflowId);
  if (new Set(workflowIds).size !== workflowIds.length) {
    throw new WorkflowTemplateValidationError("templates contains duplicate workflow ids");
  }

  return {
    schemaVersion: 1,
    domainPackId: domainPack.id,
    templates,
  };
};
