import type { ProcedureGap, ProcedureQueryClassification, ProcedureType } from "./types.js";
import { loadDomainPack } from "../domain/registry.js";
import type { DomainPack } from "../domain/types.js";

const closureDocs = [
  "Contrato de obra",
  "Acta de recepción final",
  "Informes de supervisión",
  "Estimaciones y pagos",
  "Liquidación del contrato",
  "Expediente presupuestario",
  "Punto de Concejo o acta aplicable si corresponde",
  "Evidencia comunitaria/COCODE si el expediente la exige",
];

const publicWorksDocs = [
  "Perfil del proyecto",
  "Justificación técnica",
  "Documento de terreno/ubicación",
  "Presupuesto preliminar",
  "Dictamen técnico",
  "Modalidad de contratación",
  "Expediente SNIP si aplica",
];

const procurementDocs = [
  "Requerimiento o solicitud de compra/contratación",
  "Especificaciones técnicas o bases",
  "Disponibilidad presupuestaria",
  "Integración de junta si aplica",
  "Publicación o invitación según modalidad",
  "Acta de adjudicación",
  "Contrato u orden de compra",
];

const docsForType = (type: ProcedureType): string[] => {
  switch (type) {
    case "project_closure":
      return closureDocs;
    case "public_works":
    case "project_execution":
      return publicWorksDocs;
    case "procurement":
      return procurementDocs;
    case "cocode":
    case "community_request":
      return ["Solicitud comunitaria", "Acta COCODE si existe", "Priorización COMUDE si aplica", "Ficha comunitaria", "Dictamen técnico municipal"];
    case "council_approval":
      return ["Expediente del asunto", "Dictamen jurídico/técnico si aplica", "Punto de agenda", "Acta de Concejo", "Certificación del punto aprobado"];
    case "budget":
      return ["POA/POM", "Disponibilidad presupuestaria", "Renglón presupuestario", "Presupuesto aprobado", "Ejecución presupuestaria"];
    case "unknown":
      return ["Documento normativo aplicable", "Responsable institucional", "Formulario o expediente requerido", "Plazo citado"];
  }
  return ["Documento normativo aplicable", "Responsable institucional", "Formulario o expediente requerido", "Plazo citado"];
};

const docsForDomainType = (type: ProcedureType, domainPack: DomainPack): string[] => {
  const template = domainPack.workflowTemplates.find((item) => item.workflowType === type) ??
    domainPack.workflowTemplates.find((item) => item.workflowType === "unknown") ??
    domainPack.workflowTemplates[0];

  if (!template) return docsForType("unknown");
  return [...new Set(template.steps.flatMap((step) => step.requiredDocuments))];
};

export const buildProcedureGaps = (
  classification: ProcedureQueryClassification,
  evidenceCount: number,
  hasLocalEvidence: boolean,
  hasExternalReference: boolean,
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureGap[] => {
  const gaps: ProcedureGap[] = [];
  const isMunicipalAntigua = domainPack.id === "municipal-antigua";

  if (!hasLocalEvidence) {
    gaps.push({
      missingItem: isMunicipalAntigua
        ? "Documento oficial de Antigua Guatemala sobre el procedimiento"
        : `Authoritative ${domainPack.name} source for this workflow`,
      whyItMatters: isMunicipalAntigua
        ? "Sin una fuente oficial local no se debe afirmar que el flujo es obligatorio para Antigua."
        : "Without an authoritative domain source, the workflow cannot be treated as required procedure.",
      requiredToConfirm: isMunicipalAntigua
        ? "Manual, MOF, acta, normativa interna, expediente o documento oficial de Antigua."
        : "Policy, SOP, handbook, approval matrix, playbook, or other authoritative domain document.",
      severity: "blocking",
    });
  }

  if (hasExternalReference) {
    gaps.push({
      missingItem: isMunicipalAntigua
        ? "Validación contra normativa/documentos oficiales de Antigua"
        : "Validation against authoritative domain documents",
      whyItMatters: isMunicipalAntigua
        ? "La evidencia externa puede orientar, pero no sustituye la autoridad local."
        : "Comparative or contextual evidence can guide structure, but cannot replace domain authority.",
      requiredToConfirm: isMunicipalAntigua
        ? "Comparar el flujo externo con documentos oficiales de Antigua y normativa nacional aplicable."
        : "Compare the external reference with current domain policy, SOP, approval matrix, or governing source.",
      severity: "important",
    });
  }

  if (classification.asksForCurrentStatus && classification.caseName) {
    for (const doc of closureDocs) {
      gaps.push({
        missingItem: `${doc} del caso ${classification.caseName}`,
        whyItMatters: "Es necesario para determinar estado real, cierre, recepción o liquidación de la obra.",
        requiredToConfirm: `Expediente específico de ${classification.caseName}`,
        severity: "blocking",
      });
    }
  }

  if (classification.asksForExactDeadline) {
    gaps.push({
      missingItem: "Plazo explícito citado en una fuente oficial",
      whyItMatters: "No se debe inventar una cantidad de días para COCODE, Concejo, contratación o recepción.",
      requiredToConfirm: "Artículo, manual, acta, reglamento o procedimiento que indique plazo exacto.",
      severity: "blocking",
    });
  }

  if (evidenceCount === 0) {
    const requiredDocs = isMunicipalAntigua
      ? docsForType(classification.procedureType)
      : docsForDomainType(classification.procedureType, domainPack);
    for (const doc of requiredDocs.slice(0, 5)) {
      gaps.push({
        missingItem: doc,
        whyItMatters: isMunicipalAntigua
          ? "Sin evidencia recuperada, el workflow solo puede presentarse como checklist de investigación."
          : "Without retrieved evidence, the workflow can only be treated as an investigation checklist.",
        requiredToConfirm: isMunicipalAntigua
          ? "Ingerir o localizar fuente oficial aplicable."
          : "Ingest or locate the authoritative domain source.",
        severity: "important",
      });
    }
  }

  return gaps;
};
