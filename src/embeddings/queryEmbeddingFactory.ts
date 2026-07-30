import { HttpQueryEmbeddingProvider, type QueryEmbeddingTransport } from "./httpQueryEmbeddingProvider.js";
import type { QueryEmbeddingProvider } from "./queryEmbedding.js";

export interface QueryEmbeddingProviderConfig {
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  dimensions?: number;
  timeoutMs?: number;
}

export interface QueryEmbeddingProviderFactoryOptions {
  config?: QueryEmbeddingProviderConfig;
  env?: NodeJS.ProcessEnv;
  transport?: QueryEmbeddingTransport;
}

const parseDimension = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const parseTimeout = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 10 && parsed <= 120_000
    ? parsed
    : undefined;
};

export const loadQueryEmbeddingProviderConfig = (
  env: NodeJS.ProcessEnv = process.env
): QueryEmbeddingProviderConfig => {
  const timeoutMs = parseTimeout(env.QUERY_EMBEDDING_TIMEOUT_MS);
  return {
    provider: env.QUERY_EMBEDDING_PROVIDER,
    endpoint: env.QUERY_EMBEDDING_ENDPOINT,
    apiKey: env.QUERY_EMBEDDING_API_KEY,
    model: env.QUERY_EMBEDDING_MODEL,
    dimensions: parseDimension(env.QUERY_EMBEDDING_DIMENSIONS),
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  };
};

const isCompleteConfig = (
  config: QueryEmbeddingProviderConfig
): config is QueryEmbeddingProviderConfig & Required<Pick<QueryEmbeddingProviderConfig,
  "provider" | "endpoint" | "apiKey" | "model" | "dimensions"
>> =>
  config.provider === "http" &&
  typeof config.endpoint === "string" &&
  config.endpoint.length > 0 &&
  typeof config.apiKey === "string" &&
  config.apiKey.length > 0 &&
  typeof config.model === "string" &&
  config.model.length > 0 &&
  typeof config.dimensions === "number";

export const createQueryEmbeddingProvider = (
  options: QueryEmbeddingProviderFactoryOptions = {}
): QueryEmbeddingProvider | null => {
  const config = options.config ?? loadQueryEmbeddingProviderConfig(options.env);

  if (!isCompleteConfig(config)) return null;

  return new HttpQueryEmbeddingProvider({
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
    dimensions: config.dimensions,
    providerName: config.provider,
    timeoutMs: config.timeoutMs,
    transport: options.transport,
  });
};
