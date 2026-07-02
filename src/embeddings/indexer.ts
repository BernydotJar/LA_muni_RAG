import type { NormalizedDocument } from "../ingestion/types.js";
import { planChunks } from "./chunkPlanner.js";
import type {
  ChunkPlannerOptions,
  EmbeddingProvider,
  EmbeddingRepository,
  EmbeddingVectorRecord,
  IndexDocumentResult,
  PlanChunksInput,
} from "./types.js";
import { failureFromError, validateChunks, validateVectorCount, validateVectorDimensions } from "./validation.js";

export interface IndexDocumentOptions {
  chunkPlannerOptions?: ChunkPlannerOptions;
  now?: () => Date;
}

export const indexDocument = async (
  document: NormalizedDocument,
  input: PlanChunksInput,
  provider: EmbeddingProvider,
  repository: EmbeddingRepository,
  options: IndexDocumentOptions = {}
): Promise<IndexDocumentResult> => {
  const chunks = planChunks(document, input, options.chunkPlannerOptions);
  const result: IndexDocumentResult = {
    plannedCount: chunks.length,
    embeddedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    failedCount: 0,
    failures: [],
  };

  try {
    validateChunks(chunks);
    const vectors = await provider.embed(chunks.map((chunk) => chunk.text));
    validateVectorCount(vectors, chunks.length);
    validateVectorDimensions(vectors, provider.dimensions);
    const indexedAt = (options.now ?? (() => new Date()))().toISOString();

    for (const [index, chunk] of chunks.entries()) {
      const record: EmbeddingVectorRecord = {
        chunk,
        embedding: vectors[index],
        embeddingModel: provider.model,
        embeddingProvider: provider.providerName,
        embeddingDimension: provider.dimensions,
        status: "embedded",
        indexedAt,
        failure: null,
      };

      const writeResult = await repository.upsert(record);
      result.embeddedCount += 1;
      if (writeResult === "inserted") result.insertedCount += 1;
      if (writeResult === "updated") result.updatedCount += 1;
      if (writeResult === "unchanged") result.unchangedCount += 1;
    }
  } catch (error) {
    result.failedCount = chunks.length;
    result.failures.push(failureFromError(error));
  }

  return result;
};
