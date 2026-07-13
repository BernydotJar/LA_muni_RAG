import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import type { DomainPack, DomainWorkflowTemplate, DomainWorkflowTemplateStep } from "../domain/types.js";
import { loadDomainPack } from "../domain/registry.js";
import { toProcedureCitation, hasLocalEvidence as citationsHaveLocalEvidence } from "./procedureAuthorities.js";
import { buildProcedureGaps } from "./procedureGaps.js";
import type {
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureQueryClassification,
  ProcedureStep,
  ProcedureType,
  ProcedureWorkflow,
} from "./types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const isMunicipalAntigua = (domainPack: DomainPack): boolean => domainPack.id === "municipal-antigua";

const templateForType = (domainPack: DomainPack, type: ProcedureType): DomainWorkflowTemplate => {
  const direct = domainPack.workflowTemplates.find((template) => template.workflowType === type);
  if (direct) return direct;

  if (domainPack.id === "municipal-antigua" && type === "project_execution") {
    return domainPack.workflowTemplates.find((template) => template.workflowType === "public_works")!;
  }

  return domainPack.workflowTemplates.find((template) => template.workflowType === "unknown") ?? domainPack.workflowTemplates[0]!;
};

const titleForType = (type: ProcedureType, query: string, domainPack: DomainPack): string => {
  const template = templateForType(domainPack, type);
  if (type === "unknown" && isMunicipalAntigua(domainPack)) return `Flujo procedimental preliminar para: ${query}`;
  return template.title;
};

const citationsForStep = (citations: ProcedureCitation[], patterns: string[]): ProcedureCitation[] => {
  const selected = citations.filter((citation) => {
    const haystack = normalize(`${citation.citationLabel} ${citation.excerpt} ${citation.sourceType}`);
    return patterns.some((pattern) => haystack.includes(normalize(pattern)));
  });

  return (selected.length ? selected : citations.slice(0, 2)).slice(0, 4);
};

const confidenceFor = (evidence: ProcedureCitation[], hasLocalEvidence: boolean): ProcedureConfidence => {
  if (evidence.length === 0) return "low";
  if (hasLocalEvidence && evidence.length >= 3) return "medium";
  if (hasLocalEvidence) return "medium";
  return "low";
};

const step = (
  stepNumber: number,
  title: string,
  action: string,
  requiredDocuments: string[],
  outputDocuments: string[],
  evidence: ProcedureCitation[],
  hasLocalEvidence: boolean,
  domainPack: DomainPack,
  options: Partial<ProcedureStep> = {}
): ProcedureStep => ({
  stepNumber,
  title,
  action,
  requiredDocuments,
  outputDocuments,
  legalBasis: evidence,
  sourceEvidence: evidence,
  confidence: confidenceFor(evidence, hasLocalEvidence),
  notes: hasLocalEvidence
    ? options.notes
    : options.notes ??
      (isMunicipalAntigua(domainPack)
        ? "Paso conservador: requiere validación contra fuente oficial de Antigua Guatemala."
        : `Conservative step: requires validation against authoritative ${domainPack.name} sources.`),
  ...options,
});

const stepFromTemplate = (
  templateStep: DomainWorkflowTemplateStep,
  index: number,
  citations: ProcedureCitation[],
  hasLocalEvidence: boolean,
  domainPack: DomainPack,
  classification: ProcedureQueryClassification
): ProcedureStep => {
  const title = templateStep.title;
  const action =
    classification.caseName && title === "Verificar expediente del caso"
      ? `Localizar el expediente específico de ${classification.caseName} antes de afirmar estado actual, recepción o cierre.`
      : templateStep.action;

  return step(
    index + 1,
    title,
    action,
    templateStep.requiredDocuments,
    templateStep.outputDocuments,
    citationsForStep(citations, templateStep.evidencePatterns),
    hasLocalEvidence,
    domainPack,
    { notes: templateStep.notes }
  );
};

const stepsForType = (
  type: ProcedureType,
  citations: ProcedureCitation[],
  hasLocalEvidence: boolean,
  domainPack: DomainPack,
  classification: ProcedureQueryClassification
): ProcedureStep[] => {
  const template = templateForType(domainPack, type);
  return template.steps.map((templateStep, index) =>
    stepFromTemplate(templateStep, index, citations, hasLocalEvidence, domainPack, classification)
  );
};

const workflowConfidence = (steps: ProcedureStep[], hasLocalEvidence: boolean): ProcedureConfidence => {
  if (!hasLocalEvidence) return "low";
  if (steps.some((item) => item.confidence === "low")) return "medium";
  return "medium";
};

const hasExternalReferenceCitation = (citations: ProcedureCitation[], domainPack: DomainPack): boolean =>
  citations.some((citation) => domainPack.sourceAuthorityClasses.find((authority) => authority.id === citation.authorityClass)?.externalReference);

const jurisdictionFor = (
  citations: ProcedureCitation[],
  classification: ProcedureQueryClassification,
  domainPack: DomainPack
): ProcedureWorkflow["jurisdiction"] => {
  if (!isMunicipalAntigua(domainPack)) {
    if (hasExternalReferenceCitation(citations, domainPack)) return "external reference";
    return domainPack.branding.organizationName ?? domainPack.name;
  }
  if (classification.mentionsExternalMunicipality && citations.every((citation) => citation.authorityClass === "external_reference")) return "external reference";
  if (citations.some((citation) => citation.authorityClass === "national_law")) return "Guatemala national";
  return "Antigua Guatemala";
};

const summaryFor = (
  query: string,
  classification: ProcedureQueryClassification,
  evidenceCount: number,
  hasLocalEvidence: boolean,
  hasExternalReference: boolean,
  domainPack: DomainPack
): string => {
  const template = templateForType(domainPack, classification.procedureType);
  if (evidenceCount === 0) {
    return isMunicipalAntigua(domainPack)
      ? `No encontré evidencia suficiente para afirmar un procedimiento específico para “${query}”. Devuelvo un checklist de investigación y documentos faltantes.`
      : `I did not find enough ${domainPack.name} evidence to assert a specific workflow for “${query}”. I am returning an investigation checklist.`;
  }

  if (!hasLocalEvidence && hasExternalReference) {
    return domainPack.governanceRules.find((rule) => rule.appliesToAuthorityClasses?.some((authority) => authority !== "unknown"))?.warning ??
      "Found a comparative reference. Validate against authoritative local/domain documents before treating it as procedure.";
  }

  if (classification.asksForCurrentStatus && classification.caseName) {
    return `Para determinar qué falta en ${classification.caseName}, el sistema necesita expediente específico. El flujo lista los documentos mínimos para validar cierre sin inventar estado actual.`;
  }

  return template.defaultSummary;
};

export const composeProcedureWorkflow = (
  query: string,
  mode: EvidenceMode,
  classification: ProcedureQueryClassification,
  evidence: EvidenceItem[],
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureWorkflow => {
  const citations = evidence.map((item) => toProcedureCitation(item, "cited_text", domainPack));
  const hasExternalReference = hasExternalReferenceCitation(citations, domainPack);
  const hasLocalEvidence = citationsHaveLocalEvidence(citations, domainPack);
  const hasAntiguaEvidence = isMunicipalAntigua(domainPack) ? hasLocalEvidence : false;
  const steps = stepsForType(classification.procedureType, citations, hasLocalEvidence, domainPack, classification);
  const gaps = buildProcedureGaps(classification, evidence.length, hasLocalEvidence, hasExternalReference, domainPack);
  const template = templateForType(domainPack, classification.procedureType);

  return {
    id: `procedure:${Buffer.from(query).toString("base64url").slice(0, 18)}`,
    title: titleForType(classification.procedureType, query, domainPack),
    jurisdiction: jurisdictionFor(citations, classification, domainPack),
    procedureType: classification.procedureType,
    confidence: workflowConfidence(steps, hasLocalEvidence),
    summary: summaryFor(query, classification, evidence.length, hasLocalEvidence, hasExternalReference, domainPack),
    classification,
    steps,
    gaps,
    citations,
    validationWarning: template.validationWarning,
    metadata: {
      domainPackId: domainPack.id,
      domainPackName: domainPack.name,
      query,
      retrievalMode: mode,
      evidenceCount: evidence.length,
      hasLocalEvidence,
      hasExternalReference,
      hasAntiguaEvidence,
      generatedBy: "procedure_workflow_advisor_mvp",
    },
  };
};
