import type {
  EvidenceGapRequestV1,
  EvidenceGapResponseV1,
} from "./evidenceGapTypes.js";

export interface MapEvidenceGapResponseOptions {
  request: EvidenceGapRequestV1;
  auditId: string;
  credentialId: string;
  submittedAt: string;
}

export const mapEvidenceGapResponseV1 = (
  options: MapEvidenceGapResponseOptions
): EvidenceGapResponseV1 => ({
  schema_version: "v1",
  response_type: "evidence_gap_request",
  product_boundary: "evidence_gap_request_only",
  gap_request_id: options.request.gap_request_id.toLowerCase(),
  request_id: options.request.request_id.toLowerCase(),
  tenant_id: options.request.tenant_id.toLowerCase(),
  requester_product: "os_electoral",
  jurisdiction: options.request.jurisdiction,
  subject: options.request.subject,
  missing_document: options.request.missing_document,
  reason: options.request.reason,
  priority: options.request.priority,
  campaign_reference: options.request.campaign_reference,
  status: "open",
  request_assertion_status: "requester_supplied_unverified",
  submitted_at: options.submittedAt,
  limitations: [
    "Solicitud aceptada para investigación documental; no declara una fuente oficial, vigente, aplicable, adquirida ni validada.",
    "La prioridad y la referencia de campaña no determinan autoridad jurídica ni alteran el estado del corpus.",
  ],
  provenance: {
    source_product: "la_muni_rag",
    generated_by: "system",
    created_at: options.submittedAt,
    source_refs: [`evidence-gap:${options.request.gap_request_id.toLowerCase()}`],
    credential_id: options.credentialId.toLowerCase(),
    audit_id: options.auditId.toLowerCase(),
  },
});
