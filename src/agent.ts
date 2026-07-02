import {
  findEvidence,
  findEvidenceWithDependencies,
  type EvidenceDependencies,
  type EvidenceItem,
  type EvidenceMode,
} from "./evidence.js";

// ---------------------------------------------------------------------------
// Sufficiency thresholds (promote to env vars when needed)
// ---------------------------------------------------------------------------

/** Minimum keyword score to consider a single result "useful". */
const MIN_USEFUL_KEYWORD_SCORE = 0.01;

/** Keyword score at which a result is considered "strong". */
const STRONG_KEYWORD_SCORE = 0.05;

/** Minimum results needed to skip per-score checks. */
const BULK_EVIDENCE_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResponseLabel =
  | "evidence_found"
  | "insufficient_evidence"
  | "not_found";

export type Confidence = "high" | "medium" | "low";

export type SuggestedAction =
  | "answer_from_evidence"
  | "request_clarification"
  | "report_not_found";

export interface AgentContext {
  retrievalMode: EvidenceMode;
  evidenceCount: number;
  averageScore: number | null;
  topScore: number | null;
  sourceTypes: string[];
  suggestedAction: SuggestedAction;
}

export interface AgentResponse {
  query: string;
  responseLabel: ResponseLabel;
  confidence: Confidence;
  evidenceSummary: string;
  evidence: EvidenceItem[];
  context: AgentContext;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const unique = (values: string[]): string[] => [...new Set(values)];

const average = (numbers: number[]): number => {
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
};

/** Map responseLabel → suggested next action for the future LLM. */
const actionForLabel = (label: ResponseLabel): SuggestedAction => {
  switch (label) {
    case "evidence_found":
      return "answer_from_evidence";
    case "insufficient_evidence":
      return "request_clarification";
    case "not_found":
      return "report_not_found";
  }
};

/**
 * Determine sufficiency from evidence count and scores.
 *
 * Rules:
 * - 0 results → not_found
 * - ≥ BULK_EVIDENCE_THRESHOLD results → evidence_found (quantity signal)
 * - Any result with score ≥ STRONG_KEYWORD_SCORE → evidence_found
 * - Phrase mode with any results → evidence_found (exact match = intentional)
 * - Otherwise (few results, low scores) → insufficient_evidence
 */
export const assessSufficiency = (
  evidence: EvidenceItem[],
  mode: EvidenceMode
): ResponseLabel => {
  if (evidence.length === 0) return "not_found";

  if (evidence.length >= BULK_EVIDENCE_THRESHOLD) return "evidence_found";

  // Phrase mode: if the exact phrase matched, that's a strong signal.
  if (mode === "phrase") return "evidence_found";

  // Keyword mode with few results: check scores.
  const scores = evidence
    .map((e) => e.score)
    .filter((s): s is number => s !== null);

  if (scores.length > 0 && Math.max(...scores) >= STRONG_KEYWORD_SCORE) {
    return "evidence_found";
  }

  // Few results, low scores.
  const allBelowMinimum =
    scores.length > 0 && scores.every((s) => s < MIN_USEFUL_KEYWORD_SCORE);

  return allBelowMinimum ? "insufficient_evidence" : "evidence_found";
};

/**
 * Derive confidence from the responseLabel and score distribution.
 */
export const assessConfidence = (
  label: ResponseLabel,
  evidence: EvidenceItem[]
): Confidence => {
  if (label === "not_found") return "low";
  if (label === "insufficient_evidence") return "low";

  const scores = evidence
    .map((e) => e.score)
    .filter((s): s is number => s !== null);

  if (scores.length === 0) {
    // Phrase mode — no numeric scores, but exact match → medium.
    return evidence.length >= BULK_EVIDENCE_THRESHOLD ? "high" : "medium";
  }

  const top = Math.max(...scores);
  if (top >= STRONG_KEYWORD_SCORE && evidence.length >= BULK_EVIDENCE_THRESHOLD) {
    return "high";
  }
  if (top >= STRONG_KEYWORD_SCORE) return "medium";
  return "low";
};

/**
 * Build a human-readable summary line.
 */
export const buildSummary = (
  query: string,
  label: ResponseLabel,
  evidence: EvidenceItem[],
  sourceTypes: string[]
): string => {
  if (label === "not_found") {
    return `No evidence found for '${query}' in the municipal corpus.`;
  }

  const typeList = sourceTypes.join(", ");
  const scores = evidence
    .map((e) => e.score)
    .filter((s): s is number => s !== null);
  const topScore = scores.length > 0 ? Math.max(...scores) : null;

  const parts: string[] = [
    `Found ${evidence.length} citation${evidence.length === 1 ? "" : "s"}`,
    `from ${typeList}`,
  ];

  if (topScore !== null) {
    parts.push(`top score: ${topScore.toFixed(4)}`);
  }

  if (label === "insufficient_evidence") {
    parts.push("evidence may be insufficient");
  }

  return parts.join(". ") + ".";
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a user query: retrieve evidence, assess sufficiency, and prepare
 * structured context for a future LLM.
 *
 * This is the single entry point the agent (or `/api/agent` endpoint) should
 * call. It never invents information — it only reasons about what the
 * retrieval layer found.
 */
export const evaluateQueryWithDependencies = async (
  query: string,
  mode: EvidenceMode = "keyword",
  limit = 5,
  dependencies: EvidenceDependencies = {}
): Promise<AgentResponse> => {
  const evidenceResponse = await findEvidenceWithDependencies(query, mode, limit, dependencies);
  const { evidence } = evidenceResponse;

  const responseLabel = assessSufficiency(evidence, mode);
  const confidence = assessConfidence(responseLabel, evidence);

  const scores = evidence
    .map((e) => e.score)
    .filter((s): s is number => s !== null);

  const sourceTypes = unique(evidence.map((e) => e.sourceType));

  const context: AgentContext = {
    retrievalMode: mode,
    evidenceCount: evidence.length,
    averageScore: scores.length > 0 ? average(scores) : null,
    topScore: scores.length > 0 ? Math.max(...scores) : null,
    sourceTypes,
    suggestedAction: actionForLabel(responseLabel),
  };

  return {
    query,
    responseLabel,
    confidence,
    evidenceSummary: buildSummary(query, responseLabel, evidence, sourceTypes),
    evidence,
    context,
  };
};

export const evaluateQuery = async (
  query: string,
  mode: EvidenceMode = "keyword",
  limit = 5
): Promise<AgentResponse> => {
  const evidenceResponse = await findEvidence(query, mode, limit);
  return evaluateQueryWithDependencies(query, mode, limit, {
    keywordSearch: async () => [],
    phraseSearch: async () => [],
  }).then(async () => {
    const { evidence } = evidenceResponse;
    const responseLabel = assessSufficiency(evidence, mode);
    const confidence = assessConfidence(responseLabel, evidence);
    const scores = evidence.map((e) => e.score).filter((s): s is number => s !== null);
    const sourceTypes = unique(evidence.map((e) => e.sourceType));

    return {
      query,
      responseLabel,
      confidence,
      evidenceSummary: buildSummary(query, responseLabel, evidence, sourceTypes),
      evidence,
      context: {
        retrievalMode: mode,
        evidenceCount: evidence.length,
        averageScore: scores.length > 0 ? average(scores) : null,
        topScore: scores.length > 0 ? Math.max(...scores) : null,
        sourceTypes,
        suggestedAction: actionForLabel(responseLabel),
      },
    };
  });
};
