import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { extractByPath } from "./registry.js";
import type { ExtractorInput, NormalizedDocument, SourceFormat } from "./types.js";
import { indexDocument } from "../embeddings/indexer.js";
import type {
  ChunkPlannerOptions,
  EmbeddingFailure,
  EmbeddingProvider,
  EmbeddingRepository,
  IndexDocumentResult,
} from "../embeddings/types.js";
import { PgVectorEmbeddingRepository } from "../embeddings/pgVectorRepository.js";
import {
  createQueryEmbeddingProvider,
  loadQueryEmbeddingProviderConfig,
  type QueryEmbeddingProviderConfig,
} from "../embeddings/queryEmbeddingFactory.js";
import type { QueryEmbeddingProvider } from "../embeddings/queryEmbedding.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

export type VectorIndexingStatus = "indexed" | "partial" | "failed";

export interface VectorIndexingInput {
  inputPath: string;
  content?: string | Buffer;
  title?: string;
  documentKey?: string;
  documentVersion?: string;
  metadata?: Record<string, unknown>;
  chunkPlannerOptions?: ChunkPlannerOptions;
}

export interface VectorIndexingResult {
  status: VectorIndexingStatus;
  inputPath: string;
  documentTitle: string | null;
  sourceFormat: SourceFormat | null;
  documentKey: string | null;
  documentVersion: string | null;
  chunksPlanned: number;
  chunksEmbedded: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  recordsWritten: number;
  failures: EmbeddingFailure[];
}

export interface VectorIndexingDependencies {
  env?: NodeJS.ProcessEnv;
  readFile?: (inputPath: string) => Promise<string | Buffer>;
  extractByPath?: (sourcePath: string, input: Omit<ExtractorInput, "sourcePath">) => Promise<NormalizedDocument> | NormalizedDocument;
  embeddingProvider?: EmbeddingProvider;
  embeddingRepository?: EmbeddingRepository;
  queryEmbeddingConfig?: QueryEmbeddingProviderConfig;
  queryEmbeddingTransport?: QueryEmbeddingTransport;
  now?: () => Date;
}

const safeFailure = (code: string, message: string, retryable = false): EmbeddingFailure => ({
  code,
  message,
  retryable,
});

const sensitiveValuesFromDependencies = (dependencies: VectorIndexingDependencies): string[] => {
  const env = dependencies.env ?? process.env;
  return [
    env.DATABASE_URL,
    env.QUERY_EMBEDDING_API_KEY,
    env.QUERY_EMBEDDING_ENDPOINT,
    dependencies.queryEmbeddingConfig?.apiKey,
    dependencies.queryEmbeddingConfig?.endpoint,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
};

const redactSensitive = (value: string, dependencies: VectorIndexingDependencies): string => {
  let redacted = value
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]");

  for (const sensitiveValue of sensitiveValuesFromDependencies(dependencies)) {
    redacted = redacted.split(sensitiveValue).join("[redacted]");
  }

  return redacted;
};

const sanitizeFailure = (
  failure: EmbeddingFailure,
  dependencies: VectorIndexingDependencies
): EmbeddingFailure => ({
  ...failure,
  message: redactSensitive(failure.message, dependencies),
});

const sanitizeFailures = (
  failures: EmbeddingFailure[],
  dependencies: VectorIndexingDependencies
): EmbeddingFailure[] => failures.map((failure) => sanitizeFailure(failure, dependencies));

const emptyResult = (
  input: Partial<VectorIndexingInput>,
  failure: EmbeddingFailure,
  dependencies: VectorIndexingDependencies = {}
): VectorIndexingResult => ({
  status: "failed",
  inputPath: input.inputPath ?? "",
  documentTitle: input.title ?? null,
  sourceFormat: null,
  documentKey: input.documentKey ?? null,
  documentVersion: input.documentVersion ?? null,
  chunksPlanned: 0,
  chunksEmbedded: 0,
  recordsInserted: 0,
  recordsUpdated: 0,
  recordsUnchanged: 0,
  recordsWritten: 0,
  failures: [sanitizeFailure(failure, dependencies)],
});

export const queryProviderToEmbeddingProvider = (
  queryProvider: QueryEmbeddingProvider
): EmbeddingProvider => ({
  providerName: queryProvider.providerName,
  model: queryProvider.model,
  dimensions: queryProvider.dimensions,
  embed: async (texts: string[]): Promise<number[][]> => Promise.all(texts.map((text) => queryProvider.embedQuery(text))),
});

const createDefaultEmbeddingProvider = (
  dependencies: VectorIndexingDependencies
): EmbeddingProvider | null => {
  const config = dependencies.queryEmbeddingConfig ?? loadQueryEmbeddingProviderConfig(dependencies.env);
  const queryProvider = createQueryEmbeddingProvider({
    config,
    transport: dependencies.queryEmbeddingTransport,
  });

  return queryProvider ? queryProviderToEmbeddingProvider(queryProvider) : null;
};

const hasVectorStoreConfig = (env: NodeJS.ProcessEnv | undefined): boolean =>
  typeof env?.DATABASE_URL === "string" && env.DATABASE_URL.trim().length > 0;

const createDefaultRepository = (
  provider: EmbeddingProvider,
  dependencies: VectorIndexingDependencies
): EmbeddingRepository | null => {
  const env = dependencies.env ?? process.env;
  if (!hasVectorStoreConfig(env)) return null;
  return new PgVectorEmbeddingRepository(undefined, provider.dimensions);
};

const resultStatusFromIndexResult = (result: IndexDocumentResult): VectorIndexingStatus => {
  if (result.failures.length === 0) return "indexed";
  return result.embeddedCount > 0 ? "partial" : "failed";
};

const toVectorIndexingResult = (
  input: VectorIndexingInput,
  document: NormalizedDocument,
  indexResult: IndexDocumentResult,
  dependencies: VectorIndexingDependencies
): VectorIndexingResult => {
  const recordsWritten = indexResult.insertedCount + indexResult.updatedCount + indexResult.unchangedCount;

  return {
    status: resultStatusFromIndexResult(indexResult),
    inputPath: input.inputPath,
    documentTitle: document.title,
    sourceFormat: document.sourceFormat,
    documentKey: input.documentKey ?? input.inputPath,
    documentVersion: input.documentVersion ?? "v1",
    chunksPlanned: indexResult.plannedCount,
    chunksEmbedded: indexResult.embeddedCount,
    recordsInserted: indexResult.insertedCount,
    recordsUpdated: indexResult.updatedCount,
    recordsUnchanged: indexResult.unchangedCount,
    recordsWritten,
    failures: sanitizeFailures(indexResult.failures, dependencies),
  };
};

export const indexVectorSource = async (
  input: VectorIndexingInput,
  dependencies: VectorIndexingDependencies = {}
): Promise<VectorIndexingResult> => {
  if (!input.inputPath?.trim()) {
    return emptyResult(input, safeFailure("missing_input", "--input is required."), dependencies);
  }

  const provider = dependencies.embeddingProvider ?? createDefaultEmbeddingProvider(dependencies);
  if (!provider) {
    return emptyResult(
      input,
      safeFailure("missing_embedding_provider_config", "Embedding provider configuration is incomplete."),
      dependencies
    );
  }

  const repository = dependencies.embeddingRepository ?? createDefaultRepository(provider, dependencies);
  if (!repository) {
    return emptyResult(
      input,
      safeFailure("missing_vector_store_config", "Vector store configuration is incomplete."),
      dependencies
    );
  }

  try {
    const content = input.content ?? await (dependencies.readFile ?? readFile)(input.inputPath);
    const title = input.title ?? basename(input.inputPath);
    const extract = dependencies.extractByPath ?? extractByPath;
    const document = await extract(input.inputPath, {
      title,
      content,
      metadata: {
        ...(input.metadata ?? {}),
        sourcePath: input.inputPath,
      },
    });

    const indexResult = await indexDocument(
      document,
      {
        documentKey: input.documentKey ?? input.inputPath,
        documentVersion: input.documentVersion ?? "v1",
      },
      provider,
      repository,
      {
        chunkPlannerOptions: input.chunkPlannerOptions,
        now: dependencies.now,
      }
    );

    return toVectorIndexingResult(input, document, indexResult, dependencies);
  } catch (error) {
    return emptyResult(
      input,
      safeFailure(
        "vector_indexing_failed",
        error instanceof Error ? error.message : String(error),
        true
      ),
      dependencies
    );
  }
};

export const formatVectorIndexingResult = (result: VectorIndexingResult): string =>
  JSON.stringify(result, null, 2);
