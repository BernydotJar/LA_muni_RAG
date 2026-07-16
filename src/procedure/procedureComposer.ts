import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import type { DomainPack, DomainWorkflowTemplate, DomainWorkflowTemplateStep } from "../domain/types.js";
import { loadDomainPack } from "../domain/registry.js";
import { toProcedureCitation, hasLocalEvidence as citationsHaveLocalEvidence } from "./procedureAuthorities.js";
import { buildProcedureGaps } from "./procedureGaps.js";
import type {
  ProcedureCitation,
  ProcedureConfidence,
  ProcedureDependency,
  ProcedureQueryClassification,
  ProcedureStep,
  ProcedureStepEvidenceStatus,
  ProcedureType,
  ProcedureWorkflow,
  ProcedureWorkflowDepth,
} from "./types.js";

const normalize = (value: string): string =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const isMunicipalAntigua = (domainPack: DomainPack): boolean => domainPack.id === "municipal-antigua";

const templateForType = (domainPack: DomainPack, type: ProcedureType): DomainWorkflowTemplate => {
  const direct = domainPack.workflow