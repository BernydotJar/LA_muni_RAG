import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import type { DomainAuthorityLevel, DomainPackId } from "../domain/types.js";

export type SourceAuthorityClass = string;

export type ProcedureType = string;

export type ProcedureConfidence = "high" | "medium" | "low";

export type ProcedureWorkflowDepth = "overview" | "deep_dive";

export type ProcedureStepEvidenceStatus = "supported" | "inferred" | "insufficient";

export type ProcedureSourceAttributionStatus =
  | "official_municipal"
  | "official_n