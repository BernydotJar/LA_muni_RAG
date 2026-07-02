import {
  DEFAULT_HYBRID_WEIGHTS,
  type HybridCandidate,
  type HybridRankingWeights,
} from "./types.js";

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const normalizeScore = (value: number | undefined): number => {
  if (value === undefined || Number.isNaN(value)) return 0;
  return clamp01(value);
};

export const calculateProvenanceScore = (candidate: HybridCandidate): number => {
  let score = 0;

  if (candidate.citationLabel.trim().length > 0) score += 0.35;
  if (candidate.documentTitle && candidate.documentTitle.trim().length > 0) score += 0.2;
  if (candidate.pageStart !== undefined && candidate.pageStart !== null) score += 0.15;
  if (candidate.articleNumber && candidate.articleNumber.trim().length > 0) score += 0.15;
  if (candidate.sectionId || candidate.chunkId) score += 0.15;

  return clamp01(score);
};

export const scoreHybridCandidate = (
  candidate: HybridCandidate,
  weights: HybridRankingWeights = DEFAULT_HYBRID_WEIGHTS
): HybridCandidate => {
  const phraseScore = normalizeScore(candidate.scores.phrase);
  const keywordScore = normalizeScore(candidate.scores.keyword);
  const vectorScore = normalizeScore(candidate.scores.vector);
  const provenanceScore = normalizeScore(candidate.scores.provenance ?? calculateProvenanceScore(candidate));

  const hybridScore =
    phraseScore * weights.phrase +
    keywordScore * weights.keyword +
    vectorScore * weights.vector +
    provenanceScore * weights.provenance;

  return {
    ...candidate,
    scores: {
      ...candidate.scores,
      phrase: phraseScore,
      keyword: keywordScore,
      vector: vectorScore,
      provenance: provenanceScore,
    },
    hybridScore,
  };
};

export const rankHybridCandidates = (
  candidates: HybridCandidate[],
  weights: HybridRankingWeights = DEFAULT_HYBRID_WEIGHTS
): HybridCandidate[] =>
  candidates
    .map((candidate) => scoreHybridCandidate(candidate, weights))
    .sort((a, b) => {
      if (b.hybridScore !== a.hybridScore) return b.hybridScore - a.hybridScore;
      if ((b.scores.phrase ?? 0) !== (a.scores.phrase ?? 0)) {
        return (b.scores.phrase ?? 0) - (a.scores.phrase ?? 0);
      }
      return a.citationLabel.localeCompare(b.citationLabel);
    });
