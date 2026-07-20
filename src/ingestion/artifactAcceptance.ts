import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { isCanonicalUuid, withTenantTransaction } from "../security/index.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";
import {
  ArtifactSafetyError,
  inspectArtifactContent,
  loadArtifactSafetyPolicy,
  type ArtifactSafetyPolicy,
  type MalwareScanner,
} from "../sources/artifactSafety.js";
import { scanVerifiedArtifactSnapshot } from "../sources/scanVerifiedArtifact.js";
import {
  ArtifactObjectStoreError,
  assertArtifactObjectReference,
  readBoundedImmutableObject,
  type ArtifactObjectReader,
  type ArtifactObjectReference,
} from "./artifactObjectStore.js";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$/;
const SAFE_FAILURE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SAFE_TEXT_PATTERN = /^[^\x00-\x1f\x7f]{1,256}$/;
const SAFE_FILENAME_PATTERN = /^[^/\\\x00-\x1f\x7f]{1,255}$/;
const SUPPORTED_MEDIA_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);
const DEFAULT_OBJECT_READ_TIMEOUT_MS = 120_000;

const SELECT_DOCUMENT_SQL = `
  SELECT version.content_sha256
  FROM rag.document_versions AS version
  JOIN rag.documents AS document
    ON document.id = version.document_id
   AND document.tenant_id = version.tenant_id
  WHERE version.id = $1::uuid
    AND version.tenant_id = $2::uuid
    AND document.status = 'active'
  FOR SHARE OF version;
`;

const INSERT_OBJECT_SQL = `
  INSERT INTO rag.artifact_objects (
    id,
    tenant_id,
    document_version_id,
    registered_by_principal_id,
    store_name,
    object_namespace,
    object_key,
    object_version,
    original_filename,
    declared_media_type,
    expected_sha256,
    inspection_generation,
    status
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4::uuid,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    decode($11, 'hex'),
    1,
    'scanning'
  )
  ON CONFLICT (tenant_id, store_name, object_namespace, object_key, object_version)
  DO NOTHING
  RETURNING id, inspection_generation;
`;

const LOCK_OBJECT_BY_REFERENCE_SQL = `
  SELECT
    id,
    document_version_id,
    registered_by_principal_id,
    original_filename,
    declared_media_type,
    encode(expected_sha256, 'hex') AS expected_sha256,
    inspection_generation
  FROM rag.artifact_objects
  WHERE tenant_id = $1::uuid
    AND store_name = $2
    AND object_namespace = $3
    AND object_key = $4
    AND object_version = $5
  FOR UPDATE;
`;

const RESTART_INSPECTION_SQL = `
  UPDATE rag.artifact_objects
  SET
    registered_by_principal_id = $3::uuid,
    inspection_generation = inspection_generation + 1,
    status = 'scanning',
    accepted_scan_id = NULL,
    accepted_until = NULL,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND inspection_generation < 2147483647
  RETURNING id, inspection_generation;
`;

const LOCK_OBJECT_FOR_COMPLETION_SQL = `
  SELECT
    id,
    document_version_id,
    encode(expected_sha256, 'hex') AS expected_sha256,
    inspection_generation,
    status
  FROM rag.artifact_objects
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
  FOR UPDATE;
`;

const INSERT_SCAN_SQL = `
  INSERT INTO rag.artifact_scans (
    id,
    tenant_id,
    artifact_object_id,
    inspection_generation,
    inspected_by_principal_id,
    verdict,
    content_sha256,
    byte_length,
    detected_media_type,
    structural_signature,
    inspected_at,
    scanner_engine,
    scanner_engine_version,
    scanner_definitions_version,
    malware_signature,
    failure_code
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4,
    $5::uuid,
    $6,
    CASE WHEN $7::text IS NULL THEN NULL ELSE decode($7, 'hex') END,
    $8,
    $9,
    $10,
    $11::timestamptz,
    $12,
    $13,
    $14,
    $15,
    $16
  )
  RETURNING id;
`;

const SUPERSEDE_OTHER_OBJECTS_SQL = `
  UPDATE rag.artifact_objects
  SET
    status = 'superseded',
    accepted_scan_id = NULL,
    accepted_until = NULL,
    updated_at = statement_timestamp()
  WHERE tenant_id = $1::uuid
    AND document_version_id = $2::uuid
    AND id <> $3::uuid
    AND status = 'accepted';
`;

const COMPLETE_OBJECT_SQL = `
  UPDATE rag.artifact_objects
  SET
    status = $4,
    accepted_scan_id = $5::uuid,
    accepted_until = $6::timestamptz,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND inspection_generation = $3
    AND status = 'scanning'
  RETURNING id;
`;

const SELECT_ACCEPTED_BINDING_SQL = `
  SELECT
    object.id AS artifact_object_id,
    scan.id AS artifact_scan_id,
    object.store_name,
    object.object_namespace,
    object.object_key,
    object.object_version,
    object.original_filename,
    object.declared_media_type,
    encode(object.expected_sha256, 'hex') AS expected_sha256,
    scan.byte_length,
    scan.detected_media_type,
    scan.structural_signature,
    scan.inspected_at,
    scan.scanner_engine,
    scan.scanner_engine_version,
    scan.scanner_definitions_version
  FROM rag.artifact_objects AS object
  JOIN rag.artifact_scans AS scan
    ON scan.id = object.accepted_scan_id
   AND scan.tenant_id = object.tenant_id
   AND scan.artifact_object_id = object.id
  WHERE object.id = $1::uuid
    AND object.tenant_id = $2::uuid
    AND object.document_version_id = $3::uuid
    AND object.expected_sha256 = decode($4, 'hex')
    AND scan.id = $5::uuid
    AND object.status = 'accepted'
    AND object.accepted_until > statement_timestamp()
    AND scan.verdict = 'clean';
`;

const INSERT_AUDIT_SQL = `
  INSERT INTO audit.events (
    id,
    tenant_id,
    actor_external_id,
    event_type,
    entity_schema,
    entity_table,
    entity_id,
    outcome,
    details
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3,
    $4,
    'rag',
    'artifact_objects',
    $5::uuid,
    $6,
    $7::jsonb
  );
`;

const rowsFrom = (result: unknown): Array<Record<string, unknown>> => {
  if (!result || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows as Array<Record<string, unknown>> : [];
};

const normalizeMediaType = (value: string): string =>
  value.split(";", 1)[0]?.trim().toLowerCase() ?? "";

const sha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

const safeOptionalText = (value: string | undefined): string | null =>
  value && SAFE_TEXT_PATTERN.test(value) ? value : null;

export class ArtifactAcceptanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "ArtifactAcceptanceError";
  }
}

export interface BeginArtifactInspectionInput {
  tenantId: string;
  principalId: string;
  documentVersionId: string;
  artifactSha256: string;
  originalFilename: string;
  mediaType: string;
  object: ArtifactObjectReference;
}

export interface ArtifactInspection {
  artifactObjectId: string;
  tenantId: string;
  principalId: string;
  documentVersionId: string;
  artifactSha256: string;
  originalFilename: string;
  mediaType: string;
  object: ArtifactObjectReference;
  inspectionGeneration: number;
}

export type ArtifactInspectionVerdict = "clean" | "infected" | "rejected" | "error";

export interface ArtifactInspectionOutcome {
  verdict: ArtifactInspectionVerdict;
  contentSha256?: string;
  byteLength?: number;
  detectedMediaType?: string;
  structuralSignature?: string;
  inspectedAt: string;
  scannerEngine: string;
  scannerEngineVersion: string;
  scannerDefinitionsVersion?: string;
  malwareSignature?: string;
  failureCode?: string;
  acceptedUntil?: string;
}

export interface CompleteArtifactInspectionInput {
  inspection: ArtifactInspection;
  outcome: ArtifactInspectionOutcome;
}

export interface ArtifactAcceptanceRecord {
  artifactObjectId: string;
  artifactScanId: string;
  documentVersionId: string;
  status: "accepted" | "rejected";
  verdict: ArtifactInspectionVerdict;
  failureCode: string | null;
  acceptedUntil: string | null;
}

export interface AcceptedArtifactBindingRequest {
  tenantId: string;
  documentVersionId: string;
  artifactSha256: string;
  artifactObjectId: string;
  artifactScanId: string;
}

export interface PersistedAcceptedArtifactBinding {
  artifactObjectId: string;
  artifactScanId: string;
  object: ArtifactObjectReference;
  originalFilename: string;
  mediaType: string;
  artifactSha256: string;
  safety: {
    verdict: "clean";
    contentSha256: string;
    byteLength: number;
    detectedMediaType: string;
    structuralSignature: string;
    inspectedAt: string;
    scannerEngine: string;
    scannerEngineVersion: string;
    scannerDefinitionsVersion: string;
  };
}

export interface ArtifactAcceptanceRepository {
  beginInspection(input: BeginArtifactInspectionInput): Promise<ArtifactInspection>;
  completeInspection(input: CompleteArtifactInspectionInput): Promise<ArtifactAcceptanceRecord>;
  getAcceptedBinding(input: AcceptedArtifactBindingRequest): Promise<PersistedAcceptedArtifactBinding | null>;
}

const validateBeginInput = (input: BeginArtifactInspectionInput): BeginArtifactInspectionInput => {
  if (
    !isCanonicalUuid(input.tenantId) ||
    !isCanonicalUuid(input.principalId) ||
    !isCanonicalUuid(input.documentVersionId) ||
    !SHA256_HEX_PATTERN.test(input.artifactSha256) ||
    !SAFE_FILENAME_PATTERN.test(input.originalFilename) ||
    basename(input.originalFilename) !== input.originalFilename
  ) {
    throw new ArtifactAcceptanceError("artifact_acceptance_input_invalid", "Artifact acceptance input is invalid.");
  }
  const mediaType = normalizeMediaType(input.mediaType);
  if (!SUPPORTED_MEDIA_TYPES.has(mediaType)) {
    throw new ArtifactAcceptanceError("artifact_acceptance_input_invalid", "Artifact media type is unsupported.");
  }
  let object: ArtifactObjectReference;
  try {
    object = assertArtifactObjectReference(input.object);
  } catch (error) {
    throw new ArtifactAcceptanceError(
      "artifact_acceptance_input_invalid",
      "Artifact object reference is invalid.",
      false,
      { cause: error }
    );
  }
  return {
    ...input,
    tenantId: input.tenantId.toLowerCase(),
    principalId: input.principalId.toLowerCase(),
    documentVersionId: input.documentVersionId.toLowerCase(),
    mediaType,
    object,
  };
};

const validateOutcome = (
  inspection: ArtifactInspection,
  outcome: ArtifactInspectionOutcome
): void => {
  const inspectedAtMs = Date.parse(outcome.inspectedAt);
  const acceptedUntilMs = outcome.acceptedUntil ? Date.parse(outcome.acceptedUntil) : NaN;
  if (
    !["clean", "infected", "rejected", "error"].includes(outcome.verdict) ||
    !Number.isFinite(inspectedAtMs) ||
    !SAFE_COMPONENT_PATTERN.test(outcome.scannerEngine) ||
    !SAFE_COMPONENT_PATTERN.test(outcome.scannerEngineVersion) ||
    (outcome.contentSha256 !== undefined && !SHA256_HEX_PATTERN.test(outcome.contentSha256)) ||
    (outcome.byteLength !== undefined && (!Number.isSafeInteger(outcome.byteLength) || outcome.byteLength < 1 || outcome.byteLength > 1024 * 1024 * 1024)) ||
    (outcome.detectedMediaType !== undefined && !SAFE_TEXT_PATTERN.test(outcome.detectedMediaType)) ||
    (outcome.structuralSignature !== undefined && !SAFE_COMPONENT_PATTERN.test(outcome.structuralSignature)) ||
    (outcome.scannerDefinitionsVersion !== undefined && !SAFE_COMPONENT_PATTERN.test(outcome.scannerDefinitionsVersion)) ||
    (outcome.malwareSignature !== undefined && !SAFE_TEXT_PATTERN.test(outcome.malwareSignature)) ||
    (outcome.failureCode !== undefined && !SAFE_FAILURE_CODE_PATTERN.test(outcome.failureCode))
  ) {
    throw new ArtifactAcceptanceError("artifact_scan_outcome_invalid", "Artifact scan outcome is invalid.");
  }
  if (outcome.verdict === "clean") {
    if (
      outcome.contentSha256 !== inspection.artifactSha256 ||
      outcome.byteLength === undefined ||
      !outcome.detectedMediaType ||
      !outcome.structuralSignature ||
      !outcome.scannerDefinitionsVersion ||
      outcome.failureCode !== undefined ||
      outcome.malwareSignature !== undefined ||
      !Number.isFinite(acceptedUntilMs) ||
      acceptedUntilMs <= inspectedAtMs
    ) {
      throw new ArtifactAcceptanceError("artifact_scan_outcome_invalid", "Clean artifact evidence is incomplete.");
    }
  } else if (!outcome.failureCode || outcome.acceptedUntil !== undefined) {
    throw new ArtifactAcceptanceError("artifact_scan_outcome_invalid", "Rejected artifact evidence is incomplete.");
  }
  if (outcome.verdict === "infected" && (
    outcome.contentSha256 !== inspection.artifactSha256 ||
    outcome.byteLength === undefined ||
    !outcome.detectedMediaType ||
    !outcome.structuralSignature ||
    !outcome.scannerDefinitionsVersion ||
    !outcome.malwareSignature ||
    outcome.failureCode !== "malware_detected"
  )) {
    throw new ArtifactAcceptanceError("artifact_scan_outcome_invalid", "Infected artifact evidence is incomplete.");
  }
};

export interface PostgresArtifactAcceptanceRepositoryOptions {
  uuid?: () => string;
}

export class PostgresArtifactAcceptanceRepository implements ArtifactAcceptanceRepository {
  private readonly uuid: () => string;

  constructor(
    private readonly pool: TenantTransactionPool,
    options: PostgresArtifactAcceptanceRepositoryOptions = {}
  ) {
    this.uuid = options.uuid ?? randomUUID;
  }

  private async audit(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      artifactObjectId: string;
      eventType: string;
      outcome: "success" | "error" | "blocked";
      details: Record<string, string | number | boolean>;
    }
  ): Promise<void> {
    const serialized = JSON.stringify(input.details);
    if (Buffer.byteLength(serialized, "utf8") > 8_192) {
      throw new ArtifactAcceptanceError("artifact_acceptance_audit_invalid", "Artifact audit details exceed policy.");
    }
    await client.query(INSERT_AUDIT_SQL, [
      this.uuid(),
      input.tenantId,
      input.principalId,
      input.eventType,
      input.artifactObjectId,
      input.outcome,
      serialized,
    ]);
  }

  async beginInspection(rawInput: BeginArtifactInspectionInput): Promise<ArtifactInspection> {
    const input = validateBeginInput(rawInput);
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const versions = rowsFrom(await client.query(SELECT_DOCUMENT_SQL, [
        input.documentVersionId,
        input.tenantId,
      ]));
      if (versions.length !== 1 || versions[0]?.content_sha256 !== input.artifactSha256) {
        throw new ArtifactAcceptanceError(
          "artifact_document_identity_mismatch",
          "Document version is unavailable or does not match the artifact digest."
        );
      }

      const inserted = rowsFrom(await client.query(INSERT_OBJECT_SQL, [
        this.uuid(),
        input.tenantId,
        input.documentVersionId,
        input.principalId,
        input.object.storeName,
        input.object.objectNamespace,
        input.object.objectKey,
        input.object.objectVersion,
        input.originalFilename,
        input.mediaType,
        input.artifactSha256,
      ]));
      let artifactObjectId: string;
      let inspectionGeneration: number;
      if (inserted.length === 1) {
        artifactObjectId = String(inserted[0]?.id);
        inspectionGeneration = Number(inserted[0]?.inspection_generation);
      } else if (inserted.length === 0) {
        const existing = rowsFrom(await client.query(LOCK_OBJECT_BY_REFERENCE_SQL, [
          input.tenantId,
          input.object.storeName,
          input.object.objectNamespace,
          input.object.objectKey,
          input.object.objectVersion,
        ]));
        const row = existing[0];
        if (
          existing.length !== 1 ||
          row?.document_version_id !== input.documentVersionId ||
          row?.original_filename !== input.originalFilename ||
          row?.declared_media_type !== input.mediaType ||
          row?.expected_sha256 !== input.artifactSha256
        ) {
          throw new ArtifactAcceptanceError(
            "artifact_object_reference_conflict",
            "Immutable object coordinates are already bound to different artifact metadata."
          );
        }
        const restarted = rowsFrom(await client.query(RESTART_INSPECTION_SQL, [
          row.id,
          input.tenantId,
          input.principalId,
        ]));
        if (restarted.length !== 1) {
          throw new ArtifactAcceptanceError(
            "artifact_inspection_generation_exhausted",
            "Artifact inspection generation cannot advance."
          );
        }
        artifactObjectId = String(restarted[0]?.id);
        inspectionGeneration = Number(restarted[0]?.inspection_generation);
      } else {
        throw new ArtifactAcceptanceError("artifact_acceptance_persistence_invalid", "Artifact insert returned multiple rows.");
      }
      if (!isCanonicalUuid(artifactObjectId) || !Number.isSafeInteger(inspectionGeneration)) {
        throw new ArtifactAcceptanceError("artifact_acceptance_persistence_invalid", "Stored artifact inspection is invalid.");
      }
      await this.audit(client, {
        tenantId: input.tenantId,
        principalId: input.principalId,
        artifactObjectId,
        eventType: "rag.artifact.inspection_started",
        outcome: "success",
        details: {
          document_version_id: input.documentVersionId,
          inspection_generation: inspectionGeneration,
        },
      });
      return {
        artifactObjectId,
        tenantId: input.tenantId,
        principalId: input.principalId,
        documentVersionId: input.documentVersionId,
        artifactSha256: input.artifactSha256,
        originalFilename: input.originalFilename,
        mediaType: input.mediaType,
        object: input.object,
        inspectionGeneration,
      };
    });
  }

  async completeInspection(input: CompleteArtifactInspectionInput): Promise<ArtifactAcceptanceRecord> {
    const { inspection, outcome } = input;
    if (
      !isCanonicalUuid(inspection.artifactObjectId) ||
      !isCanonicalUuid(inspection.tenantId) ||
      !isCanonicalUuid(inspection.principalId) ||
      !isCanonicalUuid(inspection.documentVersionId) ||
      !Number.isSafeInteger(inspection.inspectionGeneration)
    ) {
      throw new ArtifactAcceptanceError("artifact_inspection_invalid", "Artifact inspection identity is invalid.");
    }
    validateOutcome(inspection, outcome);
    return withTenantTransaction(this.pool, inspection.tenantId, async (client) => {
      const objects = rowsFrom(await client.query(LOCK_OBJECT_FOR_COMPLETION_SQL, [
        inspection.artifactObjectId,
        inspection.tenantId,
      ]));
      const object = objects[0];
      if (
        objects.length !== 1 ||
        object?.document_version_id !== inspection.documentVersionId ||
        object?.expected_sha256 !== inspection.artifactSha256 ||
        object?.status !== "scanning" ||
        object?.inspection_generation !== inspection.inspectionGeneration
      ) {
        throw new ArtifactAcceptanceError(
          "artifact_inspection_stale",
          "Artifact inspection was superseded before its result could be committed.",
          true
        );
      }

      const scanId = this.uuid();
      const scans = rowsFrom(await client.query(INSERT_SCAN_SQL, [
        scanId,
        inspection.tenantId,
        inspection.artifactObjectId,
        inspection.inspectionGeneration,
        inspection.principalId,
        outcome.verdict,
        outcome.contentSha256 ?? null,
        outcome.byteLength ?? null,
        outcome.detectedMediaType ?? null,
        outcome.structuralSignature ?? null,
        outcome.inspectedAt,
        outcome.scannerEngine,
        outcome.scannerEngineVersion,
        outcome.scannerDefinitionsVersion ?? null,
        outcome.malwareSignature ?? null,
        outcome.failureCode ?? null,
      ]));
      if (scans.length !== 1 || scans[0]?.id !== scanId) {
        throw new ArtifactAcceptanceError("artifact_acceptance_persistence_invalid", "Artifact scan insert failed.");
      }

      const accepted = outcome.verdict === "clean";
      if (accepted) {
        await client.query(SUPERSEDE_OTHER_OBJECTS_SQL, [
          inspection.tenantId,
          inspection.documentVersionId,
          inspection.artifactObjectId,
        ]);
      }
      const completed = rowsFrom(await client.query(COMPLETE_OBJECT_SQL, [
        inspection.artifactObjectId,
        inspection.tenantId,
        inspection.inspectionGeneration,
        accepted ? "accepted" : "rejected",
        accepted ? scanId : null,
        accepted ? outcome.acceptedUntil : null,
      ]));
      if (completed.length !== 1) {
        throw new ArtifactAcceptanceError(
          "artifact_inspection_stale",
          "Artifact inspection was superseded before its result could be committed.",
          true
        );
      }
      await this.audit(client, {
        tenantId: inspection.tenantId,
        principalId: inspection.principalId,
        artifactObjectId: inspection.artifactObjectId,
        eventType: accepted ? "rag.artifact.accepted" : "rag.artifact.rejected",
        outcome: accepted ? "success" : outcome.verdict === "infected" ? "blocked" : "error",
        details: {
          document_version_id: inspection.documentVersionId,
          inspection_generation: inspection.inspectionGeneration,
          verdict: outcome.verdict,
          ...(outcome.failureCode ? { failure_code: outcome.failureCode } : {}),
        },
      });
      return {
        artifactObjectId: inspection.artifactObjectId,
        artifactScanId: scanId,
        documentVersionId: inspection.documentVersionId,
        status: accepted ? "accepted" : "rejected",
        verdict: outcome.verdict,
        failureCode: outcome.failureCode ?? null,
        acceptedUntil: accepted ? outcome.acceptedUntil! : null,
      };
    });
  }

  async getAcceptedBinding(input: AcceptedArtifactBindingRequest): Promise<PersistedAcceptedArtifactBinding | null> {
    if (
      !isCanonicalUuid(input.tenantId) ||
      !isCanonicalUuid(input.documentVersionId) ||
      !isCanonicalUuid(input.artifactObjectId) ||
      !isCanonicalUuid(input.artifactScanId) ||
      !SHA256_HEX_PATTERN.test(input.artifactSha256)
    ) {
      throw new ArtifactAcceptanceError("artifact_binding_scope_invalid", "Accepted artifact binding scope is invalid.");
    }
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const rows = rowsFrom(await client.query(SELECT_ACCEPTED_BINDING_SQL, [
        input.artifactObjectId,
        input.tenantId.toLowerCase(),
        input.documentVersionId.toLowerCase(),
        input.artifactSha256,
        input.artifactScanId,
      ]));
      if (rows.length === 0) return null;
      if (rows.length !== 1) {
        throw new ArtifactAcceptanceError("artifact_acceptance_persistence_invalid", "Accepted artifact lookup returned multiple rows.");
      }
      const row = rows[0]!;
      const byteLength = Number(row.byte_length);
      const inspectedAt = row.inspected_at instanceof Date
        ? row.inspected_at.toISOString()
        : String(row.inspected_at);
      const reference = {
        storeName: String(row.store_name),
        objectNamespace: String(row.object_namespace),
        objectKey: String(row.object_key),
        objectVersion: String(row.object_version),
      };
      try {
        assertArtifactObjectReference(reference);
      } catch (cause) {
        throw new ArtifactAcceptanceError(
          "artifact_acceptance_persistence_invalid",
          "Stored artifact object reference is invalid.",
          false,
          { cause }
        );
      }
      if (
        !Number.isSafeInteger(byteLength) ||
        byteLength < 1 ||
        row.expected_sha256 !== input.artifactSha256 ||
        !SAFE_FILENAME_PATTERN.test(String(row.original_filename)) ||
        !SUPPORTED_MEDIA_TYPES.has(String(row.declared_media_type)) ||
        !SAFE_TEXT_PATTERN.test(String(row.detected_media_type)) ||
        !SAFE_COMPONENT_PATTERN.test(String(row.structural_signature)) ||
        !SAFE_COMPONENT_PATTERN.test(String(row.scanner_engine)) ||
        !SAFE_COMPONENT_PATTERN.test(String(row.scanner_engine_version)) ||
        !SAFE_COMPONENT_PATTERN.test(String(row.scanner_definitions_version)) ||
        !Number.isFinite(Date.parse(inspectedAt))
      ) {
        throw new ArtifactAcceptanceError("artifact_acceptance_persistence_invalid", "Stored artifact evidence is invalid.");
      }
      return {
        artifactObjectId: input.artifactObjectId.toLowerCase(),
        artifactScanId: input.artifactScanId.toLowerCase(),
        object: reference,
        originalFilename: String(row.original_filename),
        mediaType: String(row.declared_media_type),
        artifactSha256: input.artifactSha256,
        safety: {
          verdict: "clean",
          contentSha256: input.artifactSha256,
          byteLength,
          detectedMediaType: String(row.detected_media_type),
          structuralSignature: String(row.structural_signature),
          inspectedAt,
          scannerEngine: String(row.scanner_engine),
          scannerEngineVersion: String(row.scanner_engine_version),
          scannerDefinitionsVersion: String(row.scanner_definitions_version),
        },
      };
    });
  }
}

export interface ArtifactAcceptanceServiceOptions {
  now?: () => Date;
  policy?: ArtifactSafetyPolicy;
  env?: NodeJS.ProcessEnv;
  objectReadTimeoutMs?: number;
}

export class ArtifactAcceptanceService {
  private readonly policy: ArtifactSafetyPolicy;
  private readonly objectReadTimeoutMs: number;
  private readonly now: () => Date;

  constructor(
    private readonly repository: ArtifactAcceptanceRepository,
    private readonly objectReader: ArtifactObjectReader,
    private readonly scanner: MalwareScanner,
    options: ArtifactAcceptanceServiceOptions = {}
  ) {
    this.policy = options.policy ?? loadArtifactSafetyPolicy(options.env);
    this.objectReadTimeoutMs = options.objectReadTimeoutMs ?? DEFAULT_OBJECT_READ_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
    if (
      !Number.isSafeInteger(this.policy.maxArtifactBytes) ||
      this.policy.maxArtifactBytes < 1 ||
      this.policy.maxArtifactBytes > 1024 * 1024 * 1024 ||
      !Number.isSafeInteger(this.policy.malwareScanMaxAgeMs) ||
      this.policy.malwareScanMaxAgeMs < 1 ||
      this.policy.malwareScanMaxAgeMs > 7 * 24 * 60 * 60 * 1000 ||
      !Number.isSafeInteger(this.policy.malwareScanTimeoutMs) ||
      this.policy.malwareScanTimeoutMs < 1_000 ||
      this.policy.malwareScanTimeoutMs > 10 * 60 * 1000
    ) {
      throw new ArtifactAcceptanceError(
        "artifact_acceptance_policy_invalid",
        "Artifact acceptance policy is invalid."
      );
    }
  }

  async inspect(input: BeginArtifactInspectionInput): Promise<ArtifactAcceptanceRecord> {
    const inspection = await this.repository.beginInspection(input);
    let outcome: ArtifactInspectionOutcome;
    try {
      const content = await readBoundedImmutableObject(this.objectReader, inspection.object, {
        maxBytes: this.policy.maxArtifactBytes,
        timeoutMs: this.objectReadTimeoutMs,
      });
      const contentSha256 = sha256(content);
      let structural: ReturnType<typeof inspectArtifactContent>;
      try {
        structural = inspectArtifactContent({
          content,
          sourcePath: inspection.originalFilename,
          declaredMediaType: inspection.mediaType,
          maxArtifactBytes: this.policy.maxArtifactBytes,
        });
      } catch (error) {
        const code = error instanceof ArtifactSafetyError
          ? error.code
          : "artifact_structural_verification_failed";
        outcome = {
          verdict: "rejected",
          contentSha256,
          byteLength: content.byteLength,
          inspectedAt: this.now().toISOString(),
          scannerEngine: "not_run",
          scannerEngineVersion: "not_available",
          failureCode: SAFE_FAILURE_CODE_PATTERN.test(code) ? code : "artifact_structural_verification_failed",
        };
        return this.repository.completeInspection({ inspection, outcome });
      }
      if (contentSha256 !== inspection.artifactSha256) {
        outcome = {
          verdict: "rejected",
          contentSha256,
          byteLength: content.byteLength,
          detectedMediaType: structural.detectedMediaType,
          structuralSignature: structural.signature,
          inspectedAt: this.now().toISOString(),
          scannerEngine: "not_run",
          scannerEngineVersion: "not_available",
          failureCode: "artifact_content_hash_mismatch",
        };
        return this.repository.completeInspection({ inspection, outcome });
      }

      let scan;
      try {
        scan = await scanVerifiedArtifactSnapshot(content, inspection.originalFilename, this.scanner);
      } catch (error) {
        const code = error instanceof ArtifactSafetyError && SAFE_FAILURE_CODE_PATTERN.test(error.code)
          ? error.code
          : "malware_scan_error";
        outcome = {
          verdict: "error",
          contentSha256,
          byteLength: content.byteLength,
          detectedMediaType: structural.detectedMediaType,
          structuralSignature: structural.signature,
          inspectedAt: this.now().toISOString(),
          scannerEngine: "scanner_adapter",
          scannerEngineVersion: "unavailable",
          failureCode: code,
        };
        return this.repository.completeInspection({ inspection, outcome });
      }
      const inspectedAt = this.now();
      if (
        scan.verdict === "clean" &&
        scan.definitionsVersion &&
        SAFE_COMPONENT_PATTERN.test(scan.engine) &&
        SAFE_COMPONENT_PATTERN.test(scan.engineVersion) &&
        SAFE_COMPONENT_PATTERN.test(scan.definitionsVersion)
      ) {
        outcome = {
          verdict: "clean",
          contentSha256,
          byteLength: content.byteLength,
          detectedMediaType: structural.detectedMediaType,
          structuralSignature: structural.signature,
          inspectedAt: inspectedAt.toISOString(),
          scannerEngine: scan.engine,
          scannerEngineVersion: scan.engineVersion,
          scannerDefinitionsVersion: scan.definitionsVersion,
          acceptedUntil: new Date(inspectedAt.getTime() + this.policy.malwareScanMaxAgeMs).toISOString(),
        };
      } else if (scan.verdict === "infected") {
        outcome = {
          verdict: "infected",
          contentSha256,
          byteLength: content.byteLength,
          detectedMediaType: structural.detectedMediaType,
          structuralSignature: structural.signature,
          inspectedAt: inspectedAt.toISOString(),
          scannerEngine: scan.engine,
          scannerEngineVersion: scan.engineVersion,
          scannerDefinitionsVersion: scan.definitionsVersion ?? "unavailable",
          malwareSignature: safeOptionalText(scan.signature) ?? "clamav-detection",
          failureCode: "malware_detected",
        };
      } else {
        outcome = {
          verdict: "error",
          contentSha256,
          byteLength: content.byteLength,
          detectedMediaType: structural.detectedMediaType,
          structuralSignature: structural.signature,
          inspectedAt: inspectedAt.toISOString(),
          scannerEngine: SAFE_COMPONENT_PATTERN.test(scan.engine) ? scan.engine : "scanner_adapter",
          scannerEngineVersion: SAFE_COMPONENT_PATTERN.test(scan.engineVersion) ? scan.engineVersion : "unavailable",
          ...(scan.definitionsVersion && SAFE_COMPONENT_PATTERN.test(scan.definitionsVersion)
            ? { scannerDefinitionsVersion: scan.definitionsVersion }
            : {}),
          failureCode: scan.verdict === "clean"
            ? "malware_definitions_unavailable"
            : SAFE_FAILURE_CODE_PATTERN.test(scan.failureCode ?? "")
              ? scan.failureCode
              : "malware_scan_error",
        };
      }
    } catch (error) {
      const objectError = error instanceof ArtifactObjectStoreError ? error : null;
      outcome = {
        verdict: "error",
        inspectedAt: this.now().toISOString(),
        scannerEngine: "object_store",
        scannerEngineVersion: "unavailable",
        failureCode: objectError && SAFE_FAILURE_CODE_PATTERN.test(objectError.code)
          ? objectError.code
          : "artifact_object_read_failed",
      };
    }
    return this.repository.completeInspection({ inspection, outcome });
  }
}
