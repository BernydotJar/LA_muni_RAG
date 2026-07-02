import type { Pool } from "pg";
import type { EvidenceDependencies } from "../evidence.js";
import { PgVectorEmbeddingRepository } from "../embeddings/pgVectorRepository.js";
import {
  createQueryEmbeddingProvider,
  loadQueryEmbeddingProviderConfig,
  type QueryEmbeddingProviderConfig,
} from "../embeddings/queryEmbeddingFactory.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

export interface RuntimeEvidenceDependencyOptions {
  env?: NodeJS.ProcessEnv;
  pool?: Pool;
  queryEmbeddingConfig?: QueryEmbeddingProviderConfig;
  queryEmbeddingTransport?: QueryEmbeddingTransport;
}

const hasDatabaseConfig = (env: NodeJS.ProcessEnv): boolean =>
  typeof env.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0;

export const createRuntimeEvidenceDependencies = (
  options: RuntimeEvidenceDependencyOptions = {}
): EvidenceDependencies => {
  const env = options.env ?? process.env;
  const queryEmbeddingConfig = options.queryEmbeddingConfig ?? loadQueryEmbeddingProviderConfig(env);
  const queryEmbeddingProvider = createQueryEmbeddingProvider({
    config: queryEmbeddingConfig,
    transport: options.queryEmbeddingTransport,
  });

  if (!queryEmbeddingProvider || !hasDatabaseConfig(env)) {
    return {};
  }

  return {
    queryEmbeddingProvider,
    vectorRepository: new PgVectorEmbeddingRepository(options.pool, queryEmbeddingProvider.dimensions),
  };
};
