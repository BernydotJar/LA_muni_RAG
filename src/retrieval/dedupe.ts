import { createHash } from "node:crypto";
import {
  RETRIEVAL_MODE_PRIORITY,
  type HybridCandidate,
  type RetrievalMode,
} from "./types.js";

const hashExcerpt = (excerpt: string): string =>
  createHash("sha256").update(excerpt.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

export const dedupeKeyForCandidate = (candidate: HybridCandidate): string => {
  if (candidate.chunkId) return `chunk:${candidate.chunkId}`;
  if (candidate.sectionId) return `section:${candidate.sectionId}`;
  return `citation:${candidate.citationLabel}:${hashExcerpt(candidate.excerpt)}`;
};

const mergeModes = (a: RetrievalMode[], b: RetrievalMode[]): RetrievalMode[] =>
  RETRIEVAL_MODE_PRIORITY.filter((mode) => a.includes(mode) || b.includes(mode));

const choosePrimaryMode = (modes: RetrievalMode[]): RetrievalMode =>
  RETRIEVAL_MODE_PRIORITY.find((mode) => modes.includes(mode)) ?? "vector";

export const mergeHybridCandidates = (
  existing: HybridCandidate,
  incoming: HybridCandidate
): HybridCandidate => {
  const matchedModes = mergeModes(existing.matchedModes, incoming.matchedModes);

  return {
    ...existing,
    mode: choosePrimaryMode(matchedModes),
    matchedModes,
    documentId: existing.documentId ?? incoming.documentId,
    documentVersionId: existing.documentVersionId ?? incoming.documentVersionId,
    documentTitle: existing.documentTitle ?? incoming.documentTitle,
    sectionId: existing.sectionId ?? incoming.sectionId,
    chunkId: existing.chunkId ?? incoming.chunkId,
    sourceType: existing.sourceType ?? incoming.sourceType,
    pageStart: existing.pageStart ?? incoming.pageStart,
    pageEnd: existing.pageEnd ?? incoming.pageEnd,
    articleNumber: existing.articleNumber ?? incoming.articleNumber,
    excerpt: existing.excerpt.length >= incoming.excerpt.length ? existing.excerpt : incoming.excerpt,
    scores: {
      phrase: Math.max(existing.scores.phrase ?? 0, incoming.scores.phrase ?? 0),
      keyword: Math.max(existing.scores.keyword ?? 0, incoming.scores.keyword ?? 0),
      vector: Math.max(existing.scores.vector ?? 0, incoming.scores.vector ?? 0),
      provenance: Math.max(existing.scores.provenance ?? 0, incoming.scores.provenance ?? 0),
    },
    hybridScore: Math.max(existing.hybridScore, incoming.hybridScore),
    metadata: {
      ...(existing.metadata ?? {}),
      ...(incoming.metadata ?? {}),
      dedupedModes: matchedModes,
    },
  };
};

export const dedupeHybridCandidates = (candidates: HybridCandidate[]): HybridCandidate[] => {
  const merged = new Map<string, HybridCandidate>();

  for (const candidate of candidates) {
    const key = dedupeKeyForCandidate(candidate);
    const existing = merged.get(key);
    merged.set(key, existing ? mergeHybridCandidates(existing, candidate) : candidate);
  }

  return Array.from(merged.values());
};
