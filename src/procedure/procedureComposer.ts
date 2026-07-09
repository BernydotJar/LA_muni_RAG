import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import { toProcedureCitation, hasAntiguaEvidence as citationsHaveAntiguaEvidence } from "./procedureAuthorities.js";
import { buildProcedureGaps } from "./procedureGaps.js";
import type {
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureQueryClassification,
  ProcedureStep,
  ProcedureType,
  ProcedureWorkflow,
} from "./types.js";

const titleForType = (type: ProcedureType, query: string): string => {
  switch (type) {
    case "public_works":
      return "Flujo procedimental para obra pública municipal";
    case "procurement":
      return "Flujo procedimental para contratación o adquisición municipal";
    case "project_execution":
      return "Flujo procedimental para ejecución de proyecto municipal";
    case "project_closure":
      return "Flujo procedimental para cierre y liquidación de obra municipal";
    case "budget":
      return "Flujo procedimental presupuestario municipal";
    case "community_request":
    case "cocode":
      return "Flujo procedimental para solicitud comunitaria/COCODE";
    case "council_approval":
      return "Flujo procedimental para aprobación de Concejo Municipal";
    case "unknown":
      return `Flujo procedimental preliminar para: ${query}`;
  }
};

const citationsForStep = (citations: ProcedureCitation[], patterns: RegExp[]): ProcedureCitation[] => {
  const selected = citations.filter((citation) => {
    const haystack = `${citation.citationLabel} ${citation.excerpt} ${citation.sourceType}`;
    return patterns.some((pattern) => pattern.test(haystack));
  });

  return (selected.length ? selected : citations.slice(0, 2)).slice(0, 4);
};

const confidenceFor = (evidence: ProcedureCitation[], hasAntiguaEvidence: boolean): ProcedureConfidence => {
  if (evidence.length === 0) return "low";
  if (hasAntiguaEvidence && evidence.length >= 3) return "medium";
  if (hasAntiguaEvidence) return "medium";
  return "low";
};

const step = (
  stepNumber: number,
  title: string,
  action: string,
  requiredDocuments: string[],
  outputDocuments: string[],
  evidence: ProcedureCitation[],
  hasAntiguaEvidence: boolean,
  options: Partial<ProcedureStep> = {}
): ProcedureStep => ({
  stepNumber,
  title,
  action,
  requiredDocuments,
  outputDocuments,
  legalBasis: evidence,
  sourceEvidence: evidence,
  confidence: confidenceFor(evidence, hasAntiguaEvidence),
  notes: hasAntiguaEvidence
    ? options.notes
    : options.notes ?? "Paso conservador: requiere validación contra fuente oficial de Antigua Guatemala.",
  ...options,
});

const publicWorksSteps = (citations: ProcedureCitation[], hasAntiguaEvidence: boolean): ProcedureStep[] => [
  step(
    1,
    "Clasificar el proyecto",
    "Determinar si la iniciativa es obra pública municipal, inversión nueva, ampliación, remodelación, mantenimiento o proyecto sujeto a SNIP u otra planificación aplicable.",
    ["Perfil del proyecto", "Justificación técnica", "Ubicación o terreno", "Necesidad comunitaria o institucional"],
    ["Clasificación preliminar del proyecto"],
    citationsForStep(citations, [/obra/i, /proyecto/i, /snip/i, /constru/i]),
    hasAntiguaEvidence
  ),
  step(
    2,
    "Validar planificación y presupuesto",
    "Cruzar la iniciativa con PDM-OT, POM/POA, presupuesto y disponibilidad financiera antes de iniciar contratación.",
    ["PDM-OT", "POM/POA", "Presupuesto", "Disponibilidad presupuestaria"],
    ["Validación de alineación y financiamiento"],
    citationsForStep(citations, [/pdm/i, /poa/i, /pom/i, /presupuesto/i, /plan/i]),
    hasAntiguaEvidence
  ),
  step(
    3,
    "Preparar expediente técnico",
    "Integrar especificaciones, planos, presupuesto detallado, dictámenes y documentos técnicos necesarios para sustentar la obra.",
    ["Especificaciones técnicas", "Planos", "Presupuesto detallado", "Dictamen técnico", "Cronograma"],
    ["Expediente técnico de obra"],
    citationsForStep(citations, [/tecnico/i, /técnico/i, /expediente/i, /plano/i, /presupuesto/i]),
    hasAntiguaEvidence
  ),
  step(
    4,
    "Definir modalidad de contratación",
    "Determinar si corresponde compra directa, cotización, licitación u otra modalidad según monto, objeto y normativa aplicable.",
    ["Monto estimado", "Objeto contractual", "Base normativa", "Disponibilidad presupuestaria"],
    ["Modalidad de contratación definida"],
    citationsForStep(citations, [/licitacion/i, /licitación/i, /cotizacion/i, /cotización/i, /contratacion/i, /adquis/i]),
    hasAntiguaEvidence
  ),
  step(
    5,
    "Aprobar, contratar y ejecutar",
    "Completar aprobaciones internas, adjudicación/contrato, orden de inicio, supervisión y control de avance según expediente aplicable.",
    ["Bases o términos", "Acta/adjudicación si aplica", "Contrato", "Orden de inicio", "Bitácora o informes de supervisión"],
    ["Contrato y expediente de ejecución"],
    citationsForStep(citations, [/contrato/i, /concejo/i, /acta/i, /supervision/i, /ejecucion/i]),
    hasAntiguaEvidence
  ),
  step(
    6,
    "Recepción, liquidación y cierre",
    "Para cerrar la obra, verificar recepción, informes, pagos, liquidación y documentación final antes de afirmar cierre institucional.",
    ["Acta de recepción", "Informes de supervisión", "Estimaciones/pagos", "Liquidación", "Expediente completo"],
    ["Expediente de cierre o liquidación"],
    citationsForStep(citations, [/recepcion/i, /recepción/i, /liquidacion/i, /liquidación/i, /cierre/i, /estimacion/i]),
    hasAntiguaEvidence
  ),
];

const closureSteps = (citations: ProcedureCitation[], hasAntiguaEvidence: boolean, caseName?: string): ProcedureStep[] => [
  step(
    1,
    "Verificar expediente del caso",
    `Localizar el expediente específico${caseName ? ` de ${caseName}` : ""} antes de afirmar estado actual, recepción o cierre.`,
    ["Contrato", "Expediente técnico", "Actas", "Informes de supervisión", "Estimaciones"],
    ["Inventario documental del expediente"],
    citationsForStep(citations, [/expediente/i, /contrato/i, /obra/i, /escuela/i, /san mateo/i]),
    hasAntiguaEvidence,
    { notes: "Si el expediente específico no está en corpus, el sistema solo puede listar faltantes." }
  ),
  step(
    2,
    "Confirmar recepción física o técnica",
    "Revisar si existe acta de recepción, informe de supervisión o documento equivalente que demuestre entrega de la obra.",
    ["Acta de recepción", "Informe de supervisión", "Evidencia de entrega"],
    ["Confirmación documental de recepción"],
    citationsForStep(citations, [/recepcion/i, /recepción/i, /supervision/i, /entrega/i]),
    hasAntiguaEvidence
  ),
  step(
    3,
    "Validar pagos, estimaciones y liquidación",
    "Revisar estimaciones, pagos, saldos, liquidación y cierre administrativo/financiero.",
    ["Estimaciones", "Pagos", "Liquidación", "Presupuesto/ejecución"],
    ["Validación financiera de cierre"],
    citationsForStep(citations, [/estimacion/i, /pago/i, /liquidacion/i, /presupuesto/i, /ejecucion presupuestaria/i]),
    hasAntiguaEvidence
  ),
  step(
    4,
    "Confirmar aprobación o conocimiento institucional",
    "Verificar si el cierre requiere punto de Concejo, certificación, intervención de gerencia, unidad técnica o comunidad/COCODE según expediente.",
    ["Acta o punto de Concejo si aplica", "Certificación", "Visto bueno técnico", "Documento comunitario si aplica"],
    ["Validación institucional del cierre"],
    citationsForStep(citations, [/concejo/i, /acta/i, /cocode/i, /gerencia/i, /certificacion/i]),
    hasAntiguaEvidence
  ),
];

const procurementSteps = (citations: ProcedureCitation[], hasAntiguaEvidence: boolean): ProcedureStep[] => [
  step(1, "Preparar requerimiento", "Definir necesidad, objeto, especificaciones y respaldo presupuestario.", ["Solicitud", "Especificaciones técnicas", "Disponibilidad presupuestaria"], ["Requerimiento completo"], citationsForStep(citations, [/solicitud/i, /requerimiento/i, /presupuesto/i]), hasAntiguaEvidence),
  step(2, "Definir modalidad", "Determinar modalidad de contratación conforme monto, objeto y normativa aplicable.", ["Monto", "Objeto", "Normativa aplicable"], ["Modalidad definida"], citationsForStep(citations, [/cotizacion/i, /licitacion/i, /contratacion/i, /adquis/i]), hasAntiguaEvidence),
  step(3, "Integrar expediente y publicar/adjudicar", "Preparar bases, integrar junta si aplica, publicar o solicitar ofertas, evaluar y adjudicar.", ["Bases", "Junta", "Ofertas", "Actas"], ["Adjudicación o decisión documentada"], citationsForStep(citations, [/junta/i, /bases/i, /oferta/i, /adjudic/i, /acta/i]), hasAntiguaEvidence),
  step(4, "Formalizar y ejecutar", "Formalizar contrato u orden, supervisar cumplimiento y conservar expediente.", ["Contrato", "Orden", "Garantías si aplican", "Supervisión"], ["Contrato ejecutado y expediente"], citationsForStep(citations, [/contrato/i, /orden/i, /garantia/i, /supervision/i]), hasAntiguaEvidence),
];

const genericSteps = (citations: ProcedureCitation[], hasAntiguaEvidence: boolean): ProcedureStep[] => [
  step(1, "Identificar fuente aplicable", "Determinar qué documento oficial regula el procedimiento.", ["Documento oficial", "Norma aplicable"], ["Fuente rectora identificada"], citations.slice(0, 3), hasAntiguaEvidence),
  step(2, "Listar requisitos", "Extraer requisitos, responsables, documentos, plazos y aprobaciones citadas.", ["Texto procedimental", "MOF/manual/acta"], ["Checklist preliminar"], citations.slice(0, 3), hasAntiguaEvidence),
  step(3, "Validar con autoridad municipal", "Confirmar el flujo con la unidad responsable antes de ejecutarlo.", ["Checklist", "Citas", "Expediente"], ["Flujo validado"], citations.slice(0, 2), hasAntiguaEvidence, { confidence: "low" }),
];

const stepsForType = (
  type: ProcedureType,
  citations: ProcedureCitation[],
  hasAntiguaEvidence: boolean,
  caseName?: string
): ProcedureStep[] => {
  switch (type) {
    case "public_works":
    case "project_execution":
      return publicWorksSteps(citations, hasAntiguaEvidence);
    case "project_closure":
      return closureSteps(citations, hasAntiguaEvidence, caseName);
    case "procurement":
      return procurementSteps(citations, hasAntiguaEvidence);
    case "budget":
    case "community_request":
    case "cocode":
    case "council_approval":
    case "unknown":
      return genericSteps(citations, hasAntiguaEvidence);
  }
};

const workflowConfidence = (steps: ProcedureStep[], hasAntiguaEvidence: boolean): ProcedureConfidence => {
  if (!hasAntiguaEvidence) return "low";
  if (steps.some((item) => item.confidence === "low")) return "medium";
  return "medium";
};

const jurisdictionFor = (citations: ProcedureCitation[], classification: ProcedureQueryClassification): ProcedureWorkflow["jurisdiction"] => {
  if (classification.mentionsExternalMunicipality && citations.every((citation) => citation.authorityClass === "external_reference")) return "external reference";
  if (citations.some((citation) => citation.authorityClass === "national_law")) return "Guatemala national";
  return "Antigua Guatemala";
};

const summaryFor = (
  query: string,
  classification: ProcedureQueryClassification,
  evidenceCount: number,
  hasAntiguaEvidence: boolean,
  hasExternalReference: boolean
): string => {
  if (evidenceCount === 0) {
    return `No encontré evidencia suficiente para afirmar un procedimiento específico para “${query}”. Devuelvo un checklist de investigación y documentos faltantes.`;
  }

  if (!hasAntiguaEvidence && hasExternalReference) {
    return "Encontré referencia procedimental de otra municipalidad. Puede orientar el flujo comparativo, pero no debe tratarse como procedimiento oficial de Antigua Guatemala sin validación local y nacional.";
  }

  if (classification.asksForCurrentStatus && classification.caseName) {
    return `Para determinar qué falta en ${classification.caseName}, el sistema necesita expediente específico. El flujo lista los documentos mínimos para validar cierre sin inventar estado actual.`;
  }

  return "Encontré evidencia relacionada y organicé un flujo municipal conservador. Los pasos sin respaldo directo quedan marcados para validación humana.";
};

export const composeProcedureWorkflow = (
  query: string,
  mode: EvidenceMode,
  classification: ProcedureQueryClassification,
  evidence: EvidenceItem[]
): ProcedureWorkflow => {
  const citations = evidence.map((item) => toProcedureCitation(item));
  const hasExternalReference = citations.some((citation) => citation.authorityClass === "external_reference");
  const hasAntiguaEvidence = citationsHaveAntiguaEvidence(citations);
  const steps = stepsForType(classification.procedureType, citations, hasAntiguaEvidence, classification.caseName);
  const gaps = buildProcedureGaps(classification, evidence.length, hasAntiguaEvidence, hasExternalReference);

  return {
    id: `procedure:${Buffer.from(query).toString("base64url").slice(0, 18)}`,
    title: titleForType(classification.procedureType, query),
    jurisdiction: jurisdictionFor(citations, classification),
    procedureType: classification.procedureType,
    confidence: workflowConfidence(steps, hasAntiguaEvidence),
    summary: summaryFor(query, classification, evidence.length, hasAntiguaEvidence, hasExternalReference),
    classification,
    steps,
    gaps,
    citations,
    validationWarning:
      "Este flujo organiza evidencia documental y no sustituye validación de Gerencia Municipal, DAFIM, Asesoría Jurídica, unidad técnica, Concejo Municipal o COCODE cuando corresponda.",
    metadata: {
      query,
      retrievalMode: mode,
      evidenceCount: evidence.length,
      hasExternalReference,
      hasAntiguaEvidence,
      generatedBy: "procedure_workflow_advisor_mvp",
    },
  };
};
