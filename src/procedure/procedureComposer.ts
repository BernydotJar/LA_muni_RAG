import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import type { DomainPack, DomainWorkflowTemplate, DomainWorkflowTemplateStep } from "../domain/types.js";
import { loadDomainPack } from "../domain/registry.js";
import { toProcedureCitation, hasLocalEvidence as citationsHaveLocalEvidence } from "./procedureAuthorities.js";
import { buildProcedureGaps } from "./procedureGaps.js";
import type {
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureDependency,
  ProcedureQueryClassification,
  ProcedureSourceAttribution,
  ProcedureStep,
  ProcedureStepEvidenceStatus,
  ProcedureType,
  ProcedureWorkflow,
  ProcedureWorkflowDepth,
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

const matchingCitationsForStep = (citations: ProcedureCitation[], patterns: string[]): ProcedureCitation[] =>
  citations
    .filter((citation) => {
      const haystack = normalize(`${citation.citationLabel} ${citation.excerpt} ${citation.sourceType}`);
      return patterns.some((pattern) => haystack.includes(normalize(pattern)));
    })
    .slice(0, 4);

const authorityRank = (citation: ProcedureCitation): number => {
  if (citation.authorityLevel === "primary") return 5;
  if (citation.authorityLevel === "national") return 4;
  if (citation.authorityLevel === "context") return 3;
  if (citation.authorityLevel === "comparative") return 2;
  return 1;
};

const primaryCitationFor = (citations: ProcedureCitation[]): ProcedureCitation | undefined =>
  [...citations].sort((left, right) => authorityRank(right) - authorityRank(left))[0];

const evidenceStatusFor = (evidence: ProcedureCitation[]): ProcedureStepEvidenceStatus => {
  if (evidence.length === 0) return "insufficient";
  if (evidence.some((citation) => citation.authorityLevel === "primary" || citation.authorityLevel === "national")) {
    return "supported";
  }
  return "inferred";
};

const sourceAttributionFor = (
  evidence: ProcedureCitation[],
  domainPack: DomainPack
): ProcedureSourceAttribution => {
  const primary = primaryCitationFor(evidence);
  if (!primary) {
    return {
      status: "insufficient",
      heading: "Sin fuente suficiente para este paso",
      statement: "No encontré base documental suficiente para afirmar este paso.",
      citations: [],
    };
  }

  if (primary.authorityLevel === "primary") {
    return {
      status: "official_municipal",
      heading: `Fuente oficial municipal: ${primary.citationLabel}`,
      statement: `Este paso está respaldado por ${primary.authorityLabel ?? "una fuente municipal oficial"} recuperada por el RAG. Revise el extracto y la vigencia del documento antes de ejecutar.`,
      primaryCitation: primary,
      citations: evidence,
    };
  }

  if (primary.authorityLevel === "national") {
    return {
      status: "official_national",
      heading: `Base nacional aplicable: ${primary.citationLabel}`,
      statement: `Este paso tiene respaldo normativo nacional en ${primary.authorityLabel ?? "una norma aplicable"}. Cuando el paso dependa de una práctica interna municipal, debe corroborarse además con expediente o fuente local de Antigua Guatemala.`,
      primaryCitation: primary,
      citations: evidence,
    };
  }

  if (primary.authorityLevel === "comparative") {
    return {
      status: "comparative",
      heading: `Referencia comparativa: ${primary.citationLabel}`,
      statement: "La fuente recuperada pertenece a otra municipalidad o entidad. Sirve como referencia comparativa, pero no define por sí sola el procedimiento oficial de Antigua Guatemala.",
      primaryCitation: primary,
      citations: evidence,
    };
  }

  if (primary.authorityLevel === "context") {
    return {
      status: "contextual",
      heading: `Fuente contextual: ${primary.citationLabel}`,
      statement: "La fuente aporta contexto operativo o comunitario, pero no es suficiente por sí sola para afirmar una obligación o procedimiento oficial.",
      primaryCitation: primary,
      citations: evidence,
    };
  }

  return {
    status: "insufficient",
    heading: `Fuente no clasificada: ${primary.citationLabel}`,
    statement: "Encontré contenido relacionado, pero no pude clasificarlo como fuente oficial suficiente para afirmar este paso.",
    primaryCitation: primary,
    citations: evidence,
  };
};

const confidenceFor = (status: ProcedureStepEvidenceStatus): ProcedureConfidence =>
  status === "supported" ? "medium" : "low";

const stepFromTemplate = (
  templateStep: DomainWorkflowTemplateStep,
  index: number,
  citations: ProcedureCitation[],
  domainPack: DomainPack,
  classification: ProcedureQueryClassification,
  depth: ProcedureWorkflowDepth
): ProcedureStep => {
  const title = templateStep.title;
  const action =
    classification.caseName && title === "Verificar expediente del caso"
      ? `Localizar el expediente específico de ${classification.caseName} antes de afirmar estado actual, recepción o cierre.`
      : templateStep.action;
  const matched = matchingCitationsForStep(citations, templateStep.evidencePatterns);
  const evidenceStatus = evidenceStatusFor(matched);
  const sourceAttribution = sourceAttributionFor(matched, domainPack);
  const dependsOn = depth === "deep_dive" && index > 0 ? [index] : undefined;

  return {
    stepNumber: index + 1,
    title,
    action,
    requiredDocuments: templateStep.requiredDocuments,
    outputDocuments: templateStep.outputDocuments,
    dependsOn,
    legalBasis: matched,
    sourceEvidence: matched,
    evidenceStatus,
    evidenceStatement: sourceAttribution.statement,
    sourceAttribution,
    confidence: confidenceFor(evidenceStatus),
    notes: templateStep.notes,
  };
};

const stepsForType = (
  type: ProcedureType,
  citations: ProcedureCitation[],
  domainPack: DomainPack,
  classification: ProcedureQueryClassification,
  depth: ProcedureWorkflowDepth
): ProcedureStep[] => {
  const template = templateForType(domainPack, type);
  return template.steps.map((templateStep, index) =>
    stepFromTemplate(templateStep, index, citations, domainPack, classification, depth)
  );
};

const dependenciesFor = (steps: ProcedureStep[], depth: ProcedureWorkflowDepth): ProcedureDependency[] | undefined => {
  if (depth !== "deep_dive") return undefined;
  return steps.slice(1).map((step) => ({
    fromStep: step.stepNumber - 1,
    toStep: step.stepNumber,
    type: "precondition",
    statement: `El paso ${step.stepNumber} depende de completar o validar el paso ${step.stepNumber - 1}.`,
    evidenceStatus: step.evidenceStatus ?? "insufficient",
    citations: step.sourceEvidence,
  }));
};

const workflowConfidence = (steps: ProcedureStep[], hasLocalEvidence: boolean): ProcedureConfidence => {
  if (!hasLocalEvidence) return "low";
  if (steps.some((item) => item.evidenceStatus !== "supported")) return "medium";
  return "medium";
};

const hasExternalReferenceCitation = (citations: ProcedureCitation[], domainPack: DomainPack): boolean =>
  citations.some(
    (citation) =>
      domainPack.sourceAuthorityClasses.find((authority) => authority.id === citation.authorityClass)?.externalReference
  );

const jurisdictionFor = (
  citations: ProcedureCitation[],
  classification: ProcedureQueryClassification,
  domainPack: DomainPack
): ProcedureWorkflow["jurisdiction"] => {
  if (!isMunicipalAntigua(domainPack)) {
    if (hasExternalReferenceCitation(citations, domainPack)) return "external reference";
    return domainPack.branding.organizationName ?? domainPack.name;
  }
  if (
    classification.mentionsExternalMunicipality &&
    citations.length > 0 &&
    citations.every((citation) => citation.authorityClass === "external_reference")
  ) {
    return "external reference";
  }
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
    return (
      domainPack.governanceRules.find((rule) =>
        rule.appliesToAuthorityClasses?.some((authority) => authority !== "unknown")
      )?.warning ??
      "Found a comparative reference. Validate against authoritative local/domain documents before treating it as procedure."
    );
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
  domainPack: DomainPack = loadDomainPack(undefined),
  depth: ProcedureWorkflowDepth = "overview"
): ProcedureWorkflow => {
  const citations = evidence.map((item) => toProcedureCitation(item, "cited_text", domainPack));
  const hasExternalReference = hasExternalReferenceCitation(citations, domainPack);
  const hasLocalEvidence = citationsHaveLocalEvidence(citations, domainPack);
  const hasAntiguaEvidence = isMunicipalAntigua(domainPack) ? hasLocalEvidence : false;
  const steps = stepsForType(classification.procedureType, citations, domainPack, classification, depth);
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
    dependencies: dependenciesFor(steps, depth),
    gaps,
    citations,
    validationWarning: template.validationWarning,
    metadata: {
      domainPackId: domainPack.id,
      domainPackName: domainPack.name,
      query,
      retrievalMode: mode,
      depth,
      evidenceCount: evidence.length,
      hasLocalEvidence,
      hasExternalReference,
      hasAntiguaEvidence,
      generatedBy: depth === "deep_dive" ? "procedure_workflow_advisor_deep_dive_v1" : "procedure_workflow_advisor_mvp",
    },
  };
};