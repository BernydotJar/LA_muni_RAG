import { findEvidenceWithDependencies, type EvidenceDependencies, type EvidenceMode } from "../evidence.js";
import type { ProcedureEvidenceBundle, ProcedureQueryClassification } from "./types.js";

const dedupeByCitation = (
  bundles: Array<Pick<ProcedureEvidenceBundle, "query" | "mode" | "evidence">>,
  maximumEvidence: number
): ProcedureEvidenceBundle => {
  const seen = new Set<string>();
  const evidence: ProcedureEvidenceBundle["evidence"] = [];
  const retrievedEvidenceCount = bundles.reduce((total, bundle) => total + bundle.evidence.length, 0);
  const maximumDepth = Math.max(0, ...bundles.map((bundle) => bundle.evidence.length));

  // Interleave query families so one broad query cannot consume the complete
  // evidence budget before planning, environment, procurement and operations
  // have each contributed candidates.
  for (let depth = 0; depth < maximumDepth && evidence.length < maximumEvidence; depth += 1) {
    for (const bundle of bundles) {
      const item = bundle.evidence[depth];
      if (!item) continue;
      const key = `${item.citationLabel}:${item.pageStart ?? "unknown"}:${item.excerpt.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      evidence.push(item);
      if (evidence.length >= maximumEvidence) break;
    }
  }

  return {
    query: bundles.map((bundle) => bundle.query).join(" | "),
    mode: bundles[0]?.mode ?? "keyword",
    evidence,
    queryCount: bundles.length,
    retrievedEvidenceCount,
  };
};

export const retrieveProcedureEvidence = async (
  classification: ProcedureQueryClassification,
  mode: EvidenceMode = "keyword",
  limit = 8,
  dependencies: EvidenceDependencies = {}
): Promise<ProcedureEvidenceBundle> => {
  const queries = classification.retrievalQueries.slice(0, 4);
  const bundles = await Promise.all(
    queries.map(async (query) => {
      const response = await findEvidenceWithDependencies(query, mode, limit, dependencies);
      return {
        query,
        mode,
        evidence: response.evidence,
      } satisfies ProcedureEvidenceBundle;
    })
  );

  const maximumEvidence = Math.min(64, Math.max(limit, limit * Math.max(1, bundles.length)));
  return dedupeByCitation(bundles, maximumEvidence);
};
