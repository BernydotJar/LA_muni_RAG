import type { EmbeddingChunk, EmbeddingFailure } from "./types.js";
import { EmbeddingPipelineError } from "./types.js";

export const validateChunks = (chunks: EmbeddingChunk[]): void => {
  for (const chunk of chunks) {
    if (!chunk.text.trim()) {
      throw new EmbeddingPipelineError(
        "invalid_chunk_text",
        `Chunk ${chunk.chunkId} has empty text.`,
        false
      );
    }
    if (!chunk.source.citationLabel) {
      throw new EmbeddingPipelineError(
        "missing_citation_label",
        `Chunk ${chunk.chunkId} is missing citation metadata.`,
        false
      );
    }
  }
};

export const validateVectorDimensions = (
  vectors: number[][],
  expectedDimensions: number
): void => {
  for (const [index, vector] of vectors.entries()) {
    if (vector.length !== expectedDimensions) {
      throw new EmbeddingPipelineError(
        "embedding_dimension_mismatch",
        `Embedding vector ${index} has ${vector.length} dimensions; expected ${expectedDimensions}.`,
        false
      );
    }
  }
};

export const validateVectorCount = (
  vectors: number[][],
  expectedCount: number
): void => {
  if (vectors.length !== expectedCount) {
    throw new EmbeddingPipelineError(
      "embedding_vector_count_mismatch",
      `Embedding provider returned ${vectors.length} vectors; expected ${expectedCount}.`,
      false
    );
  }
};

export const failureFromError = (error: unknown): EmbeddingFailure => {
  if (error instanceof EmbeddingPipelineError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    };
  }

  return {
    code: "embedding_pipeline_failed",
    message: error instanceof Error ? error.message : String(error),
    retryable: true,
  };
};
