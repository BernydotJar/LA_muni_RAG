import { findEvidence, type EvidenceItem, type EvidenceMode } from "./evidence.js";

export type DeterministicAnswerStatus = "draft_grounded" | "not_found";

export interface AnswerCitation {
  citationLabel: string;
  documentTitle: string;
  sourceType: string;
  pageStart: number | null;
}

export interface DeterministicAnswerResponse {
  query: string;
  mode: EvidenceMode;
  answerStatus: DeterministicAnswerStatus;
  answerLabel: "draft" | "not_found";
  answer: string;
  citations: AnswerCitation[];
  evidence: EvidenceItem[];
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const excerptSummary = (value: string): string => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return "";
  return normalized.length > 260 ? `${normalized.slice(0, 260)}...` : normalized;
};

const buildDraftAnswer = (query: string, evidence: EvidenceItem[]): string => {
  const summaries = evidence
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${excerptSummary(item.excerpt)} (${item.citationLabel})`)
    .join(" ");

  return [
    `Respuesta preliminar basada en evidencia para: "${query}".`,
    summaries || "Se encontraron referencias, pero el contenido requiere revision humana.",
    "Esta salida es un borrador deterministico: resume fragmentos recuperados y no sustituye revision juridica, tecnica o municipal.",
  ].join(" ");
};

export const buildDeterministicAnswer = async (
  query: string,
  mode: EvidenceMode = "keyword",
  limit = 5
): Promise<DeterministicAnswerResponse> => {
  const evidenceResponse = await findEvidence(query, mode, limit);

  if (evidenceResponse.answerStatus === "not_found") {
    return {
      query,
      mode,
      answerStatus: "not_found",
      answerLabel: "not_found",
      answer:
        `No consta evidencia suficiente en el corpus cargado para responder "${query}". ` +
        "Debe cargarse o verificarse documentacion adicional antes de formular una respuesta.",
      citations: [],
      evidence: [],
    };
  }

  return {
    query,
    mode,
    answerStatus: "draft_grounded",
    answerLabel: "draft",
    answer: buildDraftAnswer(query, evidenceResponse.evidence),
    citations: evidenceResponse.evidence.map((item) => ({
      citationLabel: item.citationLabel,
      documentTitle: item.documentTitle,
      sourceType: item.sourceType,
      pageStart: item.pageStart,
    })),
    evidence: evidenceResponse.evidence,
  };
};
