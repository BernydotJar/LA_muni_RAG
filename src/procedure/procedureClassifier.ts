import type { ProcedureQueryClassification, ProcedureType } from "./types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (text: string, terms: string[]): boolean => terms.some((term) => text.includes(term));

const inferProcedureType = (normalized: string): ProcedureType => {
  if (includesAny(normalized, ["cierre", "cerrar", "liquidacion", "recepcion final", "acta de recepcion"])) {
    return "project_closure";
  }

  if (includesAny(normalized, ["licitacion", "cotizacion", "contratacion", "compras", "adquisicion", "adquisiciones"])) {
    return "procurement";
  }

  if (includesAny(normalized, ["construir", "construccion", "estadio", "obra publica", "obra municipal", "escuela", "proyecto snip"])) {
    return "public_works";
  }

  if (includesAny(normalized, ["ejecutar", "ejecucion", "supervision", "estimacion", "avance de obra"])) {
    return "project_execution";
  }

  if (includesAny(normalized, ["presupuesto", "poa", "pom", "asignacion", "renglon presupuestario"])) {
    return "budget";
  }

  if (includesAny(normalized, ["cocode", "comude", "comunidad", "aldea", "solicitud comunitaria"])) {
    return "cocode";
  }

  if (includesAny(normalized, ["concejo", "acta", "punto de acta", "aprobacion municipal"])) {
    return "council_approval";
  }

  if (includesAny(normalized, ["paso", "procedimiento", "flujo", "tramite", "requisito", "documentos"])) {
    return "unknown";
  }

  return "unknown";
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

const retrievalTermsForType = (type: ProcedureType): string[] => {
  switch (type) {
    case "public_works":
      return ["obra pública proyecto municipal SNIP presupuesto contratación ejecución recepción liquidación"];
    case "procurement":
      return ["adquisiciones contrataciones licitación cotización junta contrato obra SNIP"];
    case "project_execution":
      return ["ejecución obra supervisión estimaciones avance contrato proyecto"];
    case "project_closure":
      return ["cierre obra recepción final acta recepción liquidación contrato supervisión estimaciones"];
    case "budget":
      return ["presupuesto POA POM asignación obra proyecto municipal"];
    case "community_request":
    case "cocode":
      return ["COCODE COMUDE comunidad solicitud obra aldea priorización"];
    case "council_approval":
      return ["Concejo Municipal acta punto aprobación obra contrato presupuesto"];
    case "unknown":
      return ["procedimiento municipal requisitos documentos responsables aprobación"];
  }
};

export const classifyProcedureQuery = (query: string): ProcedureQueryClassification => {
  const normalized = normalize(query);
  const procedureType = inferProcedureType(normalized);
  const municipalityName = externalMunicipalityName(normalized);
  const caseName = detectCaseName(query, normalized);
  const communityName = detectCommunityName(normalized);
  const asksForExactDeadline = includesAny(normalized, ["cuantos dias", "cuánto dias", "plazo exacto", "dias exactos", "cuanto tarda", "cuánto tarda"]);
  const asksForCurrentStatus = includesAny(normalized, ["en este momento", "estado actual", "que falta", "qué falta", "cerrar la obra", "pendiente"]);
  const isProcedural = procedureType !== "unknown" || includesAny(normalized, ["paso", "procedimiento", "flujo", "tramite", "requisito", "documentos", "quien firma", "quién firma"]);

  const retrievalQueries = [
    query,
    ...retrievalTermsForType(procedureType),
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
