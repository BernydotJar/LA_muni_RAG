import { findEvidenceWithDependencies, type EvidenceDependencies, type EvidenceMode } from "../evidence.js";
import type { ProcedureEvidenceBundle, ProcedureQueryClassification } from "./types.js";

const dedupeByCitation = (bundles: ProcedureEvidenceBundle[]): ProcedureEvidenceBundle => {
  const seen = new Set<string>();
  const evidence = bundles.flatMap((bundle) => bundle.evidence).filter((item) => {
    const key = `${item.citationLabel}:${item.pageStart ?? "unknown"}:${item.excerpt.slice(0, 60)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    query: bundles.map((bundle) => bundle.query).join(" | "),
    mode: bundles[0]?.mode ?? "keyword",
    evidence,
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

  return dedupeByCitation(bundles);
};
