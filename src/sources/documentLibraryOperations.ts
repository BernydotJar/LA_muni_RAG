import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve, sep } from "node:path";
import { extractByPath } from "../ingestion/registry.js";
import {
  JsonFileCorpusManifestStore,
  type CorpusManifestRecord,
  type CorpusManifestStore,
} from "../ingestion/corpusManifest.js";
import {
  indexVectorSource,
  type VectorIndexingInput,
  type VectorIndexingResult,
} from "../ingestion/vectorIndexing.js";
import { loadQueryEmbeddingProviderConfig } from "../embeddings/queryEmbeddingFactory.js";
import {
  sourceInventoryRecordToDomainMetadata,
  validateSourceInventory,
  type SourceInventoryRecord,
} from "./sourceInventory.js";
import {
  parseSourceInventoryManifest,
  reconcileSourceInventoryWithCorpusManifest,
  type SourceInventoryManifestFile,
} from "./sourceInventoryManifest.js";

export type DocumentLibraryOperationStatus = "planned" | "imported" | "ingested" | "noop" | "failed";

export interface DocumentLibraryFailure {
  code: string;
  message: string;
}

export interface ImportLocalArtifactInput {
  inventoryPath: string;
  sourceId: string;
  inputPath: string;
  libraryRoot: string;
  documentVersion: string;
  mediaType?: string;
  dryRun: boolean;
}

export interface IngestLibraryArtifactInput {
  inventoryPath: string;
  corpusManifestPath: string;
  sourceId: string;
  dryRun: boolean;
}

export interface DocumentLibraryOperationResult {
  operation: "import" | "ingest";
  status: DocumentLibraryOperationStatus;
  sourceId: string;
  documentKey: string | null;
  documentVersion: string | null;
  artifactPath: string | null;
  contentSha256: string | null;
  sectionCount: number;
  chunkCount: number;
  mutated: boolean;
  failures: DocumentLibraryFailure[];
}

export interface DocumentLibraryRuntimeMetadata {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

export interface DocumentLibraryDependencies {
  readFile?: typeof readFile;
  writeFile?: typeof writeFile;
  rename?: typeof rename;
  mkdir?: typeof mkdir;
  copyFile?: typeof copyFile;
  stat?: typeof stat;
  now?: () => Date;
  indexVectorSource?: (input: VectorIndexingInput) => Promise<VectorIndexingResult>;
  extractSectionCount?: (path: string, title: string, content: Buffer) => Promise<number>;
  corpusManifestStore?: CorpusManifestStore;
  runtimeMetadata?: DocumentLibraryRuntimeMetadata;
}

const emptyResult = (
  operation: DocumentLibraryOperationResult["operation"],
  sourceId: string,
  failures: DocumentLibraryFailure[]
): DocumentLibraryOperationResult => ({
  operation,
  status: "failed",
  sourceId,
  documentKey: null,
  documentVersion: null,
  artifactPath: null,
  contentSha256: null,
  sectionCount: 0,
  chunkCount: 0,
  mutated: false,
  failures,
});

const sha256Bytes = (value: Buffer): string => createHash("sha256").update(value).digest("hex");

const cleanSegment = (value: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!cleaned) throw new Error("Path segment is empty after sanitization.");
  return cleaned;
};

const boundedArtifactPath = (
  libraryRoot: string,
  sourceId: string,
  documentVersion: string,
  inputPath: string
): string => {
  const root = resolve(libraryRoot);
  const extension = extname(inputPath).toLowerCase();
  const fileName = `${cleanSegment(sourceId)}--${cleanSegment(documentVersion)}${extension}`;
  const target = resolve(root, cleanSegment(sourceId), fileName);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Artifact path escapes the configured library root.");
  }
  return target;
};

const readInventory = async (
  inventoryPath: string,
  dependencies: DocumentLibraryDependencies
): Promise<SourceInventoryManifestFile> => {
  const content = await (dependencies.readFile ?? readFile)(inventoryPath, "utf-8");
  const manifest = parseSourceInventoryManifest(content.toString());
  const validation = validateSourceInventory(manifest.records);
  if (!validation.valid) {
    throw new Error(`Source inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
  }
  return manifest;
};

const writeInventory = async (
  inventoryPath: string,
  manifest: SourceInventoryManifestFile,
  dependencies: DocumentLibraryDependencies
): Promise<void> => {
  const write = dependencies.writeFile ?? writeFile;
  const move = dependencies.rename ?? rename;
  const makeDirectory = dependencies.mkdir ?? mkdir;
  const tempPath = `${inventoryPath}.tmp`;
  await makeDirectory(dirname(inventoryPath), { recursive: true });
  await write(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  await move(tempPath, inventoryPath);
};

const replaceRecord = (
  manifest: SourceInventoryManifestFile,
  updated: SourceInventoryRecord,
  generatedAt: string
): SourceInventoryManifestFile => ({
  ...manifest,
  generatedAt,
  records: manifest.records.map((record) => record.sourceId === updated.sourceId ? updated : record),
});

const findRecord = (manifest: SourceInventoryManifestFile, sourceId: string): SourceInventoryRecord => {
  const record = manifest.records.find((candidate) => candidate.sourceId === sourceId);
  if (!record) throw new Error(`Unknown source inventory id: ${sourceId}.`);
  return record;
};

const nowIso = (dependencies: DocumentLibraryDependencies): string =>
  (dependencies.now ?? (() => new Date()))().toISOString();

const resolveRuntimeMetadata = (dependencies: DocumentLibraryDependencies): DocumentLibraryRuntimeMetadata => {
  if (dependencies.runtimeMetadata) return dependencies.runtimeMetadata;
  const config = loadQueryEmbeddingProviderConfig(process.env);
  return {
    embeddingProvider: config.provider ?? "unknown",
    embeddingModel: config.model ?? "unknown",
    embeddingDimension: config.dimensions ?? 0,
  };
};

const defaultExtractSectionCount = async (path: string, title: string, content: Buffer): Promise<number> => {
  const document = await extractByPath(path, { title, content, metadata: { sourcePath: path } });
  return document.sections.length;
};

const sanitizeFailureMessage = (value: string): string => value
  .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
  .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
  .replace(/(?:api[_-]?key|token|password|secret)=\S+/gi, "[redacted]");

const failureResult = (
  operation: DocumentLibraryOperationResult["operation"],
  sourceId: string,
  error: unknown
): DocumentLibraryOperationResult => emptyResult(operation, sourceId, [{
  code: `document_library_${operation}_failed`,
  message: sanitizeFailureMessage(error instanceof Error ? error.message : String(error)),
}]);

export const importLocalArtifact = async (
  input: ImportLocalArtifactInput,
  dependencies: DocumentLibraryDependencies = {}
): Promise<DocumentLibraryOperationResult> => {
  try {
    const manifest = await readInventory(input.inventoryPath, dependencies);
    const record = findRecord(manifest, input.sourceId);
    if (["missing_source", "ingested", "superseded"].includes(record.status)) {
      throw new Error(`Source ${record.sourceId} cannot be imported from status ${record.status}.`);
    }
    if (record.documentVersion !== input.documentVersion) {
      throw new Error("Declared document version does not match the inventory record.");
    }

    const bytes = await (dependencies.readFile ?? readFile)(input.inputPath);
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const contentSha256 = sha256Bytes(buffer);
    const artifactPath = boundedArtifactPath(input.libraryRoot, record.sourceId, record.documentVersion, input.inputPath);

    if (record.acquisition) {
      if (record.acquisition.contentSha256 !== contentSha256) {
        throw new Error("A different hash is already registered for this source and version.");
      }
      return {
        operation: "import",
        status: "noop",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        documentVersion: record.documentVersion,
        artifactPath: record.acquisition.artifactPath,
        contentSha256,
        sectionCount: record.extraction?.sectionCount ?? 0,
        chunkCount: record.indexing?.chunkCount ?? 0,
        mutated: false,
        failures: [],
      };
    }

    if (input.dryRun) {
      return {
        operation: "import",
        status: "planned",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        documentVersion: record.documentVersion,
        artifactPath,
        contentSha256,
        sectionCount: 0,
        chunkCount: 0,
        mutated: false,
        failures: [],
      };
    }

    await (dependencies.mkdir ?? mkdir)(dirname(artifactPath), { recursive: true });
    await (dependencies.copyFile ?? copyFile)(input.inputPath, artifactPath);
    const copied = await (dependencies.readFile ?? readFile)(artifactPath);
    const copiedHash = sha256Bytes(Buffer.isBuffer(copied) ? copied : Buffer.from(copied));
    if (copiedHash !== contentSha256) throw new Error("Copied artifact hash verification failed.");

    const updated: SourceInventoryRecord = {
      ...record,
      status: "acquired",
      acquisition: {
        acquiredAt: nowIso(dependencies),
        artifactPath,
        contentSha256,
        mediaType: input.mediaType,
        byteLength: buffer.byteLength,
      },
      extraction: undefined,
      indexing: undefined,
      failureCodes: undefined,
    };
    const updatedManifest = replaceRecord(manifest, updated, nowIso(dependencies));
    const validation = validateSourceInventory(updatedManifest.records);
    if (!validation.valid) throw new Error(`Updated inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
    await writeInventory(input.inventoryPath, updatedManifest, dependencies);

    return {
      operation: "import",
      status: "imported",
      sourceId: updated.sourceId,
      documentKey: updated.documentKey,
      documentVersion: updated.documentVersion,
      artifactPath,
      contentSha256,
      sectionCount: 0,
      chunkCount: 0,
      mutated: true,
      failures: [],
    };
  } catch (error) {
    return failureResult("import", input.sourceId, error);
  }
};

const operationalRecord = (
  record: SourceInventoryRecord,
  indexing: VectorIndexingResult,
  runtime: DocumentLibraryRuntimeMetadata,
  indexedAt: string
): CorpusManifestRecord => ({
  documentKey: record.documentKey,
  documentTitle: indexing.documentTitle ?? record.title,
  sourcePath: record.acquisition?.artifactPath ?? "",
  sourceFormat: indexing.sourceFormat,
  documentVersion: record.documentVersion,
  contentSha256: record.acquisition?.contentSha256 ?? "",
  chunkCount: indexing.chunksPlanned,
  embeddingProvider: runtime.embeddingProvider,
  embeddingModel: runtime.embeddingModel,
  embeddingDimension: runtime.embeddingDimension,
  documentMetadata: sourceInventoryRecordToDomainMetadata(record),
  status: indexing.status === "indexed" ? "indexed" : "failed",
  indexedAt,
  failureCount: indexing.failures.length,
  failureCodes: indexing.failures.map((item) => item.code),
});

export const ingestLibraryArtifact = async (
  input: IngestLibraryArtifactInput,
  dependencies: DocumentLibraryDependencies = {}
): Promise<DocumentLibraryOperationResult> => {
  try {
    const manifest = await readInventory(input.inventoryPath, dependencies);
    const record = findRecord(manifest, input.sourceId);
    if (!record.acquisition) throw new Error("Source has no acquisition evidence.");
    if (!["acquired", "ingestion_pending", "failed", "ingested"].includes(record.status)) {
      throw new Error(`Source ${record.sourceId} cannot be ingested from status ${record.status}.`);
    }

    const artifactBytes = await (dependencies.readFile ?? readFile)(record.acquisition.artifactPath);
    const buffer = Buffer.isBuffer(artifactBytes) ? artifactBytes : Buffer.from(artifactBytes);
    const contentSha256 = sha256Bytes(buffer);
    if (contentSha256 !== record.acquisition.contentSha256) {
      throw new Error("Local artifact hash does not match inventory acquisition evidence.");
    }
    await (dependencies.stat ?? stat)(record.acquisition.artifactPath);

    const store = dependencies.corpusManifestStore ?? new JsonFileCorpusManifestStore(input.corpusManifestPath);
    const existing = await store.get(record.documentKey);
    if (
      record.status === "ingested" &&
      existing?.status === "indexed" &&
      existing.documentVersion === record.documentVersion &&
      existing.contentSha256 === contentSha256 &&
      existing.chunkCount > 0
    ) {
      return {
        operation: "ingest",
        status: "noop",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        documentVersion: record.documentVersion,
        artifactPath: record.acquisition.artifactPath,
        contentSha256,
        sectionCount: record.extraction?.sectionCount ?? 0,
        chunkCount: existing.chunkCount,
        mutated: false,
        failures: [],
      };
    }
    if (existing && existing.documentVersion === record.documentVersion && existing.contentSha256 !== contentSha256) {
      throw new Error("Operational manifest contains a conflicting hash for this document version.");
    }

    const extract = dependencies.extractSectionCount ?? defaultExtractSectionCount;
    const sectionCount = await extract(record.acquisition.artifactPath, record.title, buffer);
    if (!Number.isInteger(sectionCount) || sectionCount <= 0) throw new Error("Extraction produced no sections.");

    if (input.dryRun) {
      return {
        operation: "ingest",
        status: "planned",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        documentVersion: record.documentVersion,
        artifactPath: record.acquisition.artifactPath,
        contentSha256,
        sectionCount,
        chunkCount: 0,
        mutated: false,
        failures: [],
      };
    }

    const indexedAt = nowIso(dependencies);
    const index = dependencies.indexVectorSource ?? indexVectorSource;
    const indexing = await index({
      inputPath: record.acquisition.artifactPath,
      title: record.title,
      documentKey: record.documentKey,
      documentVersion: record.documentVersion,
      metadata: sourceInventoryRecordToDomainMetadata(record),
    });
    if (indexing.status !== "indexed" || indexing.chunksPlanned <= 0 || indexing.failures.length > 0) {
      throw new Error(`Indexing failed: ${indexing.failures.map((item) => item.code).join(", ") || indexing.status}.`);
    }

    const runtime = resolveRuntimeMetadata(dependencies);
    const corpusRecord = operationalRecord(record, indexing, runtime, indexedAt);
    await store.put(corpusRecord);

    const updated: SourceInventoryRecord = {
      ...record,
      status: "ingested",
      extraction: {
        extractedAt: indexedAt,
        extractor: "registry",
        sectionCount,
      },
      indexing: {
        indexedAt,
        indexer: "vector-indexing",
        chunkCount: indexing.chunksPlanned,
        manifestDocumentKey: record.documentKey,
      },
      failureCodes: undefined,
    };
    const updatedManifest = replaceRecord(manifest, updated, indexedAt);
    const validation = validateSourceInventory(updatedManifest.records);
    if (!validation.valid) throw new Error(`Updated inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
    const reconciliation = reconcileSourceInventoryWithCorpusManifest(updatedManifest.records, await store.list());
    if (!reconciliation.valid) {
      throw new Error(`Inventory reconciliation failed: ${reconciliation.failures.map((item) => item.code).join(", ")}.`);
    }
    await writeInventory(input.inventoryPath, updatedManifest, dependencies);

    return {
      operation: "ingest",
      status: "ingested",
      sourceId: updated.sourceId,
      documentKey: updated.documentKey,
      documentVersion: updated.documentVersion,
      artifactPath: updated.acquisition?.artifactPath ?? null,
      contentSha256,
      sectionCount,
      chunkCount: indexing.chunksPlanned,
      mutated: true,
      failures: [],
    };
  } catch (error) {
    return failureResult("ingest", input.sourceId, error);
  }
};

export const formatDocumentLibraryOperationResult = (result: DocumentLibraryOperationResult): string =>
  JSON.stringify(result, null, 2);
