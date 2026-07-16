import type { EvidenceDependencies, EvidenceMode } from "../evidence.js";
import { loadDomainPack } from "../domain/registry.js";
import type { DomainPack } from "../domain/types.js";
import { classifyProcedureQuery } from "./procedureClassifier.js";
import { composeProcedureWorkflow } from "./procedureComposer.js";
import { retrieveProcedureEvidence } from "./procedureRetriever.js";
import type { ProcedureWorkflow } from "./types.js";

export const buildProcedureWorkflowWithDependencies = async (
  query: string,
  mode: EvidenceMode = "keyword",
  limit = 8,
  dependencies: EvidenceDependencies = {},
  domainPack: DomainPack = loadDomainPack(undefined)
): Promise<ProcedureWorkflow> => {
  const classification = classifyProcedureQuery(query, domainPack);
  const evidenceBundle = await retrieveProcedureEvidence(classification, mode, limit, dependencies);
  return composeProcedureWorkflow(query, mode, classification, evidenceBundle.evidence.slice(0, limit), domainPack);
};

export { classifyProcedureQuery } from "./procedureClassifier.js";
export { composeProcedureWorkflow } from "./procedureComposer.js";
export type {
  EvidenceUse,
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureGap,
  ProcedureQueryClassification,
  ProcedureQueryIntent,
  ProcedureStep,
  ProcedureType,
  ProcedureWorkflow,
  SourceAuthorityClass,
} from "./types.js";
