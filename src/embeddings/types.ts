import type { NormalizedSectionType, SourceFormat } from "../ingestion/types.js";

export type EmbeddingJobStatus = "planned" | "embedded" | "failed";

export interface EmbeddingSource {
  documentKey: string;
  documentTitle: string;
  documentVersion: string;
  sourceFormat: SourceFormat;
  sectionPath: string[];
  sectionType: NormalizedSectionType;
  pageStart: number | null;
  pageEnd: number | null;
  articleNumber: string | null;
  citationLabel: string | null;
}

export interface EmbeddingChunk {
  chunkId: string;
  chunkOrdinal: number;
  text: string;
  contentSha256: string;
  tokenEstimate: number;
  source: EmbeddingSource;
  metadata: Record<string, unknown>;
}

export interface EmbeddingVectorRecord {
  chunk: EmbeddingChunk;
  embedding: number[];
  embeddingModel: string;
  embeddingProvider: string;
  embeddingDimension: number;
  status: EmbeddingJobStatus;
  indexedAt: string;
  failure: EmbeddingFailure | null;
}

export interface EmbeddingFailure {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ChunkPlannerOptions {
  maxChars: number;
  overlapChars: number;
}

export interface PlanChunksInput {
  documentKey: string;
  documentVersion: string;
}

export interface EmbeddingProvider {
  readonly providerName: string;
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface EmbeddingRepository {
  upsert(record: EmbeddingVectorRecord): Promise<"inserted" | "updated" | "unchanged">;
  get(chunkId: string): Promise<EmbeddingVectorRecord | null>;
  list(): Promise<EmbeddingVectorRecord[]>;
}

export interface IndexDocumentResult {
  plannedCount: number;
  embeddedCount: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  failedCount: number;
  failures: EmbeddingFailure[];
}

/** Fully embedded, bounded records prepared before any database transaction. */
export interface PreparedEmbeddingRecords {
  plannedCount: number;
  records: EmbeddingVectorRecord[];
  failedCount: number;
  failures: EmbeddingFailure[];
}

export class EmbeddingPipelineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "EmbeddingPipelineError";
  }
}
