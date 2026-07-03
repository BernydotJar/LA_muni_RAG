import { sha256Hex } from "../embeddings/chunkIdentity.js";
import type { SourceFormat } from "./types.js";
import type { VectorIndexingInput, VectorIndexingResult } from "./vectorIndexing.js";
import { indexVectorSource } from "./vectorIndexing.js";

export type CorpusManifestStatus = "indexed" | "skipped" | "stale" | "failed";
export type CorpusBackfillDecision = "index" | "skip" | "reindex" | "retry";

export interface CorpusManifestRecord {
  documentKey: string;
  documentTitle: string | null;
  sourcePath: string;
  sourceFormat: SourceFormat | null;
  documentVersion: string;
  contentSha256: string;
  chunkCount: number;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  status: CorpusManifestStatus;
  indexedAt: string;
  failureCount: number;
  failureCodes: string[];
}

export interface CorpusManifestStore {
  get(documentKey: string): Promise<CorpusManifestRecord | null>;
  put(record: CorpusManifestRecord): Promise<void>;
  list(): Promise<CorpusManifestRecord[]>;
}

export class InMemoryCorpusManifestStore implements CorpusManifestStore {
  private readonly records = new Map<string, CorpusManifestRecord>();

  constructor(initialRecords: CorpusManifestRecord[] = []) {
    for (const record of initialRecords) {
      this.records.set(record.documentKey, record);
    }
  }

  async get(documentKey: string): Promise<CorpusManifestRecord | null> {
    return this.records.get(documentKey) ?? null;
  }

  async put(record: CorpusManifestRecord): Promise<void> {
    this.records.set(record.documentKey, record);
  }

  async list(): Promise<CorpusManifestRecord[]> {
    return [...this.records.values()];
  }
}

export interface CorpusBackfillDocumentInput {
  inputPath: string;
  title?: string;
  documentKey: string;
  documentVersion: string;
  sourceFormat?: SourceFormat;
  content: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
  metadata?: Record<string, unknown>;
}

export interface CorpusBackfillInput {
  documents: CorpusBackfillDocumentInput[];
}

export interface CorpusBackfillDocumentResult {
  documentKey: string;
  decision: CorpusBackfillDecision;
  status: CorpusManifestStatus;
  failureCodes: string[];
}

export interface CorpusBackfillResult {
  documentsConsidered: number;
  documentsIndexed: number;
  documentsSkipped: number;
  documentsFailed: number;
  documentsStale: number;
  results: CorpusBackfillDocumentResult[];
}

export interface CorpusBackfillDependencies {
  manifestStore: CorpusManifestStore;
  indexVectorSource?: (input: VectorIndexingInput) => Promise<VectorIndexingResult>;
  now?: () => Date;
}

export interface ReindexDecisionInput {
  existingRecord: CorpusManifestRecord | null;
  document: CorpusBackfillDocumentInput;
  contentSha256: string;
}

export const computeCorpusContentSha256 = (content: string): string => sha256Hex(content);

export const decideCorpusBackfill = ({
  existingRecord,
  document,
  contentSha256,
}: ReindexDecisionInput): CorpusBackfillDecision => {
  if (!existingRecord) return "index";
  if (existingRecord.status === "failed") return "retry";

  const changed =
    existingRecord.contentSha256 !== contentSha256 ||
    existingRecord.documentVersion !== document.documentVersion ||
    existingRecord.embeddingProvider !== document.embeddingProvider ||
    existingRecord.embeddingModel !== document.embeddingModel ||
    existingRecord.embeddingDimension !== document.embeddingDimension;

  return changed ? "reindex" : "skip";
};

const emptyBackfillResult = (): CorpusBackfillResult => ({
  documentsConsidered: 0,
  documentsIndexed: 0,
  documentsSkipped: 0,
  documentsFailed: 0,
  documentsStale: 0,
  results: [],
});

const recordFromIndexingResult = (
  document: CorpusBackfillDocumentInput,
  contentSha256: string,
  indexingResult: VectorIndexingResult,
  status: CorpusManifestStatus,
  indexedAt: string
): CorpusManifestRecord => ({
  documentKey: document.documentKey,
  documentTitle: indexingResult.documentTitle ?? document.title ?? null,
  sourcePath: document.inputPath,
  sourceFormat: indexingResult.sourceFormat ?? document.sourceFormat ?? null,
  documentVersion: document.documentVersion,
  contentSha256,
  chunkCount: indexingResult.chunksPlanned,
  embeddingProvider: document.embeddingProvider,
  embeddingModel: document.embeddingModel,
  embeddingDimension: document.embeddingDimension,
  status,
  indexedAt,
  failureCount: indexingResult.failures.length,
  failureCodes: indexingResult.failures.map((failure) => failure.code),
});

const skippedRecordFromExisting = (
  existingRecord: CorpusManifestRecord,
  indexedAt: string
): CorpusManifestRecord => ({
  ...existingRecord,
  status: "skipped",
  indexedAt,
  failureCount: 0,
  failureCodes: [],
});

const vectorInputFromDocument = (document: CorpusBackfillDocumentInput): VectorIndexingInput => ({
  inputPath: document.inputPath,
  title: document.title,
  documentKey: document.documentKey,
  documentVersion: document.documentVersion,
  metadata: document.metadata,
});

export const backfillCorpusManifest = async (
  input: CorpusBackfillInput,
  dependencies: CorpusBackfillDependencies
): Promise<CorpusBackfillResult> => {
  const result = emptyBackfillResult();
  const indexer = dependencies.indexVectorSource ?? indexVectorSource;
  const now = dependencies.now ?? (() => new Date());

  for (const document of input.documents) {
    result.documentsConsidered += 1;
    const contentSha256 = computeCorpusContentSha256(document.content);
    const existingRecord = await dependencies.manifestStore.get(document.documentKey);
    const decision = decideCorpusBackfill({ existingRecord, document, contentSha256 });
    const indexedAt = now().toISOString();

    if (decision === "skip" && existingRecord) {
      const record = skippedRecordFromExisting(existingRecord, indexedAt);
      await dependencies.manifestStore.put(record);
      result.documentsSkipped += 1;
      result.results.push({
        documentKey: document.documentKey,
        decision,
        status: record.status,
        failureCodes: [],
      });
      continue;
    }

    if (decision === "reindex") {
      result.documentsStale += 1;
    }

    const indexingResult = await indexer(vectorInputFromDocument(document));
    const status: CorpusManifestStatus = indexingResult.status === "indexed" ? "indexed" : "failed";
    const record = recordFromIndexingResult(document, contentSha256, indexingResult, status, indexedAt);
    await dependencies.manifestStore.put(record);

    if (status === "indexed") result.documentsIndexed += 1;
    if (status === "failed") result.documentsFailed += 1;

    result.results.push({
      documentKey: document.documentKey,
      decision,
      status,
      failureCodes: record.failureCodes,
    });
  }

  return result;
};
