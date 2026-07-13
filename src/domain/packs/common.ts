import type { DomainFeedbackType, DomainSourceAuthority } from "../types.js";

export const commonFeedbackTypes: DomainFeedbackType[] = [
  { id: "missing_document", label: "Falta documento", description: "A required or confirming document is missing." },
  { id: "wrong_or_unclear_step", label: "Paso incorrecto o confuso", description: "A workflow step appears incorrect or unclear." },
  { id: "unclear_responsible", label: "Responsable no claro", description: "The responsible role or unit is missing or ambiguous." },
  { id: "missing_legal_basis", label: "Falta fundamento", description: "The step needs a cited authority, policy, or source basis." },
  { id: "missing_deadline", label: "Falta plazo", description: "The workflow needs an explicitly cited deadline." },
  { id: "missing_case_evidence", label: "Falta expediente", description: "Case-specific evidence is missing." },
  { id: "other", label: "Otro", description: "Other reviewer feedback." },
];

export const unknownAuthority: DomainSourceAuthority = {
  id: "unknown",
  label: "Unknown",
  description: "Insufficient metadata to classify authority.",
  authorityLevel: "unknown",
  titleKeywords: [],
  sourceTypes: [],
};
