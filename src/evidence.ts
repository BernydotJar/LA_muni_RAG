import { embedQuery, type QueryEmbeddingProvider } from "./embeddings/queryEmbedding.js";
import { buildHybridRetrievalResult } from "./retrieval/hybridRetriever.js";
import { retrieveVectorCandidates, type VectorRetrievalRepository } from "./retrieval/vectorRetriever.js";
import type { HybridCandidate } from "./retrieval/types.js";
import { keywordSearch, type KeywordSearchResult, phraseSearch, type PhraseSearchResult } from "./search.js";

export type EvidenceMode = "keyword" | "phrase" | "hybrid";
export type EvidenceStatus = "evidence_found" | "not_found";

export interface EvidenceItem {
  documentTitle: string;
  sourceType: string;
  citationLabel: string;
  pageStart: number | null;
  excerpt: string;
  score: number | null;
  retrievalMode: EvidenceMode;
  matchedModes?: string[];
}

export interface EvidenceResponse {
  query: string;
  mode: EvidenceMode;
  answerStatus: EvidenceStatus;
  evidenceCount: number;
  evidence: EvidenceItem[];
}

export interface EvidenceDependencies {
  queryEmbeddingProvider?: QueryEmbeddingProvider;
  vectorRepository?: VectorRetrievalRepository;
  keywordSearch?: typeof keywordSearch;
  phraseSearch?: typeof phraseSearch;
}

export const stripHeadlineTags = (value: string): string =>
  value.replaceAll("<mark>", "").replaceAll("</mark>", "");

export const mapKeywordResultToEvidence = (
  result: KeywordSearchResult,
  mode: EvidenceMode = "keyword"
): EvidenceItem => ({
  documentTitle: result.documentTitle,
  sourceType: result.documentType,
  citationLabel: result.citationLabel,
  pageStart: result.pageStart,
  excerpt: stripHeadlineTags(result.snippet),
  score: result.keywordScore,
  retrievalMode: mode,
});

export const mapPhraseResultToEvidence = (
  result: PhraseSearchResult,
  mode: EvidenceMode = "phrase"
): EvidenceItem => ({
  documentTitle: result.documentTitle,
  sourceType: result.documentType,
  citationLabel: result.citationLabel,
  pageStart: result.pageStart,
  excerpt: result.preview,
  score: null,
  retrievalMode: mode,
});

export const keywordResultToHybridCandidate = (result: KeywordSearchResult): HybridCandidate => ({
  id: `keyword:${result.citationLabel}:${result.pageStart ?? "unknown"}`,
  mode: "keyword",
  matchedModes: ["keyword"],
  documentTitle: result.documentTitle,
  citationLabel: result.citationLabel,
  excerpt: stripHeadlineTags(result.snippet),
  sourceType: result.documentType,
  pageStart: result.pageStart,
  scores: {
    keyword: result.keywordScore,
  },
  hybridScore: 0,
});

export const phraseResultToHybridCandidate = (result: PhraseSearchResult): HybridCandidate => ({
  id: `phrase:${result.citationLabel}:${result.pageStart ?? "unknown"}`,
  mode: "phrase",
  matchedModes: ["phrase"],
  documentTitle: result.documentTitle,
  citationLabel: result.citationLabel,
  excerpt: result.preview,
  sourceType: result.documentType,
  pageStart: result.pageStart,
  scores: {
    phrase: 1,
  },
  hybridScore: 0,
});

export const hybridCandidateToEvidence = (candidate: HybridCandidate): EvidenceItem => ({
  documentTitle: candidate.documentTitle ?? "Unknown document",
  sourceType: candidate.sourceType ?? "other",
  citationLabel: candidate.citationLabel,
  pageStart: candidate.pageStart ?? null,
  excerpt: candidate.excerpt,
  score: candidate.hybridScore,
  retrievalMode: "hybrid",
  matchedModes: candidate.matchedModes,
});

const responseForEvidence = (
  query: string,
  mode: EvidenceMode,
  evidence: EvidenceItem[]
): EvidenceResponse => ({
  query,
  mode,
  answerStatus: evidence.length > 0 ? "evidence_found" : "not_found",
  evidenceCount: evidence.length,
  evidence,
});

const resolveKeywordSearch = (dependencies: EvidenceDependencies): typeof keywordSearch =>
  dependencies.keywordSearch ?? keywordSearch;

const resolvePhraseSearch = (dependencies: EvidenceDependencies): typeof phraseSearch =>
  dependencies.phraseSearch ?? phraseSearch;

const resolveVectorCandidates = async (
  query: string,
  limit: number,
  dependencies: EvidenceDependencies
): Promise<HybridCandidate[]> => {
  const { queryEmbeddingProvider, vectorRepository } = dependencies;
  if (!queryEmbeddingProvider || !vectorRepository) return [];

  try {
    const queryVector = await embedQuery(queryEmbeddingProvider, query);
    return await retrieveVectorCandidates(vectorRepository, queryVector, limit);
  } catch {
    return [];
  }
};

export const findEvidenceWithDependencies = async (
  query: string,
  mode: EvidenceMode,
  limit = 5,
  dependencies: EvidenceDependencies = {}
): Promise<EvidenceResponse> => {
  const keywordSearchFn = resolveKeywordSearch(dependencies);
  const phraseSearchFn = resolvePhraseSearch(dependencies);

  if (mode === "phrase") {
    const results = await phraseSearchFn(query, limit);
    return responseForEvidence(query, mode, results.map((result) => mapPhraseResultToEvidence(result)));
  }

  if (mode === "hybrid") {
    const [phraseResults, keywordResults, vectorCandidates] = await Promise.all([
      phraseSearchFn(query, limit),
      keywordSearchFn(query, limit),
      resolveVectorCandidates(query, limit, dependencies),
    ]);

    const hybrid = buildHybridRetrievalResult({
      phraseCandidates: phraseResults.map(phraseResultToHybridCandidate),
      keywordCandidates: keywordResults.map(keywordResultToHybridCandidate),
      vectorCandidates,
      limit,
    });

    return responseForEvidence(query, mode, hybrid.candidates.map(hybridCandidateToEvidence));
  }

  const results = await keywordSearchFn(query, limit);
  return responseForEvidence(query, mode, results.map((result) => mapKeywordResultToEvidence(result)));
};

export const findEvidence = async (
  query: string,
  mode: EvidenceMode,
  limit = 5
): Promise<EvidenceResponse> => findEvidenceWithDependencies(query, mode, limit);
