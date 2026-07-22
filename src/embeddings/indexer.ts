import type { NormalizedDocument } from "../ingestion/types.js";
import { planChunks } from "./chunkPlanner.js";
import type {
  ChunkPlannerOptions,
  EmbeddingProvider,
  EmbeddingRepository,
  EmbeddingVectorRecord,
  IndexDocumentResult,
  PlanChunksInput,
  PreparedEmbeddingRecords,
} from "./types.js";
import { EmbeddingPipelineError } from "./types.js";
import { failureFromError, validateChunks, validateVectorCount, validateVectorDimensions } from "./validation.js";

export const MAX_CHUNKS_PER_DOCUMENT = 5_000;
export const MAX_EMBEDDING_BATCH_SIZE = 64;

export interface IndexDocumentOptions {
  chunkPlannerOptions?: ChunkPlannerOptions;
  maxChunksPerDocument?: number;
  embeddingBatchSize?: number;
  now?: () => Date;
}

const boundedOption = (
  value: number | undefined,
  fallback: number,
  maximum: number,
  name: string
): number => {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum) {
    throw new EmbeddingPipelineError(
      "embedding_resource_policy_invalid",
      `${name} must be an integer between 1 and ${maximum}.`,
      false
    );
  }
  return resolved;
};

export const prepareDocumentEmbeddings = async (
  document: NormalizedDocument,
  input: PlanChunksInput,
  provider: EmbeddingProvider,
  options: IndexDocumentOptions = {}
): Promise<PreparedEmbeddingRecords> => {
  let plannedCount = 0;
  try {
    const maxChunks = boundedOption(
      options.maxChunksPerDocument,
      MAX_CHUNKS_PER_DOCUMENT,
      MAX_CHUNKS_PER_DOCUMENT,
      "maxChunksPerDocument"
    );
    const embeddingBatchSize = boundedOption(
      options.embeddingBatchSize,
      MAX_EMBEDDING_BATCH_SIZE,
      MAX_EMBEDDING_BATCH_SIZE,
      "embeddingBatchSize"
    );
    const chunks = planChunks(document, input, options.chunkPlannerOptions, maxChunks);
    plannedCount = chunks.length;
    if (chunks.length > maxChunks) {
      throw new EmbeddingPipelineError(
        "embedding_chunk_limit_exceeded",
        `Document planned ${chunks.length} chunks; the limit is ${maxChunks}.`,
        false
      );
    }
    validateChunks(chunks);
    const vectors: number[][] = [];
    for (let start = 0; start < chunks.length; start += embeddingBatchSize) {
      const batch = chunks.slice(start, start + embeddingBatchSize);
      const batchVectors = await provider.embed(batch.map((chunk) => chunk.text));
      validateVectorCount(batchVectors, batch.length);
      validateVectorDimensions(batchVectors, provider.dimensions);
      vectors.push(...batchVectors);
    }
    const indexedAt = (options.now ?? (() => new Date()))().toISOString();
    const records = chunks.map((chunk, index): EmbeddingVectorRecord => ({
      chunk,
      embedding: vectors[index]!,
      embeddingModel: provider.model,
      embeddingProvider: provider.providerName,
      embeddingDimension: provider.dimensions,
      status: "embedded",
      indexedAt,
      failure: null,
    }));
    return {
      plannedCount: chunks.length,
      records,
      failedCount: 0,
      failures: [],
    };
  } catch (error) {
    return {
      plannedCount,
      records: [],
      failedCount: plannedCount,
      failures: [failureFromError(error)],
    };
  }
};

export const indexDocument = async (
  document: NormalizedDocument,
  input: PlanChunksInput,
  provider: EmbeddingProvider,
  repository: EmbeddingRepository,
  options: IndexDocumentOptions = {}
): Promise<IndexDocumentResult> => {
  const prepared = await prepareDocumentEmbeddings(document, input, provider, options);
  const result: IndexDocumentResult = {
    plannedCount: prepared.plannedCount,
    embeddedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    failedCount: prepared.failedCount,
    failures: [...prepared.failures],
  };
  if (prepared.failures.length > 0) return result;

  try {
    for (const record of prepared.records) {
      const writeResult = await repository.upsert(record);
      result.embeddedCount += 1;
      if (writeResult === "inserted") result.insertedCount += 1;
      if (writeResult === "updated") result.updatedCount += 1;
      if (writeResult === "unchanged") result.unchangedCount += 1;
    }
  } catch (error) {
    result.failedCount = prepared.plannedCount;
    result.failures.push(failureFromError(error));
  }

  return result;
};
