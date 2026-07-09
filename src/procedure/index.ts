import type { EvidenceDependencies, EvidenceMode } from "../evidence.js";
import { classifyProcedureQuery } from "./procedureClassifier.js";
import { composeProcedureWorkflow } from "./procedureComposer.js";
import { retrieveProcedureEvidence } from "./procedureRetriever.js";
import type { ProcedureWorkflow } from "./types.js";

export const buildProcedureWorkflowWithDependencies = async (
  query: string,
  mode: EvidenceMode = "keyword",
  limit = 8,
  dependencies: EvidenceDependencies = {}
): Promise<ProcedureWorkflow> => {
  const classification = classifyProcedureQuery(query);
  const evidenceBundle = await retrieveProcedureEvidence(classification, mode, limit, dependencies);
  return composeProcedureWorkflow(query, mode, classification, evidenceBundle.evidence.slice(0, limit));
};

export { classifyProcedureQuery } from "./procedureClassifier.js";
export { composeProcedureWorkflow } from "./procedureComposer.js";
export type {
  EvidenceUse,
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureGap,
  ProcedureQueryClassification,
  ProcedureStep,
  ProcedureType,
  ProcedureWorkflow,
  SourceAuthorityClass,
} from "./types.js";
