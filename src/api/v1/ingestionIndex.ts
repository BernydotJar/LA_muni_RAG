import { randomUUID } from "node:crypto";
import { pool } from "../../db.js";
import { DEFAULT_VECTOR_DIMENSION } from "../../embeddings/pgVectorRepository.js";
import { createQueryEmbeddingProvider } from "../../embeddings/queryEmbeddingFactory.js";
import { PostgresIngestionJobService } from "../../ingestion/ingestionJobService.js";
import { canonicalPipelineConfig, MAX_INGESTION_ATTEMPTS } from "../../ingestion/jobIdentity.js";
import type { IngestionPipelineConfigV1 } from "../../ingestion/jobTypes.js";
import { PostgresIdentityRepository } from "../../security/index.js";
import { loadIngestionJobContractValidators } from "./ingestionContracts.js";
import { handleIngestionJobV1 } from "./ingestionHandler.js";
import {
  InMemoryIngestionApiPersistence,
  PostgresIngestionApiPersistence,
} from "./ingestionPersistence.js";
import type {
  IngestionApiPersistence,
  IngestionAuthenticationFailureRecorder,
  IngestionJobApiDependencies,
  IngestionJobApiService,
} from "./ingestionTypes.js";

export interface IngestionJobV1Options
extends Partial<
  Omit<
    IngestionJobApiDependencies,
    "persistence" | "authenticationFailureRecorder" | "jobService"
  >
> {
  persistence?: IngestionApiPersistence;
  authenticationFailureRecorder?: IngestionAuthenticationFailureRecorder;
  jobService?: IngestionJobApiService;
}

const hasAuthenticationFailureRecorder = (
  value: IngestionApiPersistence
): value is IngestionApiPersistence & IngestionAuthenticationFailureRecorder =>
  "recordAuthenticationFailure" in value &&
  typeof (value as { recordAuthenticationFailure?: unknown }).recordAuthenticationFailure === "function";

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
};

const defaultPipelineConfig = (): IngestionPipelineConfigV1 | null => {
  const provider = createQueryEmbeddingProvider();
  if (!provider || provider.dimensions !== DEFAULT_VECTOR_DIMENSION) return null;
  return {
    contractVersion: "v1",
    extractor: {
      name: "bounded_document_registry",
      version: "1.0.0",
    },
    chunkPlanner: {
      name: "section_text_v1",
      maxChars: 1_800,
      overlapChars: 180,
    },
    embedding: {
      provider: provider.providerName,
      model: provider.model,
      dimension: provider.dimensions,
    },
  };
};

export const createIngestionJobV1Dependencies = (
  options: IngestionJobV1Options = {}
): IngestionJobApiDependencies => {
  const transactionPool = options.transactionPool ?? pool;
  const persistence = options.persistence ?? new PostgresIngestionApiPersistence();
  const postgresPersistence = new PostgresIngestionApiPersistence();
  const pipelineConfig = options.pipelineConfig === undefined
    ? defaultPipelineConfig()
    : options.pipelineConfig;
  if (pipelineConfig) canonicalPipelineConfig(pipelineConfig);
  const maxAttempts = options.maxAttempts ?? 3;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_INGESTION_ATTEMPTS) {
    throw new Error(`ingestion maxAttempts must be between 1 and ${MAX_INGESTION_ATTEMPTS}`);
  }
  return {
    identityRepository: options.identityRepository ?? new PostgresIdentityRepository(),
    transactionPool,
    persistence,
    authenticationFailureRecorder:
      options.authenticationFailureRecorder ??
      (hasAuthenticationFailureRecorder(persistence) ? persistence : postgresPersistence),
    jobService: options.jobService ?? new PostgresIngestionJobService(transactionPool),
    validators: options.validators ?? loadIngestionJobContractValidators(),
    pipelineConfig,
    maxAttempts,
    enqueueRateLimit: positiveInteger(options.enqueueRateLimit ?? 20, "enqueueRateLimit"),
    getRateLimit: positiveInteger(options.getRateLimit ?? 120, "getRateLimit"),
    rateWindowSeconds: positiveInteger(options.rateWindowSeconds ?? 60, "rateWindowSeconds"),
    now: options.now ?? (() => new Date()),
    createUuid: options.createUuid ?? randomUUID,
  };
};

export {
  handleIngestionJobV1,
  InMemoryIngestionApiPersistence,
  loadIngestionJobContractValidators,
  PostgresIngestionApiPersistence,
};
export * from "./ingestionTypes.js";
