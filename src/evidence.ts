import { keywordSearch, phraseSearch } from "./search.js";

export type EvidenceMode = "keyword" | "phrase";
export type EvidenceStatus = "evidence_found" | "not_found";

export interface EvidenceItem {
  documentTitle: string;
  sourceType: string;
  citationLabel: string;
  pageStart: number | null;
  excerpt: string;
  score: number | null;
  retrievalMode: EvidenceMode;
}

export interface EvidenceResponse {
  query: string;
  mode: EvidenceMode;
  answerStatus: EvidenceStatus;
  evidenceCount: number;
  evidence: EvidenceItem[];
}

export const stripHeadlineTags = (value: string): string =>
  value.replaceAll("<mark>", "").replaceAll("</mark>", "");

export const findEvidence = async (
  query: string,
  mode: EvidenceMode,
  limit = 5
): Promise<EvidenceResponse> => {
  if (mode === "phrase") {
    const results = await phraseSearch(query, limit);
    const evidence = results.map((result) => ({
      documentTitle: result.documentTitle,
      sourceType: result.documentType,
      citationLabel: result.citationLabel,
      pageStart: result.pageStart,
      excerpt: result.preview,
      score: null,
      retrievalMode: mode,
    }));

    return {
      query,
      mode,
      answerStatus: evidence.length > 0 ? "evidence_found" : "not_found",
      evidenceCount: evidence.length,
      evidence,
    };
  }

  const results = await keywordSearch(query, limit);
  const evidence = results.map((result) => ({
    documentTitle: result.documentTitle,
    sourceType: result.documentType,
    citationLabel: result.citationLabel,
    pageStart: result.pageStart,
    excerpt: stripHeadlineTags(result.snippet),
    score: result.keywordScore,
    retrievalMode: mode,
  }));

  return {
    query,
    mode,
    answerStatus: evidence.length > 0 ? "evidence_found" : "not_found",
    evidenceCount: evidence.length,
    evidence,
  };
};

