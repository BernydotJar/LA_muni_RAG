import type {
  ProcedureQueryClassification,
  ProcedureQueryIntent,
  ProcedureType,
} from "./types.js";
import { loadDomainPack } from "../domain/registry.js";
import type { DomainPack } from "../domain/types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (text: string, terms: string[]): boolean => terms.some((term) => text.includes(term));

const inferProcedureType = (normalized: string, domainPack: DomainPack): ProcedureType => {
  const matchedRule = domainPack.classifierRules.find((rule) =>
    includesAny(normalized, rule.keywords.map((keyword) => normalize(keyword)))
  );
  return matchedRule?.workflowType ?? "unknown";
};

const detectCaseName = (query: string, normalized: string): string | undefined => {
  if (normalized.includes("san mateo")) return "Escuela de San Mateo";
  const obraMatch = query.match(/obra\s+(?:de|del|en)\s+([^?.!,]+)/i);
  if (obraMatch?.[1]) return obraMatch[1].trim();
  const escuelaMatch = query.match(/escuela\s+(?:de|del|en)?\s*([^?.!,]*)/i);
  if (escuelaMatch?.[1]?.trim()) return `Escuela ${escuelaMatch[1].trim()}`;
  return undefined;
};

const detectCommunityName = (normalized: string): string | undefined => {
  if (normalized.includes("san mateo")) return "San Mateo";
  if (normalized.includes("san felipe")) return "San Felipe de Jesús";
  if (normalized.includes("san juan del obispo")) return "San Juan del Obispo";
  if (normalized.includes("santa ana")) return "Santa Ana";
  if (normalized.includes("san pedro las huertas")) return "San Pedro Las Huertas";
  return undefined;
};

const externalMunicipalityName = (normalized: string): string | undefined => {
  if (normalized.includes("mixco")) return "Mixco";
  if (normalized.includes("guatemala ciudad") || normalized.includes("municipalidad de guatemala")) return "Guatemala";
  if (normalized.includes("villa nueva")) return "Villa Nueva";
  return undefined;
};

const retrievalTermsForType = (type: ProcedureType, domainPack: DomainPack): string[] => {
  const ruleQueries = domainPack.classifierRules
    .filter((rule) => rule.workflowType === type)
    .flatMap((rule) => rule.retrievalQueries);
  const workflowHints = domainPack.workflowTypes.find((workflowType) => workflowType.id === type)?.retrievalHints ?? [];
  return [...ruleQueries, ...workflowHints];
};

const intentRetrievalTerms: Record<ProcedureQueryIntent, string[]> = {
  documentary: ["documento oficial fuente autoridad fecha vigencia"],
  legal: ["ley reglamento decreto artículo fundamento legal vigente"],
  procedural: ["manual procedimiento responsables documentos aprobaciones"],
  case_specific: ["expediente específico contrato actas informes estado documentado"],
  planning_project: ["PDM-OT POM POA presupuesto priorización proyecto"],
  closure_liquidation: ["acta recepción final liquidación finiquito cierre expediente"],
  unknown: [],
};

const uniqueQueries = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

const detectIntent = (
  normalized: string,
  procedureType: ProcedureType,
  caseName?: string,
  asksForCurrentStatus = false
): { intent: ProcedureQueryIntent; signals: string[] } => {
  const signals: string[] = [];
  const closureTerms = ["cerrar la obra", "cierre de obra", "liquidacion", "recepcion final", "finiquito", "acta de recepcion"];
  const planningTerms = ["construir", "planificar", "proyecto", "pdm-ot", "pom", "poa", "presupuesto", "priorizar"];
  const legalTerms = ["fundamento legal", "base legal", "que ley", "que articulo", "codigo municipal", "decreto", "reglamento", "legalmente"];
  const proceduralTerms = ["paso a paso", "procedimiento", "workflow", "flujo", "tramite", "que hay que hacer", "quien firma", "quien aprueba", "documentos necesita"];
  const documentaryTerms = ["muestrame", "buscar documento", "donde dice", "organigrama", "manual", "acta", "presupuesto vigente", "texto oficial"];

  if (includesAny(normalized, closureTerms) || procedureType === "project_closure") {
    signals.push("closure_or_liquidation_language");
    if (caseName) signals.push("named_case");
    if (asksForCurrentStatus) signals.push("current_status_request");
    return { intent: "closure_liquidation", signals };
  }

  if (caseName || asksForCurrentStatus) {
    if (caseName) signals.push("named_case");
    if (asksForCurrentStatus) signals.push("current_status_request");
    return { intent: "case_specific", signals };
  }

  if (includesAny(normalized, planningTerms) || ["public_works", "project_execution", "budget"].includes(procedureType)) {
    signals.push("planning_or_project_language");
    if (procedureType !== "unknown") signals.push(`procedure_type:${procedureType}`);
    return { intent: "planning_project", signals };
  }

  if (includesAny(normalized, legalTerms)) {
    signals.push("legal_basis_language");
    return { intent: "legal", signals };
  }

  if (includesAny(normalized, proceduralTerms) || procedureType !== "unknown") {
    signals.push("procedural_language");
    if (procedureType !== "unknown") signals.push(`procedure_type:${procedureType}`);
    return { intent: "procedural", signals };
  }

  if (includesAny(normalized, documentaryTerms)) {
    signals.push("document_lookup_language");
    return { intent: "documentary", signals };
  }

  signals.push("no_supported_intent_signal");
  return { intent: "unknown", signals };
};

export const classifyProcedureQuery = (
  query: string,
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureQueryClassification => {
  const normalized = normalize(query);
  const procedureType = inferProcedureType(normalized, domainPack);
  const municipalityName = externalMunicipalityName(normalized);
  const caseName = detectCaseName(query, normalized);
  const communityName = detectCommunityName(normalized);
  const asksForExactDeadline = includesAny(normalized, ["cuantos dias", "plazo exacto", "dias exactos", "cuanto tarda"]);
  const asksForCurrentStatus = includesAny(normalized, ["en este momento", "estado actual", "que falta", "cerrar la obra", "pendiente"]);
  const { intent, signals } = detectIntent(normalized, procedureType, caseName, asksForCurrentStatus);
  const requiresCaseContext = intent === "case_specific" || intent === "closure_liquidation";
  const requiresNormativeRetrieval = ["legal", "procedural", "planning_project", "closure_liquidation"].includes(intent);
  const isProcedural =
    procedureType !== "unknown" ||
    ["procedural", "case_specific", "planning_project", "closure_liquidation"].includes(intent);

  const retrievalQueries = uniqueQueries([
    query,
    ...intentRetrievalTerms[intent],
    ...retrievalTermsForType(procedureType, domainPack),
    caseName ? `${caseName} expediente contrato acta recepción liquidación` : "",
    communityName ? `${communityName} COCODE COMUDE comunidad obra` : "",
    municipalityName ? `${municipalityName} manual normas procedimientos adquisiciones contrataciones obra` : "",
  ]);

  return {
    intent,
    intentSignals: signals,
    requiresCaseContext,
    requiresNormativeRetrieval,
    isProcedural,
    procedureType,
    caseName,
    communityName,
    asksForExactDeadline,
    asksForCurrentStatus,
    mentionsExternalMunicipality: Boolean(municipalityName),
    externalMunicipalityName: municipalityName,
    retrievalQueries,
  };
};
