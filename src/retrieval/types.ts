export type RetrievalMode = "phrase" | "keyword" | "vector";

export interface HybridScoreComponents {
  phrase?: number;
  keyword?: number;
  vector?: number;
  provenance?: number;
}

export interface HybridCandidate {
  id: string;
  mode: RetrievalMode;
  matchedModes: RetrievalMode[];
  documentId?: string;
  documentVersionId?: string;
  documentTitle?: string;
  sectionId?: string;
  chunkId?: string;
  citationLabel: string;
  excerpt: string;
  sourceType?: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  articleNumber?: string | null;
  /** Stable public source URL when document metadata exposes one. */
  sourceUrl?: string | null;
  scores: HybridScoreComponents;
  hybridScore: number;
  metadata?: Record<string, unknown>;
}

export interface HybridRankingWeights {
  phrase: number;
  keyword: number;
  vector: number;
  provenance: number;
}

export interface HybridRetrievalInput {
  phraseCandidates?: HybridCandidate[];
  keywordCandidates?: HybridCandidate[];
  vectorCandidates?: HybridCandidate[];
  limit?: number;
  weights?: HybridRankingWeights;
}

export interface HybridRetrievalResult {
  candidates: HybridCandidate[];
  totalBeforeDedupe: number;
  totalAfterDedupe: number;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridRankingWeights = {
  phrase: 4,
  keyword: 2,
  vector: 1.5,
  provenance: 0.5,
};

export const RETRIEVAL_MODE_PRIORITY: RetrievalMode[] = ["phrase", "keyword", "vector"];
