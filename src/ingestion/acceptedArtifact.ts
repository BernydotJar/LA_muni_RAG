import { createHash } from "node:crypto";
import { basename } from "node:path";
import { isCanonicalUuid } from "../security/index.js";
import {
  inspectArtifactContent,
  loadArtifactSafetyPolicy,
  type ArtifactSafetyPolicy,
} from "../sources/artifactSafety.js";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$/;
const SAFE_OBJECT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const SAFE_FILENAME_PATTERN = /^[^/\\\x00-\x1f\x7f]{1,255}$/;
const SAFE_METADATA_PATTERN = /^[^\x00-\x1f\x7f]{1,256}$/;

export interface AcceptedArtifactSafetyEvidence {
  verdict: "clean";
  contentSha256: string;
  byteLength: number;
  detectedMediaType: string;
  structuralSignature: string;
  inspectedAt: string;
  scannerEngine: string;
  scannerEngineVersion: string;
  scannerDefinitionsVersion: string;
}

export interface AcceptedArtifact {
  tenantId: string;
  documentVersionId: string;
  artifactSha256: string;
  /** Exact persisted object and clean-scan rows bound to the worker lease. */
  artifactObjectId: string;
  artifactScanId: string;
  /** Immutable object generation/version, never a mutable latest alias. */
  objectVersion: string;
  originalFilename: string;
  mediaType: string;
  content: Buffer;
  safety: AcceptedArtifactSafetyEvidence;
}

export interface AcceptedArtifactRequest {
  tenantId: string;
  documentVersionId: string;
  artifactSha256: string;
  artifactObjectId: string;
  artifactScanId: string;
}

export interface AcceptedArtifactResolver {
  resolveAcceptedArtifact(request: AcceptedArtifactRequest): Promise<AcceptedArtifact>;
}

export class AcceptedArtifactError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "AcceptedArtifactError";
  }
}

export interface VerifyAcceptedArtifactOptions {
  now?: () => Date;
  policy?: ArtifactSafetyPolicy;
  env?: NodeJS.ProcessEnv;
}

export const artifactSha256 = (content: Buffer): string =>
  createHash("sha256").update(content).digest("hex");

const safeScannerComponent = (value: unknown): value is string =>
  typeof value === "string" && SAFE_COMPONENT_PATTERN.test(value);

const safeMetadata = (value: unknown): value is string =>
  typeof value === "string" && SAFE_METADATA_PATTERN.test(value);

/**
 * Copy and verify an immutable accepted object before any parser/provider work.
 * The returned buffer is private to the worker and is re-hashed after parsing.
 */
export const verifyAcceptedArtifact = (
  expected: AcceptedArtifactRequest,
  artifact: AcceptedArtifact,
  options: VerifyAcceptedArtifactOptions = {}
): AcceptedArtifact => {
  if (
    !isCanonicalUuid(expected.tenantId) ||
    !isCanonicalUuid(expected.documentVersionId) ||
    typeof expected.artifactSha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(expected.artifactSha256) ||
    !isCanonicalUuid(expected.artifactObjectId) ||
    !isCanonicalUuid(expected.artifactScanId) ||
    !isCanonicalUuid(artifact.tenantId) ||
    !isCanonicalUuid(artifact.documentVersionId) ||
    !isCanonicalUuid(artifact.artifactObjectId) ||
    !isCanonicalUuid(artifact.artifactScanId) ||
    typeof artifact.artifactSha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(artifact.artifactSha256)
  ) {
    throw new AcceptedArtifactError("artifact_scope_invalid", "Accepted artifact scope is invalid.");
  }
  if (
    artifact.tenantId.toLowerCase() !== expected.tenantId.toLowerCase() ||
    artifact.documentVersionId.toLowerCase() !== expected.documentVersionId.toLowerCase() ||
    artifact.artifactObjectId.toLowerCase() !== expected.artifactObjectId.toLowerCase() ||
    artifact.artifactScanId.toLowerCase() !== expected.artifactScanId.toLowerCase() ||
    artifact.artifactSha256 !== expected.artifactSha256
  ) {
    throw new AcceptedArtifactError(
      "artifact_identity_mismatch",
      "Accepted artifact identity does not match the leased ingestion job."
    );
  }
  if (
    typeof artifact.objectVersion !== "string" ||
    !SAFE_OBJECT_VERSION_PATTERN.test(artifact.objectVersion)
  ) {
    throw new AcceptedArtifactError(
      "artifact_object_version_invalid",
      "Accepted artifact requires an immutable bounded object version."
    );
  }
  if (
    typeof artifact.originalFilename !== "string" ||
    !SAFE_FILENAME_PATTERN.test(artifact.originalFilename) ||
    basename(artifact.originalFilename) !== artifact.originalFilename
  ) {
    throw new AcceptedArtifactError(
      "artifact_filename_invalid",
      "Accepted artifact filename must be a bounded basename."
    );
  }
  if (!Buffer.isBuffer(artifact.content)) {
    throw new AcceptedArtifactError("artifact_content_invalid", "Accepted artifact bytes are unavailable.");
  }
  if (!safeMetadata(artifact.mediaType)) {
    throw new AcceptedArtifactError(
      "artifact_media_type_invalid",
      "Accepted artifact media type is invalid."
    );
  }

  let policy: ArtifactSafetyPolicy;
  try {
    policy = options.policy ?? loadArtifactSafetyPolicy(options.env);
  } catch (error) {
    throw new AcceptedArtifactError(
      "artifact_safety_policy_invalid",
      "Accepted artifact safety policy is invalid.",
      false,
      { cause: error }
    );
  }
  if (
    !Number.isSafeInteger(policy.maxArtifactBytes) ||
    policy.maxArtifactBytes < 1 ||
    !Number.isSafeInteger(policy.malwareScanMaxAgeMs) ||
    policy.malwareScanMaxAgeMs < 1 ||
    !Number.isSafeInteger(policy.malwareScanTimeoutMs) ||
    policy.malwareScanTimeoutMs < 1
  ) {
    throw new AcceptedArtifactError(
      "artifact_safety_policy_invalid",
      "Accepted artifact safety policy is invalid."
    );
  }
  if (artifact.content.byteLength < 1 || artifact.content.byteLength > policy.maxArtifactBytes) {
    throw new AcceptedArtifactError(
      "artifact_structural_verification_failed",
      "Accepted artifact failed bounded structural verification."
    );
  }

  // Enforce the bound before allocating the worker-private copy.
  const content = Buffer.from(artifact.content);
  let structural;
  try {
    structural = inspectArtifactContent({
      content,
      sourcePath: artifact.originalFilename,
      declaredMediaType: artifact.mediaType,
      maxArtifactBytes: policy.maxArtifactBytes,
    });
  } catch (error) {
    throw new AcceptedArtifactError(
      "artifact_structural_verification_failed",
      "Accepted artifact failed bounded structural verification.",
      false,
      { cause: error }
    );
  }
  const digest = artifactSha256(content);
  if (digest !== expected.artifactSha256) {
    throw new AcceptedArtifactError(
      "artifact_content_hash_mismatch",
      "Accepted artifact bytes do not match the leased digest."
    );
  }

  const safety = artifact.safety;
  const inspectedAt = safeMetadata(safety?.inspectedAt) ? safety.inspectedAt : "";
  const inspectedAtMs = Date.parse(inspectedAt);
  const nowMs = (options.now ?? (() => new Date()))().getTime();
  if (
    safety?.verdict !== "clean" ||
    typeof safety.contentSha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(safety.contentSha256) ||
    safety.contentSha256 !== digest ||
    !Number.isSafeInteger(safety.byteLength) ||
    safety.byteLength !== content.byteLength ||
    !safeMetadata(safety.detectedMediaType) ||
    safety.detectedMediaType !== structural.detectedMediaType ||
    !safeScannerComponent(safety.structuralSignature) ||
    safety.structuralSignature !== structural.signature ||
    !Number.isFinite(inspectedAtMs) ||
    !Number.isFinite(nowMs) ||
    inspectedAtMs > nowMs ||
    nowMs - inspectedAtMs > policy.malwareScanMaxAgeMs ||
    !safeScannerComponent(safety.scannerEngine) ||
    !safeScannerComponent(safety.scannerEngineVersion) ||
    !safeScannerComponent(safety.scannerDefinitionsVersion)
  ) {
    throw new AcceptedArtifactError(
      "artifact_safety_evidence_invalid",
      "Accepted artifact clean-scan evidence is missing, stale, or does not match the bytes."
    );
  }

  return {
    ...artifact,
    tenantId: artifact.tenantId.toLowerCase(),
    documentVersionId: artifact.documentVersionId.toLowerCase(),
    artifactObjectId: artifact.artifactObjectId.toLowerCase(),
    artifactScanId: artifact.artifactScanId.toLowerCase(),
    content,
    mediaType: structural.declaredMediaType,
    safety: { ...safety },
  };
};
