import { createHash } from "node:crypto";
import { DEFAULT_VECTOR_DIMENSION } from "../embeddings/pgVectorRepository.js";
import { isCanonicalUuid } from "../security/index.js";
import type {
  EnqueueIngestionJobInput,
  IngestionJobIdentity,
  IngestionPipelineConfigV1,
} from "./jobTypes.js";
import { INGESTION_JOB_TYPE, IngestionJobError } from "./jobTypes.js";

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_COMPONENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[\x20-\x7e]{8,256}$/;
export const DEFAULT_INGESTION_MAX_ATTEMPTS = 3;
export const MAX_INGESTION_ATTEMPTS = 10;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

export const canonicalPipelineConfig = (config: IngestionPipelineConfigV1): string => {
  if (config.contractVersion !== "v1" || config.chunkPlanner.name !== "section_text_v1") {
    throw new IngestionJobError("ingestion_pipeline_config_invalid", "Unsupported ingestion pipeline contract.");
  }
  for (const component of [
    config.extractor.name,
    config.extractor.version,
    config.embedding.provider,
    config.embedding.model,
  ]) {
    if (!SAFE_COMPONENT_PATTERN.test(component)) {
      throw new IngestionJobError("ingestion_pipeline_config_invalid", "Pipeline component identifier is invalid.");
    }
  }
  if (
    !Number.isSafeInteger(config.chunkPlanner.maxChars) ||
    config.chunkPlanner.maxChars < 32 ||
    config.chunkPlanner.maxChars > 1_000_000 ||
    !Number.isSafeInteger(config.chunkPlanner.overlapChars) ||
    config.chunkPlanner.overlapChars < 0 ||
    config.chunkPlanner.overlapChars > Math.floor(config.chunkPlanner.maxChars / 2)
  ) {
    throw new IngestionJobError("ingestion_pipeline_config_invalid", "Chunk planner bounds are invalid.");
  }
  if (config.embedding.dimension !== DEFAULT_VECTOR_DIMENSION) {
    throw new IngestionJobError(
      "ingestion_pipeline_config_invalid",
      `The current vector schema requires dimension ${DEFAULT_VECTOR_DIMENSION}.`
    );
  }

  return JSON.stringify({
    contract_version: "v1",
    extractor: {
      name: config.extractor.name,
      version: config.extractor.version,
    },
    chunk_planner: {
      name: "section_text_v1",
      max_chars: config.chunkPlanner.maxChars,
      overlap_chars: config.chunkPlanner.overlapChars,
    },
    embedding: {
      provider: config.embedding.provider,
      model: config.embedding.model,
      dimension: config.embedding.dimension,
    },
  });
};

export const buildIngestionJobIdentity = (
  input: EnqueueIngestionJobInput
): IngestionJobIdentity => {
  if (
    !isCanonicalUuid(input.tenantId) ||
    !isCanonicalUuid(input.principalId) ||
    !isCanonicalUuid(input.documentVersionId)
  ) {
    throw new IngestionJobError("ingestion_scope_invalid", "Ingestion job scope requires canonical UUIDs.");
  }
  if (!SHA256_HEX_PATTERN.test(input.artifactSha256)) {
    throw new IngestionJobError("ingestion_artifact_digest_invalid", "Artifact identity must be lowercase SHA-256 hex.");
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
    throw new IngestionJobError(
      "ingestion_idempotency_key_invalid",
      "Idempotency key must contain 8 to 256 printable ASCII characters."
    );
  }
  const maxAttempts = input.maxAttempts ?? DEFAULT_INGESTION_MAX_ATTEMPTS;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_INGESTION_ATTEMPTS) {
    throw new IngestionJobError(
      "ingestion_attempt_policy_invalid",
      `maxAttempts must be an integer between 1 and ${MAX_INGESTION_ATTEMPTS}.`
    );
  }

  const pipelineConfig = canonicalPipelineConfig(input.pipelineConfig);
  const pipelineConfigSha256 = sha256(pipelineConfig);
  const workSha256 = sha256(JSON.stringify({
    contract_version: "v1",
    job_type: INGESTION_JOB_TYPE,
    tenant_id: input.tenantId.toLowerCase(),
    document_version_id: input.documentVersionId.toLowerCase(),
    artifact_sha256: input.artifactSha256,
    pipeline_config_sha256: pipelineConfigSha256,
  }));
  const requestSha256 = sha256(JSON.stringify({
    contract_version: "v1",
    principal_id: input.principalId.toLowerCase(),
    work_sha256: workSha256,
    max_attempts: maxAttempts,
  }));

  return {
    idempotencyKeySha256: sha256(input.idempotencyKey),
    requestSha256,
    artifactSha256: input.artifactSha256,
    pipelineConfigSha256,
    workSha256,
    canonicalPipelineConfig: pipelineConfig,
    maxAttempts,
  };
};
