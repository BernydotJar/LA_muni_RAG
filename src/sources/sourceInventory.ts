import type { DomainAuthorityLevel, DomainDocumentMetadata } from "../domain/types.js";

export type SourceInventoryState =
  | "missing_source"
  | "identified"
  | "verified"
  | "acquisition_pending"
  | "acquired"
  | "ingestion_pending"
  | "ingested"
  | "failed"
  | "superseded";

export type SourceInventoryAuthorityClass =
  | "official_municipal"
  | "official_national"
  | "external_reference"
  | "contextual"
  | "unknown";

export type SourceInventoryCategory =
  | "constitution"
  | "national_law"
  | "national_regulation"
  | "planning"
  | "budget"
  | "organization"
  | "procedure_manual"
  | "function_manual"
  | "council_record"
  | "form"
  | "community_record"
  | "public_portal"
  | "other";

export interface SourceInventoryAcquisitionEvidence {
  acquiredAt: string;
  artifactPath: string;
  contentSha256: string;
  mediaType?: string;
  byteLength?: number;
}

export interface SourceInventoryExtractionEvidence {
  extractedAt: string;
  extractor: string;
  sectionCount: number;
  outputPath?: string;
}

export interface SourceInventoryIndexingEvidence {
  indexedAt: string;
  indexer: string;
  chunkCount: number;
  manifestDocumentKey: string;
}

export interface SourceInventoryRecord {
  sourceId: string;
  documentKey: string;
  documentVersion: string;
  title: string;
  category: SourceInventoryCategory;
  status: SourceInventoryState;
  targetJurisdiction: string;
  sourceJurisdiction: string;
  municipality?: string;
  authorityClass: SourceInventoryAuthorityClass;
  authorityLevel: DomainAuthorityLevel;
  officialSource: boolean;
  officialForTargetJurisdiction: boolean;
  publicUrl?: string;
  verifiedAt?: string;
  publicationDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  acquisition?: SourceInventoryAcquisitionEvidence;
  extraction?: SourceInventoryExtractionEvidence;
  indexing?: SourceInventoryIndexingEvidence;
  failureCodes?: string[];
  supersedesSourceId?: string;
  supersededBySourceId?: string;
  limitations: string[];
  provenanceNotes: string[];
  tags?: string[];
}

export interface SourceAuthorityMetadata {
  sourceInventoryId: string;
  sourceMunicipality?: string;
  targetJurisdiction: string;
  sourceJurisdiction: string;
  authorityClass: SourceInventoryAuthorityClass;
  authorityLevel: DomainAuthorityLevel;
  officialSource: boolean;
  officialForTargetJurisdiction: boolean;
  documentVersion: string;
  limitations: string[];
}

export type SourceInventoryValidationCode =
  | "invalid_record"
  | "missing_source_id"
  | "missing_document_key"
  | "missing_document_version"
  | "missing_title"
  | "missing_target_jurisdiction"
  | "missing_source_jurisdiction"
  | "invalid_public_url"
  | "invalid_authority_combination"
  | "external_municipality_must_be_comparative"
  | "unknown_jurisdiction_cannot_be_primary"
  | "missing_source_has_evidence"
  | "verified_requires_url_and_timestamp"
  | "acquired_requires_acquisition_evidence"
  | "ingestion_pending_requires_acquisition"
  | "ingested_requires_full_evidence"
  | "failed_requires_failure_code"
  | "superseded_requires_replacement"
  | "duplicate_declared_version"
  | "conflicting_acquired_hash";

export interface SourceInventoryValidationFailure {
  code: SourceInventoryValidationCode;
  sourceId?: string;
  message: string;
}

export interface SourceInventoryValidationResult {
  valid: boolean;
  failures: SourceInventoryValidationFailure[];
}

export interface SourceInventorySummary {
  total: number;
  byStatus: Record<SourceInventoryState, number>;
  acquired: number;
  ingested: number;
  comparative: number;
  missing: number;
}

export const MIXCO_COMPARATIVE_LIMITATION =
  "Referencia comparativa de la Municipalidad de Mixco; no define por sí sola el procedimiento oficial de Antigua Guatemala.";

const STATES: SourceInventoryState[] = [
  "missing_source",
  "identified",
  "verified",
  "acquisition_pending",
  "acquired",
  "ingestion_pending",
  "ingested",
  "failed",
  "superseded",
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clean = (value: string): string => value.trim();

const normalizeJurisdiction = (value: string): string =>
  clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

const isAntiguaJurisdiction = (value: string): boolean => {
  const normalized = normalizeJurisdiction(value);
  return normalized.includes("antigua guatemala") || normalized === "antigua";
};

const isHttpUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const hasAcquisition = (record: SourceInventoryRecord): boolean => {
  const acquisition = record.acquisition;
  return Boolean(
    acquisition &&
      acquisition.acquiredAt.trim() &&
      acquisition.artifactPath.trim() &&
      /^[a-f0-9]{64}$/i.test(acquisition.contentSha256)
  );
};

const hasExtraction = (record: SourceInventoryRecord): boolean =>
  Boolean(
    record.extraction &&
      record.extraction.extractedAt.trim() &&
      record.extraction.extractor.trim() &&
      Number.isInteger(record.extraction.sectionCount) &&
      record.extraction.sectionCount > 0
  );

const hasIndexing = (record: SourceInventoryRecord): boolean =>
  Boolean(
    record.indexing &&
      record.indexing.indexedAt.trim() &&
      record.indexing.indexer.trim() &&
      record.indexing.manifestDocumentKey.trim() &&
      Number.isInteger(record.indexing.chunkCount) &&
      record.indexing.chunkCount > 0
  );

const failure = (
  code: SourceInventoryValidationCode,
  message: string,
  sourceId?: string
): SourceInventoryValidationFailure => {
  const result: SourceInventoryValidationFailure = { code, message };
  if (sourceId) result.sourceId = sourceId;
  return result;
};

export const validateSourceInventoryRecord = (value: unknown): SourceInventoryValidationResult => {
  if (!isObject(value)) {
    return { valid: false, failures: [failure("invalid_record", "Source inventory record must be an object.")] };
  }

  const record = value as unknown as SourceInventoryRecord;
  const failures: SourceInventoryValidationFailure[] = [];
  const sourceId = typeof record.sourceId === "string" ? record.sourceId : undefined;

  if (typeof record.sourceId !== "string" || clean(record.sourceId).length === 0) {
    failures.push(failure("missing_source_id", "sourceId must be a non-empty string."));
  }
  if (typeof record.documentKey !== "string" || clean(record.documentKey).length === 0) {
    failures.push(failure("missing_document_key", "documentKey must be a non-empty string.", sourceId));
  }
  if (typeof record.documentVersion !== "string" || clean(record.documentVersion).length === 0) {
    failures.push(failure("missing_document_version", "documentVersion must be a non-empty string.", sourceId));
  }
  if (typeof record.title !== "string" || clean(record.title).length === 0) {
    failures.push(failure("missing_title", "title must be a non-empty string.", sourceId));
  }
  if (typeof record.targetJurisdiction !== "string" || clean(record.targetJurisdiction).length === 0) {
    failures.push(failure("missing_target_jurisdiction", "targetJurisdiction must be explicit.", sourceId));
  }
  if (typeof record.sourceJurisdiction !== "string" || clean(record.sourceJurisdiction).length === 0) {
    failures.push(failure("missing_source_jurisdiction", "sourceJurisdiction must be explicit.", sourceId));
  }
  if (!STATES.includes(record.status)) {
    failures.push(failure("invalid_record", "status is unsupported.", sourceId));
  }
  if (record.publicUrl !== undefined && !isHttpUrl(record.publicUrl)) {
    failures.push(failure("invalid_public_url", "publicUrl must use HTTP or HTTPS.", sourceId));
  }

  const targetIsAntigua = typeof record.targetJurisdiction === "string" && isAntiguaJurisdiction(record.targetJurisdiction);
  const sourceIsAntigua = typeof record.sourceJurisdiction === "string" && isAntiguaJurisdiction(record.sourceJurisdiction);
  const municipality = record.municipality?.trim().toLowerCase();
  const sourceIsExternalMunicipality = Boolean(municipality && municipality !== "antigua guatemala" && municipality !== "antigua");

  if (record.authorityLevel === "primary" && (!sourceIsAntigua || !record.officialForTargetJurisdiction)) {
    failures.push(
      failure(
        "invalid_authority_combination",
        "Primary authority requires an official source for the target jurisdiction.",
        sourceId
      )
    );
  }

  if (targetIsAntigua && sourceIsExternalMunicipality) {
    if (
      record.authorityClass !== "external_reference" ||
      record.authorityLevel !== "comparative" ||
      record.officialForTargetJurisdiction
    ) {
      failures.push(
        failure(
          "external_municipality_must_be_comparative",
          "A source from another municipality must remain comparative for Antigua.",
          sourceId
        )
      );
    }
  }

  if (
    normalizeJurisdiction(record.sourceJurisdiction ?? "") === "unknown" &&
    (record.authorityLevel === "primary" || record.officialForTargetJurisdiction)
  ) {
    failures.push(
      failure(
        "unknown_jurisdiction_cannot_be_primary",
        "Unknown source jurisdiction cannot be promoted to primary authority.",
        sourceId
      )
    );
  }

  if (record.status === "missing_source" && (record.publicUrl || record.acquisition || record.extraction || record.indexing)) {
    failures.push(
      failure("missing_source_has_evidence", "missing_source cannot include URL or processing evidence.", sourceId)
    );
  }

  if (record.status === "verified" && (!isHttpUrl(record.publicUrl) || !record.verifiedAt?.trim())) {
    failures.push(
      failure("verified_requires_url_and_timestamp", "verified requires publicUrl and verifiedAt.", sourceId)
    );
  }

  if (record.status === "acquired" && !hasAcquisition(record)) {
    failures.push(
      failure("acquired_requires_acquisition_evidence", "acquired requires hash and artifact evidence.", sourceId)
    );
  }

  if (record.status === "ingestion_pending" && !hasAcquisition(record)) {
    failures.push(
      failure("ingestion_pending_requires_acquisition", "ingestion_pending requires acquisition evidence.", sourceId)
    );
  }

  if (record.status === "ingested" && (!hasAcquisition(record) || !hasExtraction(record) || !hasIndexing(record))) {
    failures.push(
      failure(
        "ingested_requires_full_evidence",
        "ingested requires acquisition, extraction, and indexing evidence.",
        sourceId
      )
    );
  }

  if (record.status === "failed" && !(record.failureCodes?.length)) {
    failures.push(failure("failed_requires_failure_code", "failed requires at least one failure code.", sourceId));
  }

  if (record.status === "superseded" && !record.supersededBySourceId?.trim()) {
    failures.push(
      failure("superseded_requires_replacement", "superseded requires supersededBySourceId.", sourceId)
    );
  }

  return { valid: failures.length === 0, failures };
};

export const validateSourceInventory = (records: unknown[]): SourceInventoryValidationResult => {
  const failures = records.flatMap((record) => validateSourceInventoryRecord(record).failures);
  const declaredVersions = new Map<string, SourceInventoryRecord>();

  for (const rawRecord of records) {
    if (!isObject(rawRecord)) continue;
    const record = rawRecord as unknown as SourceInventoryRecord;
    if (!record.sourceId || !record.documentVersion) continue;
    const key = `${record.sourceId}::${record.documentVersion}`;
    const existing = declaredVersions.get(key);
    if (!existing) {
      declaredVersions.set(key, record);
      continue;
    }

    const existingHash = existing.acquisition?.contentSha256;
    const currentHash = record.acquisition?.contentSha256;
    if (existingHash && currentHash && existingHash !== currentHash) {
      failures.push(
        failure(
          "conflicting_acquired_hash",
          `Conflicting acquired hash for ${record.sourceId} version ${record.documentVersion}.`,
          record.sourceId
        )
      );
    } else {
      failures.push(
        failure(
          "duplicate_declared_version",
          `Duplicate source/version: ${record.sourceId} ${record.documentVersion}.`,
          record.sourceId
        )
      );
    }
  }

  return { valid: failures.length === 0, failures };
};

export const toSourceAuthorityMetadata = (record: SourceInventoryRecord): SourceAuthorityMetadata => {
  const metadata: SourceAuthorityMetadata = {
    sourceInventoryId: record.sourceId,
    targetJurisdiction: record.targetJurisdiction,
    sourceJurisdiction: record.sourceJurisdiction,
    authorityClass: record.authorityClass,
    authorityLevel: record.authorityLevel,
    officialSource: record.officialSource,
    officialForTargetJurisdiction: record.officialForTargetJurisdiction,
    documentVersion: record.documentVersion,
    limitations: [...record.limitations],
  };
  if (record.municipality) metadata.sourceMunicipality = record.municipality;
  return metadata;
};

export const isAntiguaPrimaryAuthority = (metadata: SourceAuthorityMetadata | undefined): boolean =>
  Boolean(
    metadata &&
      metadata.authorityLevel === "primary" &&
      metadata.officialForTargetJurisdiction &&
      isAntiguaJurisdiction(metadata.targetJurisdiction) &&
      isAntiguaJurisdiction(metadata.sourceJurisdiction)
  );

export const sourceInventoryRecordToDomainMetadata = (record: SourceInventoryRecord): DomainDocumentMetadata => {
  const metadata: DomainDocumentMetadata = {
    domainPackId: "municipal-antigua",
    sourceAuthorityClass: record.authorityClass,
    documentType: record.category,
    jurisdiction: record.targetJurisdiction,
    organization: record.sourceJurisdiction,
    confidentiality: "public",
    tags: [
      `source_inventory:${record.sourceId}`,
      `authority_level:${record.authorityLevel}`,
      `official_source:${record.officialSource}`,
      `official_for_target:${record.officialForTargetJurisdiction}`,
      `source_jurisdiction:${normalizeJurisdiction(record.sourceJurisdiction)}`,
    ],
  };
  if (record.effectiveFrom) metadata.effectiveDate = record.effectiveFrom;
  if (record.effectiveTo) metadata.expirationDate = record.effectiveTo;
  return metadata;
};

export const summarizeSourceInventory = (records: SourceInventoryRecord[]): SourceInventorySummary => {
  const byStatus = Object.fromEntries(STATES.map((status) => [status, 0])) as Record<SourceInventoryState, number>;
  for (const record of records) byStatus[record.status] += 1;
  return {
    total: records.length,
    byStatus,
    acquired: records.filter((record) => hasAcquisition(record)).length,
    ingested: records.filter((record) => record.status === "ingested").length,
    comparative: records.filter((record) => record.authorityLevel === "comparative").length,
    missing: records.filter((record) => record.status === "missing_source").length,
  };
};
