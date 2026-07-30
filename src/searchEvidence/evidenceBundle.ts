import { deterministicUuid } from "../api/v1/mapper.js";
import type {
  ClassifiedSearchCandidate,
  EvidenceBundleCreateRequestV1,
} from "../api/v1/searchEvidenceTypes.js";

const MIXCO_WARNING =
  "Referencia comparativa de la Municipalidad de Mixco. No define por sí sola el procedimiento oficial de Antigua Guatemala.";
const COMPARATIVE_CORROBORATION =
  "La referencia comparativa requiere corroboración con una fuente nacional aplicable o una fuente oficial validada de La Antigua Guatemala.";
const HUMAN_REVIEW =
  "La autoridad, vigencia, supersession, jurisdicción y aplicación al caso concreto requieren revisión humana.";
const PRODUCT_BOUNDARY =
  "Artefacto documental: no contiene estrategia electoral, segmentación, movilización, contenido de campaña ni decisiones jurídicas automatizadas.";
const CONFLICT_LIMITATION =
  "Conflicto explícito entre versiones documentales: ninguna versión se promueve silenciosamente y se requiere revisión humana.";

const normalized = (value: string): string => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/\s+/g, " ")
  .trim();

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const isMixco = (candidate: ClassifiedSearchCandidate): boolean =>
  normalized(candidate.sourceJurisdiction).includes("mixco");

const sourceEntryId = (candidate: ClassifiedSearchCandidate): string =>
  deterministicUuid(
    `evidence-source:${candidate.tenantId}:${candidate.sourceId}:${candidate.documentId}:${candidate.documentVersionId}`
  );

const citationId = (candidate: ClassifiedSearchCandidate): string =>
  deterministicUuid(
    `evidence-citation:${candidate.tenantId}:${candidate.documentVersionId}:${candidate.sectionId}:${candidate.citationLabel}`
  );

const bundleEvidenceStatus = (
  candidate: ClassifiedSearchCandidate
): "supported" | "comparative_reference" | "inferred_for_review" => {
  if (candidate.evidenceStatus === "supported") return "supported";
  if (candidate.evidenceStatus === "comparative_reference") return "comparative_reference";
  return "inferred_for_review";
};

const sourceLimitations = (candidate: ClassifiedSearchCandidate): string[] => unique([
  ...candidate.limitations,
  ...(isMixco(candidate) ? [MIXCO_WARNING] : []),
  ...(candidate.evidenceStatus === "comparative_reference" ? [COMPARATIVE_CORROBORATION] : []),
  HUMAN_REVIEW,
]);

const citationFor = (candidate: ClassifiedSearchCandidate) => ({
  citation_id: citationId(candidate),
  source_id: sourceEntryId(candidate),
  document_version_id: candidate.documentVersionId.toLowerCase(),
  section_id: candidate.sectionId.toLowerCase(),
  label: candidate.citationLabel.slice(0, 500),
  excerpt: candidate.excerpt.slice(0, 4000),
  source_url: candidate.sourceUrl,
  page_start: candidate.pageStart,
  page_end: candidate.pageEnd,
  authority_status: candidate.authorityStatus,
  jurisdiction: candidate.sourceJurisdiction.slice(0, 240),
  evidence_status: bundleEvidenceStatus(candidate),
});

const sourceFor = (candidate: ClassifiedSearchCandidate) => ({
  source_id: sourceEntryId(candidate),
  document_id: candidate.documentId.toLowerCase(),
  document_version_id: candidate.documentVersionId.toLowerCase(),
  title: candidate.documentTitle.slice(0, 500),
  municipality: isMixco(candidate) ? "mixco" : null,
  source_jurisdiction: candidate.sourceJurisdiction.slice(0, 240),
  target_jurisdiction: candidate.targetJurisdiction.slice(0, 240),
  authority_status: candidate.authorityStatus,
  official_source: candidate.officialSource,
  official_for_target_jurisdiction:
    candidate.authorityStatus === "official_target_jurisdiction"
    && candidate.officialForTargetJurisdiction,
  source_url: candidate.sourceUrl,
  content_sha256: candidate.contentSha256,
  status: "ingested" as const,
  limitations: sourceLimitations(candidate),
});

const conflictSlot = (candidate: ClassifiedSearchCandidate): string => [
  candidate.documentId.toLowerCase(),
  normalized(candidate.citationLabel),
  candidate.pageStart ?? "no-page",
].join(":");

interface VersionConflict {
  key: string;
  candidates: ClassifiedSearchCandidate[];
}

const versionConflicts = (candidates: ClassifiedSearchCandidate[]): VersionConflict[] => {
  const grouped = new Map<string, ClassifiedSearchCandidate[]>();
  for (const candidate of candidates) {
    const key = conflictSlot(candidate);
    const group = grouped.get(key) ?? [];
    group.push(candidate);
    grouped.set(key, group);
  }
  return [...grouped.entries()]
    .map(([key, group]) => ({
      key,
      candidates: [...new Map(
        group.map((candidate) => [candidate.documentVersionId.toLowerCase(), candidate])
      ).values()].sort((left, right) => left.documentVersionId.localeCompare(right.documentVersionId)),
    }))
    .filter((conflict) =>
      conflict.candidates.length >= 2
      && new Set(conflict.candidates.map((candidate) => normalized(candidate.excerpt))).size >= 2
    );
};

export interface EvidenceBundleBuildOptions {
  request: EvidenceBundleCreateRequestV1;
  candidates: ClassifiedSearchCandidate[];
  auditId: string;
  credentialId: string;
  createdAt: string;
}

export const buildEvidenceBundle = (options: EvidenceBundleBuildOptions): Record<string, unknown> => {
  const { request, candidates } = options;
  const sources = [...new Map(
    candidates.map((candidate) => [sourceEntryId(candidate), sourceFor(candidate)])
  ).values()];
  const citations = [...new Map(
    candidates.map((candidate) => [citationId(candidate), citationFor(candidate)])
  ).values()];

  const conflicts = versionConflicts(candidates);
  const conflictingCitationIds = new Set(
    conflicts.flatMap((conflict) => conflict.candidates.map(citationId))
  );

  const ordinaryClaims = candidates
    .filter((candidate) =>
      candidate.evidenceStatus === "supported"
      && !conflictingCitationIds.has(citationId(candidate))
    )
    .map((candidate) => ({
      claim_id: deterministicUuid(
        `evidence-claim:${request.tenant_id}:${request.request_id}:${citationId(candidate)}`
      ),
      text: candidate.excerpt.slice(0, 3000),
      citation_refs: [citationId(candidate)],
      evidence_status: "supported" as const,
      limitations: unique([...candidate.limitations, HUMAN_REVIEW]),
    }));

  const conflictClaims = conflicts.flatMap((conflict) =>
    conflict.candidates.map((candidate) => ({
      claim_id: deterministicUuid(
        `evidence-conflict-claim:${request.tenant_id}:${request.request_id}:${citationId(candidate)}`
      ),
      text: candidate.excerpt.slice(0, 3000),
      citation_refs: [citationId(candidate)],
      evidence_status: "inferred_for_review" as const,
      limitations: unique([...candidate.limitations, CONFLICT_LIMITATION, HUMAN_REVIEW]),
    }))
  );
  const conflictClaimByCitation = new Map(
    conflictClaims.map((claim) => [claim.citation_refs[0]!, claim])
  );
  const contradictions = conflicts.map((conflict) => ({
    contradiction_id: deterministicUuid(
      `evidence-contradiction:${request.tenant_id}:${request.request_id}:${conflict.key}`
    ),
    claim_refs: conflict.candidates
      .map((candidate) => conflictClaimByCitation.get(citationId(candidate))?.claim_id)
      .filter((value): value is string => Boolean(value)),
    description:
      "El mismo documento y ubicación citable aparece en versiones distintas con extractos diferentes. Se requiere revisión humana de publicación, vigencia y supersession antes de seleccionar una versión.",
    review_required: true as const,
  })).filter((item) => item.claim_refs.length >= 2);

  const claims = [...ordinaryClaims, ...conflictClaims];
  const missingEvidence: Array<Record<string, unknown>> = [];
  if (ordinaryClaims.length === 0) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:supported-source`
      ),
      subject: request.query.slice(0, 500),
      missing_document: "Fuente oficial vigente y aplicable que respalde la consulta",
      reason:
        "No se recuperó evidencia simultáneamente validada, oficial para la jurisdicción objetivo o nacional aplicable, y vigente según las fechas almacenadas.",
      next_documental_action:
        "Localizar, adquirir, validar, ingerir y revisar humanamente una fuente oficial aplicable antes de sostener la afirmación.",
    });
  }
  if (candidates.some((candidate) => candidate.evidenceStatus === "comparative_reference")) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:comparative-corroboration`
      ),
      subject: request.query.slice(0, 500),
      missing_document: "Corroboración oficial nacional o de La Antigua Guatemala",
      reason: COMPARATIVE_CORROBORATION,
      next_documental_action:
        "Buscar y validar una fuente nacional aplicable o una fuente oficial de La Antigua Guatemala antes de reutilizar la referencia comparativa.",
    });
  }
  for (const conflict of conflicts) {
    missingEvidence.push({
      gap_id: deterministicUuid(
        `evidence-gap:${request.tenant_id}:${request.request_id}:conflict:${conflict.key}`
      ),
      subject: request.query.slice(0, 500),
      missing_document: "Resolución humana del conflicto de versiones documentales",
      reason: CONFLICT_LIMITATION,
      next_documental_action:
        "Comparar fechas, autoridad, texto, publicación y supersession, y aprobar explícitamente la versión aplicable.",
    });
  }

  return {
    schema_version: "v1",
    response_type: "evidence_bundle",
    product_boundary: "evidence_and_procedure_only",
    evidence_bundle_id: deterministicUuid(
      `evidence-bundle:${request.tenant_id}:${request.request_id}`
    ),
    tenant_id: request.tenant_id.toLowerCase(),
    request_id: request.request_id.toLowerCase(),
    query: request.query,
    jurisdiction: request.jurisdiction,
    generated_at: options.createdAt,
    sources,
    claims,
    citations,
    contradictions,
    missing_evidence: missingEvidence,
    limitations: unique([
      PRODUCT_BOUNDARY,
      HUMAN_REVIEW,
      "La ausencia de contradicciones registradas no demuestra consistencia o completitud del corpus.",
      ...(candidates.some(isMixco) ? [MIXCO_WARNING, COMPARATIVE_CORROBORATION] : []),
    ]),
    provenance: {
      source_product: "la_muni_rag",
      generated_by: "system",
      created_at: options.createdAt,
      source_refs: sources.map((source) => `source:${source.source_id}`),
      credential_id: options.credentialId.toLowerCase(),
      audit_id: options.auditId.toLowerCase(),
    },
  };
};
