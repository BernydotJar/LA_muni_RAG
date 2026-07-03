import type { Pool } from "pg";
import type { EvidenceDependencies } from "../evidence.js";
import { PgVectorEmbeddingRepository } from "../embeddings/pgVectorRepository.js";
import {
  createQueryEmbeddingProvider,
  loadQueryEmbeddingProviderConfig,
  type QueryEmbeddingProviderConfig,
} from "../embeddings/queryEmbeddingFactory.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

export type RuntimeVectorState = "enabled" | "disabled" | "degraded";

export type RuntimeVectorReason =
  | "missing_query_embedding_config"
  | "missing_database_config"
  | "runtime_dependencies_ready"
  | "partial_runtime_dependencies";

export interface RuntimeVectorStatus {
  state: RuntimeVectorState;
  reasons: RuntimeVectorReason[];
  queryEmbeddingProviderConfigured: boolean;
  vectorRepositoryConfigured: boolean;
  providerName?: string;
  model?: string;
  expectedDimensions?: number;
}

export interface RuntimeEvidenceDependencyContext {
  dependencies: EvidenceDependencies;
  vectorStatus: RuntimeVectorStatus;
}

export interface RuntimeEvidenceDependencyOptions {
  env?: NodeJS.ProcessEnv;
  pool?: Pool;
  queryEmbeddingConfig?: QueryEmbeddingProviderConfig;
  queryEmbeddingTransport?: QueryEmbeddingTransport;
}

const hasDatabaseConfig = (env: NodeJS.ProcessEnv): boolean =>
  typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0;

const vectorStatusFor = (
  queryEmbeddingProviderConfigured: boolean,
  vectorRepositoryConfigured: boolean,
  metadata: Pick<RuntimeVectorStatus, "providerName" | "model" | "expectedDimensions"> = {}
): RuntimeVectorStatus => {
  if (queryEmbeddingProviderConfigured && vectorRepositoryConfigured) {
    return {
      state: "enabled",
      reasons: ["runtime_dependencies_ready"],
      queryEmbeddingProviderConfigured,
      vectorRepositoryConfigured,
      ...metadata,
    };
  }

  const reasons: RuntimeVectorReason[] = [];
  if (!queryEmbeddingProviderConfigured) reasons.push("missing_query_embedding_config");
  if (!vectorRepositoryConfigured) reasons.push("missing_database_config");
  if (queryEmbeddingProviderConfigured !== vectorRepositoryConfigured) reasons.push("partial_runtime_dependencies");

  return {
    state: queryEmbeddingProviderConfigured || vectorRepositoryConfigured ? "degraded" : "disabled",
    reasons,
    queryEmbeddingProviderConfigured,
    vectorRepositoryConfigured,
    ...metadata,
  };
};

export const createRuntimeEvidenceDependencyContext = (
  options: RuntimeEvidenceDependencyOptions = {}
): RuntimeEvidenceDependencyContext => {
  const env = options.env ?? process.env;
  const queryEmbeddingConfig = options.queryEmbeddingConfig ?? loadQueryEmbeddingProviderConfig(env);
  const queryEmbeddingProvider = createQueryEmbeddingProvider({
    config: queryEmbeddingConfig,
    transport: options.queryEmbeddingTransport,
  });
  const databaseConfigured = hasDatabaseConfig(env);

  const safeProviderMetadata = queryEmbeddingProvider
    ? {
        providerName: queryEmbeddingProvider.providerName,
        model: queryEmbeddingProvider.model,
        expectedDimensions: queryEmbeddingProvider.dimensions,
      }
    : {};

  if (!queryEmbeddingProvider || !databaseConfigured) {
    return {
      dependencies: {},
      vectorStatus: vectorStatusFor(Boolean(queryEmbeddingProvider), databaseConfigured, safeProviderMetadata),
    };
  }

  return {
    dependencies: {
      queryEmbeddingProvider,
      vectorRepository: new PgVectorEmbeddingRepository(options.pool, queryEmbeddingProvider.dimensions),
    },
    vectorStatus: vectorStatusFor(true, true, safeProviderMetadata),
  };
};

export const createRuntimeEvidenceDependencies = (
  options: RuntimeEvidenceDependencyOptions = {}
): EvidenceDependencies => createRuntimeEvidenceDependencyContext(options).dependencies;
