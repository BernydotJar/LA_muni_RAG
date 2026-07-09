import type { EvidenceItem } from "../evidence.js";
import type { ProcedureCitation, SourceAuthorityClass } from "./types.js";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, terms: string[]): boolean => terms.some((term) => value.includes(term));

export const classifySourceAuthority = (evidence: EvidenceItem): SourceAuthorityClass => {
  const type = normalize(evidence.sourceType || "");
  const title = normalize(`${evidence.documentTitle} ${evidence.citationLabel}`);

  if (includesAny(title, ["mixco", "villa nueva", "municipalidad de guatemala"])) return "external_reference";
  if (includesAny(title, ["ley de contrataciones", "reglamento", "decreto", "katun", "k'atun", "nacional"])) return "national_law";
  if (includesAny(title, ["codigo municipal", "código municipal"])) return "municipal_code";
  if (includesAny(title, ["manual de normas", "procedimiento", "procedimientos", "adquisiciones", "contrataciones"])) return "municipal_manual";
  if (includesAny(title, ["manual de organizacion", "manual de organización", "mof", "funciones"])) return "mof";
  if (includesAny(title, ["organigrama"])) return "organigram";
  if (includesAny(title, ["pdm-ot", "ordenamiento territorial", "plan de desarrollo municipal"])) return "pdm_ot";
  if (includesAny(title, ["poa", "pom", "operativo multianual", "operativo anual"])) return "pom_poa";
  if (includesAny(title, ["presupuesto", "ejecucion presupuestaria", "egresos", "ingresos"])) return "budget";
  if (includesAny(title, ["acta", "concejo"])) return "council_minutes";
  if (includesAny(title, ["cocode", "comude", "aldea", "comunidad", "ficha comunitaria"])) return "community_file";
  if (includesAny(title, ["san mateo", "escuela", "expediente", "contrato de obra"])) return "case_file";
  if (includesAny(title, ["war room", "banco de propuestas", "kpi", "costos", "metas90"])) return "war_room";

  if (type === "law" || type === "decree" || type === "regulation") return "national_law";
  if (type === "manual" || type === "procedure") return "municipal_manual";
  if (type === "council_minutes") return "council_minutes";
  if (type === "plan") return "pdm_ot";

  return "unknown";
};

export const hasAntiguaEvidence = (citations: ProcedureCitation[]): boolean =>
  citations.some((citation) => citation.authorityClass !== "external_reference" && citation.authorityClass !== "unknown");

export const toProcedureCitation = (evidence: EvidenceItem, evidenceUse: ProcedureCitation["evidenceUse"] = "cited_text"): ProcedureCitation => ({
  citationLabel: evidence.citationLabel,
  sourceType: evidence.sourceType,
  pageStart: evidence.pageStart,
  excerpt: evidence.excerpt.length > 360 ? `${evidence.excerpt.slice(0, 360)}…` : evidence.excerpt,
  sourceUrl: evidence.sourceUrl ?? null,
  authorityClass: classifySourceAuthority(evidence),
  evidenceUse,
});
