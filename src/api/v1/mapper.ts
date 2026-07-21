import { createHash } from "node:crypto";
import type {
  ProcedureCitation,
  ProcedureStep,
  ProcedureWorkflow,
} from "../../procedure/index.js";
import { isCanonicalUuid } from "../../security/index.js";
import type { ScopedSearchResult } from "../../search.js";
import type { ProcedureQueryRequestV1 } from "./types.js";
import { evidenceIdentityFromCitationLabel } from "./evidenceIdentity.js";

export const MIXCO_COMPARATIVE_WARNING =
  "Referencia comparativa de la Municipalidad de Mixco. No define por sí sola el procedimiento oficial de Antigua Guatemala.";

type AuthorityStatus =
  | "official_target_jurisdiction"
  | "official_national"
  | "comparative"
  | "contextual"
  | "unknown";
type EvidenceStatus =
  | "supported"
  | "inferred_for_review"
  | "comparative_reference"
  | "missing_evidence"
  | "not_applicable";

interface MappedSource {
  source_id: string;
  document_id: string;
  document_version_id: string;
  title: string;
  municipality: string | null;
  source_jurisdiction: string;
  target_jurisdiction: string;
  authority_status: AuthorityStatus;
  official_source: boolean;
  official_for_target_jurisdiction: boolean;
  source_url: string;
  content_sha256: string | null;
  status: "verified" | "acquired" | "ingested" | "missing_source" | "superseded";
  limitations: string[];
}

interface MappedCitation {
  citation_id: string;
  source_id: string;
  document_version_id: string;
  section_id: string;
  label: string;
  excerpt: string;
  source_url: string;
  page_start: number | null;
  page_end: number | null;
  authority_status: AuthorityStatus;
  jurisdiction: string;
  evidence_status: EvidenceStatus;
}

interface CitationMapping {
  internal: ProcedureCitation;
  source: MappedSource;
  citation: MappedCitation;
}

const normalized = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Stable RFC 4122-compatible UUID derived from non-secret response identity. */
export const deterministicUuid = (seed: string): string => {
  const bytes = createHash("sha256").update(seed, "utf8").digest().subarray(0, 16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const httpUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
};

const isMixco = (record: ScopedSearchResult): boolean =>
  normalized(record.municipalitySlug) === "mixco" ||
  normalized(record.municipalityName) === "mixco" ||
  normalized(record.municipalityName) === "municipalidad de mixco";

const isTargetMunicipality = (record: ScopedSearchResult): boolean => {
  const slug = normalized(record.municipalitySlug);
  const name = normalized(record.municipalityName);
  return (
    slug === "antigua-guatemala" ||
    slug === "la-antigua-guatemala-sacatepequez" ||
    name === "la antigua guatemala" ||
    name === "municipalidad de la antigua guatemala"
  );
};

const CANONICAL_TARGET_JURISDICTION =
  "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";

const isCanonicalTargetJurisdiction = (value: string): boolean =>
  normalized(value) === normalized(CANONICAL_TARGET_JURISDICTION);

const metadataJurisdiction = (record: ScopedSearchResult): string | null => {
  for (const key of ["source_jurisdiction", "jurisdiction"]) {
    const value = record.documentMetadata?.[key];
    if (typeof value === "string" && value.trim().length >= 2) return value.trim().slice(0, 240);
  }
  return null;
};

const sourceAuthority = (
  record: ScopedSearchResult,
  request: ProcedureQueryRequestV1
): AuthorityStatus => {
  if (isMixco(record)) return "comparative";
  if (
    isTargetMunicipality(record) &&
    record.officialSource === true &&
    isCanonicalTargetJurisdiction(request.jurisdiction)
  ) {
    return "official_target_jurisdiction";
  }
  if (isTargetMunicipality(record)) return "comparative";
  if (record.documentScope === "national" && record.officialSource === true) {
    return "official_national";
  }
  if (record.municipalityName || record.municipalitySlug) return "comparative";
  if (record.sourceUrl) return "contextual";
  return "unknown";
};

const sourceJurisdiction = (
  record: ScopedSearchResult,
  request: ProcedureQueryRequestV1,
  authority: AuthorityStatus
): string => {
  const declared = metadataJurisdiction(record);
  if (declared) return declared;
  if (isTargetMunicipality(record)) return CANONICAL_TARGET_JURISDICTION;
  if (authority === "official_national") return "República de Guatemala";
  if (isMixco(record)) return "Municipalidad de Mixco, Guatemala";
  if (record.municipalityName?.trim()) return record.municipalityName.trim().slice(0, 240);
  return "Jurisdicción de la fuente no confirmada";
};

const evidenceStatusForAuthority = (authority: AuthorityStatus): EvidenceStatus => {
  if (authority === "official_target_jurisdiction" || authority === "official_national") {
    return "supported";
  }
  if (authority === "comparative") return "comparative_reference";
  if (authority === "contextual") return "inferred_for_review";
  return "missing_evidence";
};

const sourceLimitations = (authority: AuthorityStatus, mixco: boolean): string[] => {
  if (mixco) return [MIXCO_COMPARATIVE_WARNING];
  if (authority === "official_target_jurisdiction") {
    return ["La vigencia y aplicación al caso concreto requieren revisión humana."];
  }
  if (authority === "official_national") {
    return [
      "La fuente nacional no demuestra por sí sola la práctica interna de la municipalidad objetivo.",
    ];
  }
  if (authority === "comparative") {
    return ["La referencia externa no define el procedimiento de la jurisdicción objetivo."];
  }
  return ["La autoridad y aplicabilidad de esta fuente requieren confirmación documental."];
};

const findEvidenceRecord = (
  citation: ProcedureCitation,
  records: readonly ScopedSearchResult[]
): ScopedSearchResult | undefined => {
  const identity = evidenceIdentityFromCitationLabel(citation.citationLabel);
  if (!identity) return undefined;
  return records.find(
    (record) =>
      record.documentId?.toLowerCase() === identity.documentId &&
      record.documentVersionId?.toLowerCase() === identity.documentVersionId &&
      record.sectionId?.toLowerCase() === identity.sectionId
  );
};

const validEvidenceIdentity = (
  record: ScopedSearchResult
): record is ScopedSearchResult & {
  documentId: string;
  documentVersionId: string;
  sectionId: string;
} =>
  isCanonicalUuid(record.documentId) &&
  isCanonicalUuid(record.documentVersionId) &&
  isCanonicalUuid(record.sectionId);

const excerptForRecord = (record: ScopedSearchResult, citation: ProcedureCitation): string => {
  const raw = "snippet" in record ? record.snippet : record.preview;
  const withoutMarkup = raw.replaceAll("<mark>", "").replaceAll("</mark>", "").trim();
  const excerpt = withoutMarkup || citation.excerpt.trim();
  return excerpt.slice(0, 4000);
};

const mapCitation = (
  internal: ProcedureCitation,
  record: ScopedSearchResult,
  request: ProcedureQueryRequestV1
): CitationMapping | null => {
  const sourceUrl = httpUrl(record.sourceUrl);
  if (
    !validEvidenceIdentity(record) ||
    !sourceUrl ||
    record.documentStatus !== "active" ||
    record.versionExtractionStatus !== "processed" ||
    record.documentMetadata?.confidentiality !== "public"
  ) {
    return null;
  }
  const excerpt = excerptForRecord(record, internal);
  if (!record.documentTitle.trim() || !record.citationLabel.trim() || !excerpt) return null;

  const authority = sourceAuthority(record, request);
  const jurisdiction = sourceJurisdiction(record, request, authority);
  const sourceId = deterministicUuid(
    `source:${request.tenant_id}:${record.documentId}:${record.documentVersionId}`
  );
  const mixco = isMixco(record);
  const source: MappedSource = {
    source_id: sourceId,
    document_id: record.documentId.toLowerCase(),
    document_version_id: record.documentVersionId.toLowerCase(),
    title: record.documentTitle.trim().slice(0, 500),
    municipality: mixco && record.officialSource === true ? "mixco" : null,
    source_jurisdiction: jurisdiction,
    target_jurisdiction: request.jurisdiction,
    authority_status: authority,
    official_source: record.officialSource === true,
    official_for_target_jurisdiction: authority === "official_target_jurisdiction",
    source_url: sourceUrl,
    content_sha256:
      typeof record.contentSha256 === "string" && /^[a-f0-9]{64}$/.test(record.contentSha256)
        ? record.contentSha256
        : null,
    status: "ingested",
    limitations: sourceLimitations(authority, mixco),
  };
  const citation: MappedCitation = {
    citation_id: deterministicUuid(
      `citation:${request.tenant_id}:${record.documentVersionId}:${record.sectionId}:${record.citationLabel}`
    ),
    source_id: sourceId,
    document_version_id: record.documentVersionId.toLowerCase(),
    section_id: record.sectionId.toLowerCase(),
    label: record.citationLabel.trim().slice(0, 500),
    excerpt,
    source_url: sourceUrl,
    page_start: record.pageStart,
    page_end: record.pageStart,
    authority_status: authority,
    jurisdiction,
    evidence_status: evidenceStatusForAuthority(authority),
  };
  return { internal, source, citation };
};

const citationKey = (citation: ProcedureCitation): string =>
  (() => {
    const identity = evidenceIdentityFromCitationLabel(citation.citationLabel);
    return identity
      ? `${identity.documentId}:${identity.documentVersionId}:${identity.sectionId}`
      : "unbound";
  })();

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const strongestAuthority = (values: AuthorityStatus[]): AuthorityStatus => {
  const order: AuthorityStatus[] = [
    "official_target_jurisdiction",
    "official_national",
    "comparative",
    "contextual",
    "unknown",
  ];
  return order.find((candidate) => values.includes(candidate)) ?? "unknown";
};

const stepCitationRefs = (
  step: ProcedureStep,
  mappingsByKey: ReadonlyMap<string, CitationMapping>
): CitationMapping[] => {
  const refs = [...step.legalBasis, ...step.sourceEvidence]
    .map((citation) => mappingsByKey.get(citationKey(citation)))
    .filter((item): item is CitationMapping => Boolean(item));
  return [...new Map(refs.map((item) => [item.citation.citation_id, item])).values()];
};

const stepEvidenceStatus = (refs: CitationMapping[]): EvidenceStatus => {
  if (refs.length === 0) return "missing_evidence";
  const statuses = refs.map((ref) => ref.citation.evidence_status);
  if (statuses.includes("supported")) return "supported";
  if (statuses.includes("comparative_reference")) return "comparative_reference";
  return "inferred_for_review";
};

const confidenceFor = (status: EvidenceStatus): number => {
  if (status === "supported") return 0.72;
  if (status === "comparative_reference" || status === "inferred_for_review") return 0.4;
  return 0.18;
};

const documentReference = (
  tenantId: string,
  name: string,
  status: EvidenceStatus,
  citationRefs: string[]
) => ({
  document_requirement_id: deterministicUuid(`document-requirement:${tenantId}:${normalized(name)}`),
  name: name.trim().slice(0, 500),
  evidence_status: status === "supported" ? "inferred_for_review" : status,
  citation_refs: citationRefs,
});

export interface MapProcedureWorkflowOptions {
  request: ProcedureQueryRequestV1;
  workflow: ProcedureWorkflow;
  evidenceRecords: readonly ScopedSearchResult[];
  auditId: string;
  credentialId: string;
  createdAt: string;
}

export const mapProcedureWorkflowV1 = (options: MapProcedureWorkflowOptions): Record<string, unknown> => {
  const { request, workflow } = options;
  const mappings = workflow.citations
    .map((citation) => {
      const record = findEvidenceRecord(citation, options.evidenceRecords);
      return record ? mapCitation(citation, record, request) : null;
    })
    .filter((item): item is CitationMapping => Boolean(item));
  const mappingsByKey = new Map(mappings.map((item) => [citationKey(item.internal), item]));
  const sources = [...new Map(mappings.map((item) => [item.source.source_id, item.source])).values()];
  const citations = [
    ...new Map(mappings.map((item) => [item.citation.citation_id, item.citation])).values(),
  ];
  const stepIds = new Map(
    workflow.steps.map((step) => [
      step.stepNumber,
      deterministicUuid(`step:${request.tenant_id}:${request.request_id}:${step.stepNumber}`),
    ])
  );

  const steps = workflow.steps.map((step) => {
    const refs = stepCitationRefs(step, mappingsByKey);
    const citationRefs = refs.map((ref) => ref.citation.citation_id);
    const legalRefs = step.legalBasis
      .map((citation) => mappingsByKey.get(citationKey(citation))?.citation.citation_id)
      .filter((value): value is string => Boolean(value));
    const status = stepEvidenceStatus(refs);
    const authority = strongestAuthority(refs.map((ref) => ref.citation.authority_status));
    const outputDocuments = unique(step.outputDocuments.map((item) => item.trim()).filter(Boolean));
    return {
      step_id: stepIds.get(step.stepNumber),
      sequence: step.stepNumber,
      action: step.action.trim().slice(0, 2000),
      responsible_actor: null,
      responsible_unit: null,
      preconditions: unique(
        (step.dependsOn ?? [])
          .map((sequence) => `Completar o validar el paso ${sequence}.`)
          .filter(Boolean)
      ),
      required_documents: unique(step.requiredDocuments.map((item) => item.trim()).filter(Boolean)).map(
        (name) => documentReference(request.tenant_id, name, status, citationRefs)
      ),
      output_documents: outputDocuments,
      external_system: null,
      approvals: [],
      legal_basis: unique(legalRefs),
      citation_refs: unique(citationRefs),
      authority_status: authority,
      jurisdiction: refs[0]?.citation.jurisdiction ?? request.jurisdiction,
      evidence_status: status,
      confidence: confidenceFor(status),
      deadline: null,
      completion_criteria:
        outputDocuments.length > 0
          ? outputDocuments.map(
              (item) => `El resultado documental «${item}» está registrado para revisión humana.`
            )
          : ["La acción está documentada y lista para revisión humana."],
      follow_up_cadence: null,
      risks: ["Ejecutar este paso sin validación humana y documental."],
      unknowns: unique([
        "Actor responsable pendiente de evidencia.",
        "Unidad responsable pendiente de evidencia.",
        "Plazo pendiente de evidencia.",
        "Sistema externo pendiente de evidencia.",
        ...(status === "missing_evidence"
          ? ["Documento o regla pendiente de localizar y validar."]
          : []),
      ]),
    };
  });

  const dependencies = (workflow.dependencies ?? [])
    .map((dependency) => ({
      from_step_id: stepIds.get(dependency.fromStep),
      to_step_id: stepIds.get(dependency.toStep),
      dependency_type: dependency.type,
    }))
    .filter(
      (dependency): dependency is {
        from_step_id: string;
        to_step_id: string;
        dependency_type: "precondition" | "document" | "decision";
      } => Boolean(dependency.from_step_id && dependency.to_step_id)
    );

  const decisionGates = workflow.steps.flatMap((step) => {
    if (!step.decisionGate) return [];
    const stepId = stepIds.get(step.stepNumber);
    if (!stepId) return [];
    return [
      {
        gate_id: deterministicUuid(`gate:${request.tenant_id}:${request.request_id}:${step.stepNumber}`),
        step_id: stepId,
        question: step.decisionGate.question,
        outcomes: [
          {
            outcome: step.decisionGate.onApproved,
            next_step_id: stepIds.get(step.stepNumber + 1) ?? null,
          },
          { outcome: step.decisionGate.onRejected, next_step_id: null },
        ],
      },
    ];
  });

  const requiredDocuments = [
    ...new Map(
      steps
        .flatMap((step) => step.required_documents)
        .map((reference) => [reference.document_requirement_id, reference])
    ).values(),
  ];
  const outputs = unique(steps.flatMap((step) => step.output_documents));
  const gaps = workflow.gaps.map((gap, index) => ({
    gap_id: deterministicUuid(
      `gap:${request.tenant_id}:${request.request_id}:${index}:${gap.missingItem}`
    ),
    description: gap.missingItem,
    severity:
      gap.severity === "nice_to_have"
        ? ("informational" as const)
        : gap.severity,
    next_documental_action: gap.requiredToConfirm,
  }));
  if (citations.length < workflow.citations.length) {
    gaps.push({
      gap_id: deterministicUuid(`gap:${request.tenant_id}:${request.request_id}:provenance`),
      description:
        "Una o más evidencias recuperadas carecen de identidad documental completa o URL verificable.",
      severity: "important",
      next_documental_action:
        "Completar document_id, document_version_id, section_id y source_url antes de citar la evidencia.",
    });
  }
  if (citations.length === 0 && gaps.length === 0) {
    gaps.push({
      gap_id: deterministicUuid(`gap:${request.tenant_id}:${request.request_id}:missing-evidence`),
      description: "No se localizó evidencia citable suficiente para respaldar el workflow.",
      severity: "blocking",
      next_documental_action: "Localizar y validar una fuente oficial aplicable a la jurisdicción objetivo.",
    });
  }

  const hasMixcoReference = options.evidenceRecords.some(isMixco);
  const limitations = unique([
    "Borrador generado por IA; requiere revisión humana y no constituye aprobación ni instrucción ejecutable.",
    "Actores, unidades, plazos y sistemas externos permanecen sin asignar cuando no existe evidencia explícita.",
    workflow.validationWarning,
    ...(hasMixcoReference ? [MIXCO_COMPARATIVE_WARNING] : []),
  ].filter(Boolean));

  return {
    schema_version: "v1",
    response_type: "procedure_workflow",
    product_boundary: "evidence_and_procedure_only",
    procedure_id: deterministicUuid(
      `procedure:${request.tenant_id}:${request.jurisdiction}:${workflow.procedureType}`
    ),
    workflow_id: deterministicUuid(
      `workflow:${request.tenant_id}:${request.request_id}:${workflow.procedureType}`
    ),
    workflow_version: "1.0.0",
    tenant_id: request.tenant_id.toLowerCase(),
    request_id: request.request_id.toLowerCase(),
    title: workflow.title.slice(0, 500),
    jurisdiction: request.jurisdiction,
    authority_status: strongestAuthority(sources.map((source) => source.authority_status)),
    approval_status: "draft",
    steps,
    dependencies,
    decision_gates: decisionGates,
    required_documents: requiredDocuments,
    outputs,
    sources,
    citations,
    gaps,
    limitations,
    provenance: {
      source_product: "la_muni_rag",
      generated_by: "ai",
      created_at: options.createdAt,
      source_refs: sources.map((source) => `source:${source.source_id}`),
      credential_id: options.credentialId.toLowerCase(),
      audit_id: options.auditId.toLowerCase(),
    },
  };
};
