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

const normalize = (value: string): string =>
  value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

const isAntigua = (value: string): boolean => {
  const normalized = normalize(value);
  return normalized === "antigua" || normalized.includes("antigua guatemala");
};

const isHttpUrl = (value: string | undefined): boolean => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const hasAcquisition = (record: SourceInventoryRecord): boolean => Boolean(
  record.acquisition?.acquiredAt.trim() &&
  record.acquisition.artifactPath.trim() &&
  /^[a-f0-9]{64}$/i.test(record.acquisition.contentSha256)
);

const hasExtraction = (record: SourceInventoryRecord): boolean => Boolean(
  record.extraction?.extractedAt.trim() &&
  record.extraction.extractor.trim() &&
  Number.isInteger(record.extraction.sectionCount) &&
  record.extraction.sectionCount > 0
);

const hasIndexing = (record: SourceInventoryRecord): boolean => Boolean(
  record.indexing?.indexedAt.trim() &&
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
  const item: SourceInventoryValidationFailure = { code, message };
  if (sourceId) item.sourceId = sourceId;
  return item;
};

export const validateSourceInventoryRecord = (value: unknown): SourceInventoryValidationResult => {
  if (!isObject(value)) {
    return { valid: false, failures: [failure("invalid_record", "Source inventory record must be an object.")] };
  }

  const record = value as unknown as SourceInventoryRecord;
  const failures: SourceInventoryValidationFailure[] = [];
  const sourceId = typeof record.sourceId === "string" ? record.sourceId : undefined;
  const required: Array<[unknown, SourceInventoryValidationCode, string]> = [
    [record.sourceId, "missing_source_id", "sourceId"],
    [record.documentKey, "missing_document_key", "documentKey"],
    [record.documentVersion, "missing_document_version", "documentVersion"],
    [record.title, "missing_title", "title"],
    [record.targetJurisdiction, "missing_target_jurisdiction", "targetJurisdiction"],
    [record.sourceJurisdiction, "missing_source_jurisdiction", "sourceJurisdiction"],
  ];

  for (const [valueToCheck, code, label] of required) {
    if (typeof valueToCheck !== "string" || !valueToCheck.trim()) {
      failures.push(failure(code, `${label} must be a non-empty string.`, sourceId));
    }
  }

  if (!STATES.includes(record.status)) failures.push(failure("invalid_record", "status is unsupported.", sourceId));
  if (record.publicUrl !== undefined && !isHttpUrl(record.publicUrl)) {
    failures.push(failure("invalid_public_url", "publicUrl must use HTTP or HTTPS.", sourceId));
  }

  const targetIsAntigua = typeof record.targetJurisdiction === "string" && isAntigua(record.targetJurisdiction);
  const sourceIsAntigua = typeof record.sourceJurisdiction === "string" && isAntigua(record.sourceJurisdiction);
  const municipality = record.municipality ? normalize(record.municipality) : "";
  const externalMunicipality = Boolean(municipality && municipality !== "antigua" && municipality !== "antigua guatemala");

  if (record.authorityLevel === "primary" && (!sourceIsAntigua || !record.officialForTargetJurisdiction)) {
    failures.push(failure("invalid_authority_combination", "Primary authority requires an official source for Antigua.", sourceId));
  }

  if (targetIsAntigua && externalMunicipality && (
    record.authorityClass !== "external_reference" ||
    record.authorityLevel !== "comparative" ||
    record.officialForTargetJurisdiction
  )) {
    failures.push(failure(
      "external_municipality_must_be_comparative",
      "A source from another municipality must remain comparative for Antigua.",
      sourceId
    ));
  }

  if (typeof record.sourceJurisdiction === "string" && normalize(record.sourceJurisdiction) === "unknown" && (
    record.authorityLevel === "primary" || record.officialForTargetJurisdiction
  )) {
    failures.push(failure("unknown_jurisdiction_cannot_be_primary", "Unknown jurisdiction cannot be primary.", sourceId));
  }

  if (record.status === "missing_source" && (record.publicUrl || record.acquisition || record.extraction || record.indexing)) {
    failures.push(failure("missing_source_has_evidence", "missing_source cannot include URL or processing evidence.", sourceId));
  }
  if (record.status === "verified" && (!isHttpUrl(record.publicUrl) || !record.verifiedAt?.trim())) {
    failures.push(failure("verified_requires_url_and_timestamp", "verified requires publicUrl and verifiedAt.", sourceId));
  }
  if (record.status === "acquired" && !hasAcquisition(record)) {
    failures.push(failure("acquired_requires_acquisition_evidence", "acquired requires artifact and hash evidence.", sourceId));
  }
  if (record.status === "ingestion_pending" && !hasAcquisition(record)) {
    failures.push(failure("ingestion_pending_requires_acquisition", "ingestion_pending requires acquisition evidence.", sourceId));
  }
  if (record.status === "ingested" && (!hasAcquisition(record) || !hasExtraction(record) || !hasIndexing(record))) {
    failures.push(failure("ingested_requires_full_evidence", "ingested requires acquisition, extraction, and indexing evidence.", sourceId));
  }
  if (record.status === "failed" && !record.failureCodes?.length) {
    failures.push(failure("failed_requires_failure_code", "failed requires at least one failure code.", sourceId));
  }
  if (record.status === "superseded" && !record.supersededBySourceId?.trim()) {
    failures.push(failure("superseded_requires_replacement", "superseded requires supersededBySourceId.", sourceId));
  }

  return { valid: failures.length === 0, failures };
};

export const validateSourceInventory = (records: unknown[]): SourceInventoryValidationResult => {
  const failures = records.flatMap((record) => validateSourceInventoryRecord(record).failures);
  const versions = new Map<string, SourceInventoryRecord>();

  for (const value of records) {
    if (!isObject(value)) continue;
    const record = value as unknown as SourceInventoryRecord;
    if (!record.sourceId || !record.documentVersion) continue;
    const key = `${record.sourceId}::${record.documentVersion}`;
    const existing = versions.get(key);
    if (!existing) {
      versions.set(key, record);
      continue;
    }
    const leftHash = existing.acquisition?.contentSha256;
    const rightHash = record.acquisition?.contentSha256;
    failures.push(failure(
      leftHash && rightHash && leftHash !== rightHash ? "conflicting_acquired_hash" : "duplicate_declared_version",
      `Duplicate or conflicting source/version: ${record.sourceId} ${record.documentVersion}.`,
      record.sourceId
    ));
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

export const isAntiguaPrimaryAuthority = (metadata: SourceAuthorityMetadata | undefined): boolean => Boolean(
  metadata &&
  metadata.authorityLevel === "primary" &&
  metadata.officialForTargetJurisdiction &&
  isAntigua(metadata.targetJurisdiction) &&
  isAntigua(metadata.sourceJurisdiction)
);

export const sourceInventoryAuthorityToDomainClass = (record: SourceInventoryRecord): string => {
  if (record.authorityClass === "external_reference") return "external_reference";
  if (record.authorityClass === "unknown") return "unknown";
  if (record.authorityClass === "contextual") return "community_file";
  if (record.authorityClass === "official_national") {
    return normalize(record.title).includes("codigo municipal") ? "municipal_code" : "national_law";
  }

  if (record.category === "planning") {
    const title = normalize(record.title);
    return title.includes("poa") || title.includes("pom") ? "pom_poa" : "pdm_ot";
  }
  if (record.category === "budget") return "budget";
  if (record.category === "organization") return "organigram";
  if (record.category === "function_manual") return "mof";
  if (record.category === "council_record") return "council_minutes";
  if (record.category === "community_record") return "community_file";
  return "municipal_manual";
};

export const sourceInventoryRecordToDomainMetadata = (record: SourceInventoryRecord): DomainDocumentMetadata => {
  const metadata: DomainDocumentMetadata = {
    domainPackId: "municipal-antigua",
    sourceAuthorityClass: sourceInventoryAuthorityToDomainClass(record),
    documentType: record.category,
    jurisdiction: record.targetJurisdiction,
    organization: record.sourceJurisdiction,
    confidentiality: "public",
    tags: [
      `source_inventory:${record.sourceId}`,
      `inventory_authority:${record.authorityClass}`,
      `authority_level:${record.authorityLevel}`,
      `official_source:${record.officialSource}`,
      `official_for_target:${record.officialForTargetJurisdiction}`,
      `source_jurisdiction:${normalize(record.sourceJurisdiction)}`,
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
    acquired: records.filter(hasAcquisition).length,
    ingested: records.filter((record) => record.status === "ingested").length,
    comparative: records.filter((record) => record.authorityLevel === "comparative").length,
    missing: records.filter((record) => record.status === "missing_source").length,
  };
};
