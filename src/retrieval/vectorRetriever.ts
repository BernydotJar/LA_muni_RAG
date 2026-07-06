import type { HybridCandidate } from "./types.js";

export interface VectorCandidateInput {
  chunkId: string;
  sectionId?: string;
  documentId?: string;
  documentVersionId?: string;
  documentTitle?: string;
  citationLabel: string;
  excerpt: string;
  sourceType?: string;
  pageStart?: number | null;
  pageEnd?: number | null;
  articleNumber?: string | null;
  sourceUrl?: string | null;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface VectorRetrievalRepository {
  search(queryVector: number[], limit: number): Promise<VectorCandidateInput[]>;
}

export const vectorCandidateToHybridCandidate = (candidate: VectorCandidateInput): HybridCandidate => ({
  id: `vector:${candidate.chunkId}`,
  mode: "vector",
  matchedModes: ["vector"],
  documentId: candidate.documentId,
  documentVersionId: candidate.documentVersionId,
  documentTitle: candidate.documentTitle,
  sectionId: candidate.sectionId,
  chunkId: candidate.chunkId,
  citationLabel: candidate.citationLabel,
  excerpt: candidate.excerpt,
  sourceType: candidate.sourceType,
  pageStart: candidate.pageStart,
  pageEnd: candidate.pageEnd,
  articleNumber: candidate.articleNumber,
  sourceUrl: candidate.sourceUrl ?? null,
  scores: {
    vector: candidate.similarity,
  },
  hybridScore: 0,
  metadata: candidate.metadata,
});

export const retrieveVectorCandidates = async (
  repository: VectorRetrievalRepository,
  queryVector: number[],
  limit: number
): Promise<HybridCandidate[]> => {
  const results = await repository.search(queryVector, limit);
  return results
    .filter((result) => result.citationLabel.trim().length > 0)
    .map(vectorCandidateToHybridCandidate);
};
