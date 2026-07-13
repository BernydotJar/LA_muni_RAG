import type { ProcedureQueryClassification, ProcedureType } from "./types.js";
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

export const classifyProcedureQuery = (
  query: string,
  domainPack: DomainPack = loadDomainPack(undefined)
): ProcedureQueryClassification => {
  const normalized = normalize(query);
  const procedureType = inferProcedureType(normalized, domainPack);
  const municipalityName = externalMunicipalityName(normalized);
  const caseName = detectCaseName(query, normalized);
  const communityName = detectCommunityName(normalized);
  const asksForExactDeadline = includesAny(normalized, ["cuantos dias", "cuánto dias", "plazo exacto", "dias exactos", "cuanto tarda", "cuánto tarda"]);
  const asksForCurrentStatus = includesAny(normalized, ["en este momento", "estado actual", "que falta", "qué falta", "cerrar la obra", "pendiente"]);
  const isProcedural = procedureType !== "unknown" || includesAny(normalized, [
    "paso",
    "procedimiento",
    "procedure",
    "workflow",
    "flujo",
    "tramite",
    "requisito",
    "documentos",
    "documents",
    "approval",
    "quien firma",
    "quién firma",
  ]);

  const retrievalQueries = [
    query,
    ...retrievalTermsForType(procedureType, domainPack),
    caseName ? `${caseName} expediente contrato acta recepción liquidación` : "",
    communityName ? `${communityName} COCODE COMUDE comunidad obra` : "",
    municipalityName ? `${municipalityName} manual normas procedimientos adquisiciones contrataciones obra` : "",
  ].filter((value) => value.trim().length > 0);

  return {
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
