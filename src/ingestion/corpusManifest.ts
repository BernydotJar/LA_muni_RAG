import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
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

export interface CorpusManifestFile {
  schemaVersion: 1;
  records: CorpusManifestRecord[];
}

export class CorpusManifestFileError extends Error {
  readonly code = "corpus_manifest_file_invalid";

  constructor(message: string) {
    super(message);
    this.name = "CorpusManifestFileError";
  }
}

const emptyCorpusManifestFile = (): CorpusManifestFile => ({
  schemaVersion: 1,
  records: [],
});

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sortManifestRecords = (records: CorpusManifestRecord[]): CorpusManifestRecord[] =>
  [...records].sort((left, right) => left.documentKey.localeCompare(right.documentKey));

const validateCorpusManifestRecord = (value: unknown): CorpusManifestRecord => {
  if (!isRecordObject(value)) {
    throw new CorpusManifestFileError("Corpus manifest record must be an object.");
  }

  if (typeof value.documentKey !== "string" || value.documentKey.trim().length === 0) {
    throw new CorpusManifestFileError("Corpus manifest record documentKey must be a non-empty string.");
  }

  return value as unknown as CorpusManifestRecord;
};

const parseCorpusManifestFile = (content: string): CorpusManifestFile => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new CorpusManifestFileError("Corpus manifest file contains invalid JSON.");
  }

  if (!isRecordObject(parsed)) {
    throw new CorpusManifestFileError("Corpus manifest file must contain a JSON object.");
  }

  if (parsed.schemaVersion !== 1) {
    throw new CorpusManifestFileError("Corpus manifest file schemaVersion must be 1.");
  }

  if (!Array.isArray(parsed.records)) {
    throw new CorpusManifestFileError("Corpus manifest file records must be an array.");
  }

  return {
    schemaVersion: 1,
    records: sortManifestRecords(parsed.records.map(validateCorpusManifestRecord)),
  };
};

const isMissingFileError = (error: unknown): boolean =>
  isRecordObject(error) && error.code === "ENOENT";

export class JsonFileCorpusManifestStore implements CorpusManifestStore {
  constructor(private readonly manifestPath: string) {}

  async get(documentKey: string): Promise<CorpusManifestRecord | null> {
    const manifest = await this.readManifestFile();
    return manifest.records.find((record) => record.documentKey === documentKey) ?? null;
  }

  async put(record: CorpusManifestRecord): Promise<void> {
    const manifest = await this.readManifestFile();
    const records = manifest.records.filter((existingRecord) => existingRecord.documentKey !== record.documentKey);
    records.push(record);
    await this.writeManifestFile({
      schemaVersion: 1,
      records: sortManifestRecords(records),
    });
  }

  async list(): Promise<CorpusManifestRecord[]> {
    const manifest = await this.readManifestFile();
    return sortManifestRecords(manifest.records);
  }

  private async readManifestFile(): Promise<CorpusManifestFile> {
    try {
      return parseCorpusManifestFile(await readFile(this.manifestPath, "utf-8"));
    } catch (error) {
      if (isMissingFileError(error)) return emptyCorpusManifestFile();
      throw error;
    }
  }

  private async writeManifestFile(manifest: CorpusManifestFile): Promise<void> {
    const sortedManifest: CorpusManifestFile = {
      schemaVersion: 1,
      records: sortManifestRecords(manifest.records),
    };
    const tempPath = `${this.manifestPath}.tmp`;
    await mkdir(dirname(this.manifestPath), { recursive: true });
    await writeFile(tempPath, `${JSON.stringify(sortedManifest, null, 2)}\n`, "utf-8");
    await rename(tempPath, this.manifestPath);
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
