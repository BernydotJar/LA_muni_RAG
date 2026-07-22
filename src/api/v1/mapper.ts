import { createHash } from "node:crypto";
import type {
  ProcedureCitation,
  ProcedureStep,
  ProcedureWorkflow,
} from "../../procedure/index.js";
import { isCanonicalUuid } from "../../security/index.js";
import type { ScopedSearchResult } from "../../search.js";
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

interface VersionConflict {
  conflict_key: string;
  mappings: CitationMapping[];
}

export interface EvidenceArtifactRequestV1 {
  tenant_id: string;
  request_id: string;
  question: string;
  jurisdiction: string;
}

export interface ProcedureAssessmentRequestV1 extends EvidenceArtifactRequestV1 {
  case_context: {
    subject_reference: string;
    community_id: string;
    facts: string[];
    provided_documents: string[];
    constraints: string[];
  };
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
  request: EvidenceArtifactRequestV1
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
  request: EvidenceArtifactRequestV1,
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

const evidenceStatusForCitation = (
  authority: AuthorityStatus,
  evidenceUse: ProcedureCitation["evidenceUse"]
): EvidenceStatus => {
  const authorityStatus = evidenceStatusForAuthority(authority);
  if (evidenceUse === "validation_required") return "missing_evidence";
  if (evidenceUse === "inference") {
    return authorityStatus === "comparative_reference"
      ? "comparative_reference"
      : "inferred_for_review";
  }
  return authorityStatus;
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
  request: EvidenceArtifactRequestV1
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
    evidence_status: evidenceStatusForCitation(authority, internal.evidenceUse),
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

const normalizedConflictText = (value: string): string =>
  normalized(value.replace(/<\/?mark>/gi, ""));

const versionConflictSlot = (mapping: CitationMapping): string =>
  [
    mapping.source.document_id,
    normalized(mapping.citation.label),
    mapping.citation.page_start ?? "no-page",
  ].join(":");

const detectVersionConflicts = (mappings: CitationMapping[]): VersionConflict[] => {
  const groups = new Map<string, CitationMapping[]>();
  for (const mapping of mappings) {
    const key = versionConflictSlot(mapping);
    const group = groups.get(key) ?? [];
    group.push(mapping);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([conflictKey, group]) => {
      const byVersion = new Map<string, CitationMapping>();
      for (const mapping of [...group].sort((left, right) =>
        left.citation.citation_id.localeCompare(right.citation.citation_id)
      )) {
        if (!byVersion.has(mapping.citation.document_version_id)) {
          byVersion.set(mapping.citation.document_version_id, mapping);
        }
      }
      return {
        conflict_key: conflictKey,
        mappings: [...byVersion.values()].sort((left, right) =>
          left.citation.document_version_id.localeCompare(right.citation.document_version_id)
        ),
      };
    })
    .filter(
      (conflict) =>
        conflict.mappings.length >= 2 &&
        new Set(
          conflict.mappings.map((mapping) => normalizedConflictText(mapping.citation.excerpt))
        ).size >= 2
    )
    .sort((left, right) => left.conflict_key.localeCompare(right.conflict_key));
};

const conflictCitationIds = (conflicts: readonly VersionConflict[]): Set<string> =>
  new Set(
    conflicts.flatMap((conflict) =>
      conflict.mappings.map((mapping) => mapping.citation.citation_id)
    )
  );

const refsHaveConflict = (
  refs: readonly CitationMapping[],
  conflictingCitationIds: ReadonlySet<string>
): boolean =>
  refs.some((ref) => conflictingCitationIds.has(ref.citation.citation_id));

const conflictReviewLimitation =
  "Conflicto explícito entre versiones documentales: ninguna versión puede promoverse silenciosamente; se requiere revisión humana de vigencia, autoridad y supersession.";

const conflictNextDocumentalAction =
  "Comparar las versiones, confirmar fechas de publicación y vigencia, revisar autoridad y supersession, y aprobar explícitamente la versión aplicable antes de usarla.";

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

const stepEvidenceStatus = (
  refs: CitationMapping[],
  conflictingCitationIds: ReadonlySet<string> = new Set()
): EvidenceStatus => {
  if (refs.length === 0) return "missing_evidence";
  if (refsHaveConflict(refs, conflictingCitationIds)) return "inferred_for_review";
  const statuses = refs.map((ref) => ref.citation.evidence_status);
  if (statuses.includes("supported")) return "supported";
  if (statuses.includes("comparative_reference")) return "comparative_reference";
  if (statuses.includes("inferred_for_review")) return "inferred_for_review";
  return "missing_evidence";
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
  request: EvidenceArtifactRequestV1;
  workflow: ProcedureWorkflow;
  evidenceRecords: readonly ScopedSearchResult[];
  auditId: string;
  credentialId: string;
  createdAt: string;
}

export type MapEvidenceBundleOptions = MapProcedureWorkflowOptions;

export interface MapProcedureAssessmentOptions
  extends Omit<MapProcedureWorkflowOptions, "request"> {
  request: ProcedureAssessmentRequestV1;
}

export interface MapClaimPackOptions extends MapEvidenceBundleOptions {
  validUntil: string;
}

interface MappedEvidenceContext {
  mappings: CitationMapping[];
  mappingsByKey: Map<string, CitationMapping>;
  sources: MappedSource[];
  citations: MappedCitation[];
  versionConflicts: VersionConflict[];
  conflictingCitationIds: Set<string>;
}

const mapEvidenceContext = (
  request: EvidenceArtifactRequestV1,
  workflow: ProcedureWorkflow,
  evidenceRecords: readonly ScopedSearchResult[]
): MappedEvidenceContext => {
  const mappings = workflow.citations
    .map((citation) => {
      const record = findEvidenceRecord(citation, evidenceRecords);
      return record ? mapCitation(citation, record, request) : null;
    })
    .filter((item): item is CitationMapping => Boolean(item));
  const versionConflicts = detectVersionConflicts(mappings);
  return {
    mappings,
    mappingsByKey: new Map(mappings.map((item) => [citationKey(item.internal), item])),
    sources: [
      ...new Map(mappings.map((item) => [item.source.source_id, item.source])).values(),
    ],
    citations: [
      ...new Map(
        mappings.map((item) => [item.citation.citation_id, item.citation])
      ).values(),
    ],
    versionConflicts,
    conflictingCitationIds: conflictCitationIds(versionConflicts),
  };
};

export const mapProcedureWorkflowV1 = (options: MapProcedureWorkflowOptions): Record<string, unknown> => {
  const { request, workflow } = options;
  const {
    mappingsByKey,
    sources,
    citations,
    versionConflicts,
    conflictingCitationIds,
  } = mapEvidenceContext(request, workflow, options.evidenceRecords);
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
    const hasVersionConflict = refsHaveConflict(refs, conflictingCitationIds);
    const status = stepEvidenceStatus(refs, conflictingCitationIds);
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
      risks: unique([
        "Ejecutar este paso sin validación humana y documental.",
        ...(hasVersionConflict
          ? ["Promover silenciosamente una versión documental mientras existe texto conflictivo."]
          : []),
      ]),
      unknowns: unique([
        "Actor responsable pendiente de evidencia.",
        "Unidad responsable pendiente de evidencia.",
        "Plazo pendiente de evidencia.",
        "Sistema externo pendiente de evidencia.",
        ...(status === "missing_evidence"
          ? ["Documento o regla pendiente de localizar y validar."]
          : []),
        ...(hasVersionConflict
          ? [
              "Versión documental aplicable pendiente de revisión humana.",
              "Vigencia, autoridad y supersession de las versiones en conflicto pendientes de confirmar.",
            ]
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
  for (const conflict of versionConflicts) {
    gaps.push({
      gap_id: deterministicUuid(
        `gap:${request.tenant_id}:${request.request_id}:version-conflict:${conflict.conflict_key}`
      ),
      description:
        `Conflicto de versiones documentales en «${conflict.mappings[0]?.citation.label ?? "ubicación citable"}»: ` +
        `${conflict.mappings.length} versiones del mismo documento contienen texto diferente.`,
      severity: "blocking",
      next_documental_action: conflictNextDocumentalAction,
    });
  }
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
    ...(versionConflicts.length > 0 ? [conflictReviewLimitation] : []),
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

interface AssessmentDocumentReference {
  document_requirement_id: string;
  name: string;
  evidence_status: EvidenceStatus;
  citation_refs: string[];
}

interface AssessmentWorkflowStep {
  step_id: string;
  evidence_status: EvidenceStatus;
  required_documents: AssessmentDocumentReference[];
  citation_refs: string[];
  unknowns: string[];
}

interface AssessmentWorkflowGap {
  description: string;
  severity: "blocking" | "important" | "informational";
  next_documental_action: string;
}

interface AssessmentMappedWorkflow {
  procedure_id: string;
  workflow_version: string;
  steps: AssessmentWorkflowStep[];
  required_documents: AssessmentDocumentReference[];
  citations: Array<{ citation_id: string }>;
  gaps: AssessmentWorkflowGap[];
  limitations: string[];
  provenance: {
    source_refs: string[];
  };
}

const boundedUniqueText = (values: readonly string[], maxItems = 256): string[] =>
  unique(values.map((value) => value.trim().slice(0, 1000)).filter(Boolean)).slice(0, maxItems);

/**
 * Produces a documentary readiness snapshot from the same canonical draft
 * workflow used by the other provider outputs. Caller-owned opaque document
 * references are never treated as validated case completion.
 */
export const mapProcedureAssessmentV1 = (
  options: MapProcedureAssessmentOptions
): Record<string, unknown> => {
  const mapped = mapProcedureWorkflowV1(options) as unknown as AssessmentMappedWorkflow;
  const missingById = new Map<string, AssessmentDocumentReference>();
  for (const reference of mapped.required_documents) {
    if (reference.evidence_status === "not_applicable") continue;
    missingById.set(reference.document_requirement_id, {
      ...reference,
      evidence_status:
        reference.evidence_status === "supported"
          ? "inferred_for_review"
          : reference.evidence_status,
      citation_refs: unique(reference.citation_refs),
    });
  }
  const missingRequirements = [...missingById.values()];
  const blockedSteps = unique(
    mapped.steps
      .filter(
        (step) =>
          step.evidence_status !== "supported" ||
          step.required_documents.some(
            (reference) => reference.evidence_status !== "not_applicable"
          )
      )
      .map((step) => step.step_id)
  );
  const evidenceRefs = unique([
    ...mapped.citations.map((citation) => citation.citation_id),
    ...mapped.steps.flatMap((step) => step.citation_refs),
    ...missingRequirements.flatMap((reference) => reference.citation_refs),
  ]);
  const unknowns = boundedUniqueText([
    ...mapped.steps.flatMap((step) => step.unknowns),
    ...mapped.gaps.map((gap) => gap.description),
    ...(options.request.case_context.provided_documents.length > 0
      ? [
          "Las referencias opacas de documentos proporcionadas por el consumidor están pendientes de vinculación y validación tenant-scoped.",
        ]
      : []),
  ]);
  const firstBlockingGap = mapped.gaps.find((gap) => gap.severity === "blocking");
  const nextDocumentalAction = (
    firstBlockingGap?.next_documental_action ??
    (missingRequirements[0]
      ? `Vincular y validar «${missingRequirements[0].name}» contra un documento tenant-scoped antes de considerar completo el requisito.`
      : "Realizar revisión humana del expediente y validar documentalmente cada requisito antes de continuar.")
  ).trim().slice(0, 1000);
  const limitations = boundedUniqueText(
    [
      ...mapped.limitations,
      "Evaluación documental de un workflow draft generado; no acredita cumplimiento legal, aprobación institucional, presupuesto, contratación ni ejecución.",
      "Las referencias en case_context.provided_documents son opacas y no completan requisitos sin un vínculo documental validado por LA Muni RAG.",
      "Los facts y constraints narrativos no se copian al artifact ni al replay; el consumidor conserva el contexto original asociado al request_id.",
      "El resultado requiere revisión humana y no contiene estrategia electoral ni instrucciones de producción de contenido.",
    ],
    64
  );

  return {
    schema_version: "v1",
    response_type: "procedure_assessment",
    product_boundary: "evidence_and_procedure_only",
    assessment_id: deterministicUuid(
      `assessment:${options.request.tenant_id}:${options.request.request_id}:${mapped.procedure_id}:${mapped.workflow_version}`
    ),
    procedure_id: mapped.procedure_id,
    workflow_version: mapped.workflow_version,
    tenant_id: options.request.tenant_id.toLowerCase(),
    request_id: options.request.request_id.toLowerCase(),
    jurisdiction: options.request.jurisdiction,
    case_context: {
      subject_reference: options.request.case_context.subject_reference,
      community_id: options.request.case_context.community_id,
      facts: [],
      provided_documents: [...options.request.case_context.provided_documents],
      constraints: [],
    },
    completed_requirements: [],
    missing_requirements: missingRequirements,
    blocked_steps: blockedSteps,
    unknowns,
    evidence_refs: evidenceRefs,
    next_documental_action: nextDocumentalAction,
    limitations,
    provenance: {
      source_product: "la_muni_rag",
      generated_by: "ai",
      created_at: options.createdAt,
      source_refs: [...mapped.provenance.source_refs],
      credential_id: options.credentialId.toLowerCase(),
      audit_id: options.auditId.toLowerCase(),
    },
  };
};

export const mapEvidenceBundleV1 = (options: MapEvidenceBundleOptions): Record<string, unknown> => {
  const { request, workflow } = options;
  const {
    mappingsByKey,
    sources,
    citations,
    versionConflicts,
    conflictingCitationIds,
  } = mapEvidenceContext(request, workflow, options.evidenceRecords);

  const normalClaims = workflow.steps.flatMap((step) => {
    const refs = stepCitationRefs(step, mappingsByKey);
    if (refs.length === 0 || refsHaveConflict(refs, conflictingCitationIds)) return [];
    const citationRefs = unique(refs.map((ref) => ref.citation.citation_id));
    const status = stepEvidenceStatus(refs, conflictingCitationIds);
    if (status === "missing_evidence") return [];
    const limitations = unique([
      ...refs.flatMap((ref) => ref.source.limitations),
      "Afirmación documental generada para revisión humana; no constituye una decisión electoral ni una instrucción ejecutable.",
    ]);
    return [
      {
        claim_id: deterministicUuid(
          `claim:${request.tenant_id}:${request.request_id}:${step.stepNumber}`
        ),
        text: `${step.title}: ${step.action}`.trim().slice(0, 3000),
        citation_refs: citationRefs,
        evidence_status: status,
        limitations,
      },
    ];
  });

  const conflictClaimsByCitationId = new Map(
    versionConflicts.flatMap((conflict) =>
      conflict.mappings.map((mapping) => [
        mapping.citation.citation_id,
        {
          claim_id: deterministicUuid(
            `claim:${request.tenant_id}:${request.request_id}:version-conflict:${mapping.citation.citation_id}`
          ),
          text:
            (`Texto recuperado de «${mapping.source.title}», versión ` +
              `${mapping.citation.document_version_id}, ${mapping.citation.label}: ` +
              mapping.citation.excerpt).slice(0, 3000),
          citation_refs: [mapping.citation.citation_id],
          evidence_status: "inferred_for_review" as const,
          limitations: unique([
            ...mapping.source.limitations,
            conflictReviewLimitation,
          ]),
        },
      ] as const)
    )
  );
  const conflictClaims = [...conflictClaimsByCitationId.values()];
  const claims = [...normalClaims, ...conflictClaims];
  const contradictions = versionConflicts
    .map((conflict) => ({
      contradiction_id: deterministicUuid(
        `contradiction:${request.tenant_id}:${request.request_id}:${conflict.conflict_key}`
      ),
      claim_refs: unique(
        conflict.mappings
          .map((mapping) =>
            conflictClaimsByCitationId.get(mapping.citation.citation_id)?.claim_id
          )
          .filter((value): value is string => Boolean(value))
      ),
      description:
        (`El mismo documento y ubicación citable «${conflict.mappings[0]?.citation.label ?? "sin etiqueta"}» ` +
          `aparece en ${conflict.mappings.length} versiones con texto diferente. ` +
          "Esto señala un conflicto explícito de versiones, no una conclusión semántica automática; se requiere revisión humana antes de seleccionar una versión.").slice(0, 3000),
      review_required: true as const,
    }))
    .filter((contradiction) => contradiction.claim_refs.length >= 2);

  const missingEvidence = workflow.gaps.map((gap, index) => ({
    gap_id: deterministicUuid(
      `evidence-gap:${request.tenant_id}:${request.request_id}:${index}:${gap.missingItem}`
    ),
    subject: workflow.title.trim().slice(0, 500),
    missing_document: gap.missingItem.trim().slice(0, 500),
    reason: gap.whyItMatters.trim().slice(0, 1000),
    next_documental_action: gap.requiredToConfirm.trim().slice(0, 1000),
  }));
  for (const step of workflow.steps) {
    const refs = stepCitationRefs(step, mappingsByKey);
    if (stepEvidenceStatus(refs, conflictingCitationIds) !== "missing_evidence") continue;
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:step:${step.stepNumber}`
      ),
      subject: `${workflow.title} — ${step.title}`.trim().slice(0, 500),
      missing_document: "Documento o regla que respalde este paso",
      reason:
        "El paso no tiene evidencia citable suficiente o la evidencia disponible requiere validación antes de sostener una afirmación.",
      next_documental_action:
        "Localizar y validar una fuente aplicable antes de convertir este paso en una afirmación respaldada.",
    });
  }
  for (const conflict of versionConflicts) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:version-conflict:${conflict.conflict_key}`
      ),
      subject: `${workflow.title} — conflicto de versiones`.trim().slice(0, 500),
      missing_document: "Resolución humana del conflicto de versiones documentales",
      reason:
        `El mismo documento y ubicación citable aparece en ${conflict.mappings.length} versiones con texto diferente.`,
      next_documental_action: conflictNextDocumentalAction,
    });
  }
  if (citations.length < workflow.citations.length) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:provenance`
      ),
      subject: workflow.title.trim().slice(0, 500),
      missing_document: "Identidad documental y URL verificable de la evidencia recuperada",
      reason:
        "Una o más evidencias no pueden citarse porque carecen de document_id, document_version_id, section_id o source_url verificable.",
      next_documental_action:
        "Completar y validar la identidad documental antes de usar la evidencia en una afirmación.",
    });
  }
  if (citations.length === 0 && missingEvidence.length === 0) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:missing-evidence`
      ),
      subject: workflow.title.trim().slice(0, 500),
      missing_document: "Fuente oficial aplicable a la jurisdicción objetivo",
      reason: "No se localizó evidencia citable suficiente para respaldar una afirmación.",
      next_documental_action:
        "Localizar, adquirir, validar e ingerir una fuente oficial antes de afirmar el procedimiento.",
    });
  }

  const hasMixcoReference = options.evidenceRecords.some(isMixco);
  const limitations = unique([
    "Artefacto documental para consumo de OS Electoral; no contiene estrategia, segmentación, territorio, movilización ni decisiones de campaña.",
    "Las afirmaciones requieren revisión humana de vigencia, jurisdicción y aplicación al caso concreto.",
    ...(versionConflicts.length === 0
      ? ["La ausencia de contradicciones registradas no demuestra que las fuentes sean consistentes o completas."]
      : [conflictReviewLimitation]),
    workflow.validationWarning,
    ...(hasMixcoReference ? [MIXCO_COMPARATIVE_WARNING] : []),
  ].filter(Boolean));

  return {
    schema_version: "v1",
    response_type: "evidence_bundle",
    product_boundary: "evidence_and_procedure_only",
    evidence_bundle_id: deterministicUuid(
      `evidence-bundle:${request.tenant_id}:${request.request_id}`
    ),
    tenant_id: request.tenant_id.toLowerCase(),
    request_id: request.request_id.toLowerCase(),
    query: request.question,
    jurisdiction: request.jurisdiction,
    generated_at: options.createdAt,
    sources,
    claims,
    citations,
    contradictions,
    missing_evidence: missingEvidence,
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

export const mapClaimPackV1 = (
  options: MapClaimPackOptions
): Record<string, unknown> | null => {
  const evidenceBundle = mapEvidenceBundleV1(options);
  const rawClaims = evidenceBundle.claims as Array<{
    claim_id: string;
    text: string;
    citation_refs: string[];
    evidence_status: EvidenceStatus;
    limitations: string[];
  }>;
  const rawCitations = evidenceBundle.citations as MappedCitation[];
  const contradictions = evidenceBundle.contradictions as Array<{
    review_required: boolean;
  }>;
  if (contradictions.some((contradiction) => contradiction.review_required)) {
    return null;
  }

  const claims = rawClaims
    .filter(
      (claim) =>
        claim.evidence_status === "supported" ||
        claim.evidence_status === "comparative_reference"
    )
    .map((claim) => ({
      ...claim,
      limitations: unique([
        ...claim.limitations,
        "No autoriza generación de contenido, estrategia de campaña ni publicación sin revisión humana.",
      ]),
    }));
  const referencedCitationIds = new Set(claims.flatMap((claim) => claim.citation_refs));
  const citations = rawCitations.filter((citation) =>
    referencedCitationIds.has(citation.citation_id)
  );
  const validCitationIds = new Set(citations.map((citation) => citation.citation_id));
  const boundedClaims = claims
    .map((claim) => ({
      ...claim,
      citation_refs: claim.citation_refs.filter((citationId) => validCitationIds.has(citationId)),
    }))
    .filter((claim) => claim.citation_refs.length > 0);
  const sourceLinks = unique(
    citations.map((citation) => citation.source_url).filter(Boolean)
  );

  if (boundedClaims.length === 0 || citations.length === 0 || sourceLinks.length === 0) {
    return null;
  }

  const hasComparativeReference = boundedClaims.some(
    (claim) => claim.evidence_status === "comparative_reference"
  );
  return {
    schema_version: "v1",
    response_type: "claim_pack",
    product_boundary: "claims_and_evidence_only",
    claim_pack_id: deterministicUuid(
      `claim-pack:${options.request.tenant_id}:${options.request.request_id}`
    ),
    tenant_id: options.request.tenant_id.toLowerCase(),
    request_id: options.request.request_id.toLowerCase(),
    jurisdiction: options.request.jurisdiction,
    claims: boundedClaims,
    citations,
    allowed_paraphrase_scope: {
      mode: "faithful_paraphrase_only",
      allowed_operations: ["paraphrase", "summarize", "translate"],
      content_generation_allowed: false,
      campaign_strategy_allowed: false,
    },
    legal_disclaimer:
      "Este paquete conserva claims y evidencia; no genera contenido ni sustituye revisión legal.",
    valid_until: options.validUntil,
    source_links: sourceLinks,
    limitations: unique([
      "No contiene copy, piezas, calendario editorial, canales, publicación ni recomendaciones de campaña.",
      "valid_until es un límite operativo de reutilización y no prueba por sí solo la vigencia jurídica de las fuentes.",
      "Las afirmaciones requieren revisión humana de vigencia, jurisdicción, contexto y alcance antes de su uso.",
      "La ausencia de contradicciones registradas no demuestra que las fuentes sean consistentes o completas.",
      options.workflow.validationWarning,
      ...(hasComparativeReference ? [MIXCO_COMPARATIVE_WARNING] : []),
    ].filter(Boolean)),
    provenance: {
      source_product: "la_muni_rag",
      generated_by: "system",
      created_at: options.createdAt,
      source_refs: unique(citations.map((citation) => `citation:${citation.citation_id}`)),
      credential_id: options.credentialId.toLowerCase(),
      audit_id: options.auditId.toLowerCase(),
    },
  };
};
