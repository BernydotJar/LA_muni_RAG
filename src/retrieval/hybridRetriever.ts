import { dedupeHybridCandidates } from "./dedupe.js";
import { rankHybridCandidates } from "./hybridScore.js";
import type { HybridCandidate, HybridRetrievalInput, HybridRetrievalResult } from "./types.js";

const hasCitation = (candidate: HybridCandidate): boolean => candidate.citationLabel.trim().length > 0;

export const buildHybridRetrievalResult = (input: HybridRetrievalInput): HybridRetrievalResult => {
  const phraseCandidates = input.phraseCandidates ?? [];
  const keywordCandidates = input.keywordCandidates ?? [];
  const vectorCandidates = input.vectorCandidates ?? [];
  const limit = input.limit ?? 10;

  const candidates: HybridCandidate[] = [];
  candidates.push(...phraseCandidates);
  candidates.push(...keywordCandidates);
  candidates.push(...vectorCandidates);

  const citableCandidates = candidates.filter(hasCitation);
  const dedupedCandidates = dedupeHybridCandidates(citableCandidates);
  const rankedCandidates = rankHybridCandidates(dedupedCandidates, input.weights).slice(0, limit);

  return {
    candidates: rankedCandidates,
    totalBeforeDedupe: citableCandidates.length,
    totalAfterDedupe: dedupedCandidates.length,
  };
};
