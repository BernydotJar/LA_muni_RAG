import { createHash } from "node:crypto";
import { link, lstat, mkdir, readFile, realpath, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { extractByPath } from "../ingestion/registry.js";
import type { NormalizedDocument } from "../ingestion/types.js";
import { IngestionError } from "../ingestion/types.js";
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
  ArtifactSafetyError,
  assertArtifactByteLength,
  createClamAvScannerFromEnv,
  inspectArtifactContent,
  loadArtifactSafetyPolicy,
  type ArtifactSafetyPolicy,
  type MalwareScanResult,
  type MalwareScanner,
} from "./artifactSafety.js";
import { scanVerifiedArtifactSnapshot } from "./scanVerifiedArtifact.js";
import {
  hasCleanArtifactSafety,
  sourceInventoryRecordToDomainMetadata,
  validateSourceInventory,
  type SourceInventoryArtifactSafetyEvidence,
  type SourceInventoryRecord,
} from "./sourceInventory.js";
import {
  parseSourceInventoryManifest,
  reconcileSourceInventoryWithCorpusManifest,
  type SourceInventoryManifestFile,
} from "./sourceInventoryManifest.js";

export type DocumentLibraryOperationStatus =
  | "planned"
  | "imported"
  | "accepted"
  | "quarantined"
  | "ingested"
  | "noop"
  | "failed";

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
  mediaType: string;
  dryRun: boolean;
}

export interface IngestLibraryArtifactInput {
  inventoryPath: string;
  corpusManifestPath: string;
  sourceId: string;
  dryRun: boolean;
}

export interface InspectLibraryArtifactInput {
  inventoryPath: string;
  sourceId: string;
  libraryRoot: string;
  quarantineRoot: string;
  dryRun: boolean;
}

export interface DocumentLibraryOperationResult {
  operation: "import" | "inspect" | "ingest";
  status: DocumentLibraryOperationStatus;
  sourceId: string;
  documentKey: string | null;
  documentVersion: string | null;
  artifactPath: string | null;
  contentSha256: string | null;
  sectionCount: number;
  chunkCount: number;
  artifactSafety: SourceInventoryArtifactSafetyEvidence | null;
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
  link?: typeof link;
  lstat?: typeof lstat;
  realpath?: typeof realpath;
  stat?: typeof stat;
  unlink?: typeof unlink;
  now?: () => Date;
  indexVectorSource?: (input: VectorIndexingInput) => Promise<VectorIndexingResult>;
  extractDocument?: (path: string, title: string, content: Buffer) => Promise<NormalizedDocument>;
  corpusManifestStore?: CorpusManifestStore;
  runtimeMetadata?: DocumentLibraryRuntimeMetadata;
  malwareScanner?: MalwareScanner;
  artifactSafetyPolicy?: ArtifactSafetyPolicy;
  env?: NodeJS.ProcessEnv;
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
  artifactSafety: null,
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
  if (dirname(root) === root) throw new Error("Filesystem root cannot be used as the document library root.");
  const extension = extname(inputPath).toLowerCase();
  const fileName = `${cleanSegment(sourceId)}--${cleanSegment(documentVersion)}${extension}`;
  const target = resolve(root, cleanSegment(sourceId), fileName);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Artifact path escapes the configured library root.");
  }
  return target;
};

const manifestArtifactPath = (libraryRoot: string, resolvedArtifactPath: string): string =>
  isAbsolute(libraryRoot)
    ? resolvedArtifactPath
    : relative(process.cwd(), resolvedArtifactPath).split(sep).join("/");

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

const defaultExtractDocument = async (
  path: string,
  title: string,
  content: Buffer
): Promise<NormalizedDocument> =>
  extractByPath(path, { title, content, metadata: { sourcePath: path } });

const sanitizeFailureMessage = (value: string): string => value
  .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
  .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
  .replace(/(?:api[_-]?key|token|password|secret)=\S+/gi, "[redacted]");

const failureResult = (
  operation: DocumentLibraryOperationResult["operation"],
  sourceId: string,
  error: unknown
): DocumentLibraryOperationResult => emptyResult(operation, sourceId, [{
  code: error instanceof ArtifactSafetyError
    ? error.code
    : error instanceof IngestionError
      ? error.code
      : `document_library_${operation}_failed`,
  message: sanitizeFailureMessage(error instanceof Error ? error.message : String(error)),
}]);

const moveArtifactNoReplace = async (
  from: string,
  to: string,
  dependencies: DocumentLibraryDependencies
): Promise<void> => {
  try {
    await (dependencies.link ?? link)(from, to);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") throw new Error("Managed artifact destination already exists.");
    if (code === "EXDEV") {
      throw new ArtifactSafetyError(
        "artifact_roots_cross_device",
        "Managed artifact roots must share a filesystem for no-replace moves."
      );
    }
    throw error;
  }

  try {
    await (dependencies.unlink ?? unlink)(from);
  } catch (error) {
    try {
      await (dependencies.unlink ?? unlink)(to);
    } catch {
      // Preserve the unlink failure; operators can reconcile the deterministic paths.
    }
    throw error;
  }
};

export const importLocalArtifact = async (
  input: ImportLocalArtifactInput,
  dependencies: DocumentLibraryDependencies = {}
): Promise<DocumentLibraryOperationResult> => {
  let stagedArtifactPath: string | undefined;
  let createdArtifactPath: string | undefined;
  try {
    const manifest = await readInventory(input.inventoryPath, dependencies);
    const record = findRecord(manifest, input.sourceId);
    if (["missing_source", "ingested", "superseded"].includes(record.status)) {
      throw new Error(`Source ${record.sourceId} cannot be imported from status ${record.status}.`);
    }
    if (record.documentVersion !== input.documentVersion) {
      throw new Error("Declared document version does not match the inventory record.");
    }
    if (!input.mediaType?.trim()) {
      throw new ArtifactSafetyError("artifact_media_type_missing", "A declared artifact media type is required.");
    }

    const policy = dependencies.artifactSafetyPolicy ?? loadArtifactSafetyPolicy(dependencies.env);
    const inputMetadata = await (dependencies.lstat ?? lstat)(input.inputPath);
    if (!inputMetadata.isFile()) {
      throw new ArtifactSafetyError("artifact_not_regular_file", "Artifact input must be a regular file.");
    }
    assertArtifactByteLength(inputMetadata.size, policy.maxArtifactBytes);
    const bytes = await (dependencies.readFile ?? readFile)(input.inputPath);
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    if (buffer.byteLength !== inputMetadata.size) {
      throw new ArtifactSafetyError(
        "artifact_changed_during_import",
        "Artifact size changed while import bytes were being read."
      );
    }
    const structuralInspection = inspectArtifactContent({
      content: buffer,
      sourcePath: input.inputPath,
      declaredMediaType: input.mediaType,
      maxArtifactBytes: policy.maxArtifactBytes,
    });
    const contentSha256 = sha256Bytes(buffer);
    const resolvedArtifactPath = boundedArtifactPath(
      input.libraryRoot,
      record.sourceId,
      record.documentVersion,
      input.inputPath
    );
    const artifactPath = manifestArtifactPath(input.libraryRoot, resolvedArtifactPath);

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
        artifactSafety: record.artifactSafety ?? null,
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
        artifactSafety: null,
        mutated: false,
        failures: [],
      };
    }

    await (dependencies.mkdir ?? mkdir)(dirname(resolvedArtifactPath), { recursive: true });
    stagedArtifactPath = `${resolvedArtifactPath}.importing`;
    await ensureDestinationAbsent(stagedArtifactPath, dependencies);
    await (dependencies.writeFile ?? writeFile)(stagedArtifactPath, buffer, { flag: "wx", mode: 0o600 });
    const copied = await (dependencies.readFile ?? readFile)(stagedArtifactPath);
    const copiedHash = sha256Bytes(Buffer.isBuffer(copied) ? copied : Buffer.from(copied));
    if (copiedHash !== contentSha256) throw new Error("Copied artifact hash verification failed.");
    await moveArtifactNoReplace(stagedArtifactPath, resolvedArtifactPath, dependencies);
    stagedArtifactPath = undefined;
    createdArtifactPath = resolvedArtifactPath;

    const updated: SourceInventoryRecord = {
      ...record,
      status: "acquired",
      acquisition: {
        acquiredAt: nowIso(dependencies),
        artifactPath,
        contentSha256,
        mediaType: structuralInspection.declaredMediaType,
        byteLength: buffer.byteLength,
      },
      artifactSafety: undefined,
      extraction: undefined,
      indexing: undefined,
      failureCodes: undefined,
    };
    const updatedManifest = replaceRecord(manifest, updated, nowIso(dependencies));
    const validation = validateSourceInventory(updatedManifest.records);
    if (!validation.valid) throw new Error(`Updated inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
    await writeInventory(input.inventoryPath, updatedManifest, dependencies);
    createdArtifactPath = undefined;

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
      artifactSafety: null,
      mutated: true,
      failures: [],
    };
  } catch (error) {
    for (const path of [stagedArtifactPath, createdArtifactPath]) {
      if (!path) continue;
      try {
        await (dependencies.unlink ?? unlink)(path);
      } catch {
        // Preserve the primary failure; deterministic staging paths support manual recovery.
      }
    }
    return failureResult("import", input.sourceId, error);
  }
};

type ManagedArtifactRoot = "library" | "quarantine";

interface ResolvedManagedArtifact {
  resolvedPath: string;
  root: ManagedArtifactRoot;
}

const isWithinRoot = (root: string, candidate: string): boolean =>
  candidate === root || candidate.startsWith(`${root}${sep}`);

const resolveManagedArtifact = async (
  artifactPath: string,
  input: InspectLibraryArtifactInput,
  dependencies: DocumentLibraryDependencies
): Promise<ResolvedManagedArtifact> => {
  const resolvedPath = resolve(artifactPath);
  const roots: Array<{ root: ManagedArtifactRoot; resolved: string }> = [
    { root: "library", resolved: resolve(input.libraryRoot) },
    { root: "quarantine", resolved: resolve(input.quarantineRoot) },
  ];
  if (
    dirname(roots[0]!.resolved) === roots[0]!.resolved ||
    dirname(roots[1]!.resolved) === roots[1]!.resolved
  ) {
    throw new ArtifactSafetyError("artifact_root_too_broad", "Managed artifact roots cannot be filesystem roots.");
  }
  if (
    isWithinRoot(roots[0]!.resolved, roots[1]!.resolved) ||
    isWithinRoot(roots[1]!.resolved, roots[0]!.resolved)
  ) {
    throw new ArtifactSafetyError(
      "artifact_roots_overlap",
      "Library and quarantine roots must be separate non-overlapping directories."
    );
  }
  const selected = roots.find((candidate) => isWithinRoot(candidate.resolved, resolvedPath));
  if (!selected) throw new Error("Artifact path is outside the configured library and quarantine roots.");

  const metadata = await (dependencies.lstat ?? lstat)(resolvedPath);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new ArtifactSafetyError("artifact_not_regular_file", "Managed artifact must be a regular non-symlink file.");
  }
  const resolvedRealRoot = await (dependencies.realpath ?? realpath)(selected.resolved);
  const resolvedRealArtifact = await (dependencies.realpath ?? realpath)(resolvedPath);
  if (!isWithinRoot(resolvedRealRoot, resolvedRealArtifact)) {
    throw new Error("Artifact real path escapes its configured managed root.");
  }
  return { resolvedPath, root: selected.root };
};

const quarantineArtifactPath = (
  quarantineRoot: string,
  record: SourceInventoryRecord,
  contentSha256: string
): string => {
  const root = resolve(quarantineRoot);
  const extension = extname(record.acquisition?.artifactPath ?? "").toLowerCase();
  const fileName = `${cleanSegment(record.sourceId)}--${cleanSegment(record.documentVersion)}--${contentSha256.slice(0, 12)}${extension}`;
  const target = resolve(root, cleanSegment(record.sourceId), fileName);
  if (!isWithinRoot(root, target)) throw new Error("Quarantine path escapes the configured root.");
  return target;
};

const cleanSafetyEvidence = (
  inspectedAt: string,
  artifactPath: string,
  contentSha256: string,
  structural: ReturnType<typeof inspectArtifactContent>,
  scan: MalwareScanResult
): SourceInventoryArtifactSafetyEvidence => ({
  inspectedAt,
  artifactPath,
  contentSha256,
  byteLength: structural.byteLength,
  observedContentSha256: contentSha256,
  observedByteLength: structural.byteLength,
  declaredMediaType: structural.declaredMediaType,
  detectedMediaType: structural.detectedMediaType,
  signature: structural.signature,
  scannerEngine: scan.engine,
  scannerVersion: scan.engineVersion,
  ...(scan.definitionsVersion ? { scannerDefinitionsVersion: scan.definitionsVersion } : {}),
  verdict: "clean",
  failureCodes: [],
});

const rejectedSafetyEvidence = (input: {
  inspectedAt: string;
  artifactPath: string;
  contentSha256: string;
  byteLength: number;
  observedContentSha256?: string;
  observedByteLength: number;
  declaredMediaType: string;
  failureCodes: string[];
  structural?: ReturnType<typeof inspectArtifactContent>;
  scan?: MalwareScanResult;
  quarantinePath?: string;
  originalArtifactPath?: string;
}): SourceInventoryArtifactSafetyEvidence => ({
  inspectedAt: input.inspectedAt,
  artifactPath: input.artifactPath,
  contentSha256: input.contentSha256,
  byteLength: input.byteLength,
  ...(input.observedContentSha256 ? { observedContentSha256: input.observedContentSha256 } : {}),
  observedByteLength: input.observedByteLength,
  declaredMediaType: input.structural?.declaredMediaType ?? input.declaredMediaType.trim().toLowerCase(),
  ...(input.structural ? {
    detectedMediaType: input.structural.detectedMediaType,
    signature: input.structural.signature,
  } : {}),
  scannerEngine: input.scan?.engine ?? "not_run",
  scannerVersion: input.scan?.engineVersion ?? "not_available",
  ...(input.scan?.definitionsVersion ? { scannerDefinitionsVersion: input.scan.definitionsVersion } : {}),
  ...(input.scan?.signature ? { malwareSignature: input.scan.signature } : {}),
  verdict: input.scan?.verdict === "infected"
    ? "infected"
    : input.scan?.verdict === "error"
      ? "error"
      : "rejected",
  failureCodes: input.failureCodes,
  ...(input.quarantinePath ? { quarantinePath: input.quarantinePath } : {}),
  ...(input.originalArtifactPath ? { originalArtifactPath: input.originalArtifactPath } : {}),
});

const safetyFailures = (codes: string[]): DocumentLibraryFailure[] => codes.map((code) => ({
  code,
  message: code === "malware_detected"
    ? "Artifact was rejected by the configured malware scanner."
    : "Artifact safety inspection failed closed.",
}));

const resolveScanner = (dependencies: DocumentLibraryDependencies): MalwareScanner | undefined =>
  dependencies.malwareScanner ?? createClamAvScannerFromEnv(dependencies.env);

const ensureDestinationAbsent = async (
  path: string,
  dependencies: DocumentLibraryDependencies
): Promise<void> => {
  try {
    await (dependencies.lstat ?? lstat)(path);
    throw new Error("Managed artifact destination already exists.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

export const inspectLibraryArtifact = async (
  input: InspectLibraryArtifactInput,
  dependencies: DocumentLibraryDependencies = {}
): Promise<DocumentLibraryOperationResult> => {
  let moved: { from: string; to: string } | undefined;
  try {
    const manifest = await readInventory(input.inventoryPath, dependencies);
    const record = findRecord(manifest, input.sourceId);
    if (!record.acquisition) throw new Error("Source has no acquisition evidence.");
    if (!["acquired", "ingestion_pending", "failed"].includes(record.status)) {
      throw new Error(`Source ${record.sourceId} cannot be inspected from status ${record.status}.`);
    }
    if (!record.acquisition.mediaType?.trim()) {
      throw new ArtifactSafetyError("artifact_media_type_missing", "Acquisition evidence has no declared media type.");
    }

    const managed = await resolveManagedArtifact(record.acquisition.artifactPath, input, dependencies);
    const policy = dependencies.artifactSafetyPolicy ?? loadArtifactSafetyPolicy(dependencies.env);
    const metadata = await (dependencies.lstat ?? lstat)(managed.resolvedPath);
    const failureCodes: string[] = [];
    try {
      assertArtifactByteLength(metadata.size, policy.maxArtifactBytes);
    } catch (error) {
      if (!(error instanceof ArtifactSafetyError)) throw error;
      failureCodes.push(error.code);
    }
    if (record.acquisition.byteLength !== undefined && record.acquisition.byteLength !== metadata.size) {
      failureCodes.push("artifact_acquisition_size_mismatch");
    }

    let buffer: Buffer | undefined;
    let observedContentSha256: string | undefined;
    if (metadata.size > 0 && metadata.size <= policy.maxArtifactBytes) {
      const bytes = await (dependencies.readFile ?? readFile)(managed.resolvedPath);
      buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
      observedContentSha256 = sha256Bytes(buffer);
      if (observedContentSha256 !== record.acquisition.contentSha256) {
        failureCodes.push("artifact_acquisition_hash_mismatch");
      }
    }

    let structural: ReturnType<typeof inspectArtifactContent> | undefined;
    let scan: MalwareScanResult | undefined;
    if (buffer && failureCodes.length === 0) {
      try {
        structural = inspectArtifactContent({
          content: buffer,
          sourcePath: record.acquisition.artifactPath,
          declaredMediaType: record.acquisition.mediaType,
          maxArtifactBytes: policy.maxArtifactBytes,
        });
      } catch (error) {
        if (!(error instanceof ArtifactSafetyError)) throw error;
        failureCodes.push(error.code);
      }
    }

    if (structural) {
      try {
        const scanner = resolveScanner(dependencies);
        scan = scanner
          ? await scanVerifiedArtifactSnapshot(buffer!, managed.resolvedPath, scanner)
          : {
              verdict: "error",
              engine: "not_configured",
              engineVersion: "not_available",
              failureCode: "malware_scanner_unconfigured",
            };
      } catch (error) {
        if (error instanceof ArtifactSafetyError) failureCodes.push(error.code);
        scan = {
          verdict: "error",
          engine: "scanner_adapter",
          engineVersion: "unavailable",
          failureCode: "malware_scan_error",
        };
      }
      if (scan.verdict !== "clean") failureCodes.push(scan.failureCode ?? "malware_scan_error");
    }

    if (buffer) {
      const verifiedAgain = await (dependencies.readFile ?? readFile)(managed.resolvedPath);
      const verifiedBuffer = Buffer.isBuffer(verifiedAgain) ? verifiedAgain : Buffer.from(verifiedAgain);
      const verifiedHash = sha256Bytes(verifiedBuffer);
      if (verifiedHash !== observedContentSha256 || verifiedBuffer.byteLength !== buffer.byteLength) {
        failureCodes.push("artifact_changed_during_scan");
        buffer = verifiedBuffer;
        observedContentSha256 = verifiedHash;
      }
    }

    const inspectedAt = nowIso(dependencies);
    if (buffer && observedContentSha256 && structural && scan?.verdict === "clean" && failureCodes.length === 0) {
      let activeArtifactPath = record.acquisition.artifactPath;
      if (managed.root === "quarantine") {
        const originalArtifactPath = record.artifactSafety?.originalArtifactPath;
        if (!originalArtifactPath) throw new Error("Quarantined artifact has no bounded original path for retry.");
        const resolvedOriginal = resolve(originalArtifactPath);
        const resolvedLibraryRoot = resolve(input.libraryRoot);
        if (!isWithinRoot(resolvedLibraryRoot, resolvedOriginal)) {
          throw new Error("Quarantine retry destination escapes the configured library root.");
        }
        if (!input.dryRun) {
          await (dependencies.mkdir ?? mkdir)(dirname(resolvedOriginal), { recursive: true });
          await moveArtifactNoReplace(managed.resolvedPath, resolvedOriginal, dependencies);
          moved = { from: managed.resolvedPath, to: resolvedOriginal };
        }
        activeArtifactPath = originalArtifactPath;
      }

      const artifactSafety = cleanSafetyEvidence(
        inspectedAt,
        activeArtifactPath,
        observedContentSha256,
        structural,
        scan
      );
      if (input.dryRun) {
        return {
          operation: "inspect",
          status: "planned",
          sourceId: record.sourceId,
          documentKey: record.documentKey,
          documentVersion: record.documentVersion,
          artifactPath: activeArtifactPath,
          contentSha256: observedContentSha256,
          sectionCount: record.extraction?.sectionCount ?? 0,
          chunkCount: record.indexing?.chunkCount ?? 0,
          artifactSafety,
          mutated: false,
          failures: [],
        };
      }

      const updated: SourceInventoryRecord = {
        ...record,
        status: "acquired",
        acquisition: {
          ...record.acquisition,
          artifactPath: activeArtifactPath,
          byteLength: buffer.byteLength,
        },
        artifactSafety,
        failureCodes: undefined,
      };
      const updatedManifest = replaceRecord(manifest, updated, inspectedAt);
      const validation = validateSourceInventory(updatedManifest.records);
      if (!validation.valid) throw new Error(`Updated inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
      await writeInventory(input.inventoryPath, updatedManifest, dependencies);
      moved = undefined;
      return {
        operation: "inspect",
        status: "accepted",
        sourceId: updated.sourceId,
        documentKey: updated.documentKey,
        documentVersion: updated.documentVersion,
        artifactPath: updated.acquisition?.artifactPath ?? null,
        contentSha256: observedContentSha256,
        sectionCount: updated.extraction?.sectionCount ?? 0,
        chunkCount: updated.indexing?.chunkCount ?? 0,
        artifactSafety,
        mutated: true,
        failures: [],
      };
    }

    const originalArtifactPath = managed.root === "library"
      ? record.acquisition.artifactPath
      : record.artifactSafety?.originalArtifactPath;
    const observedByteLength = buffer?.byteLength ?? metadata.size;
    const quarantineIdentityHash = observedContentSha256 ?? record.acquisition.contentSha256;
    const expectedByteLength = record.acquisition.byteLength ?? metadata.size;
    const resolvedQuarantinePath = managed.root === "quarantine"
      ? managed.resolvedPath
      : quarantineArtifactPath(input.quarantineRoot, record, quarantineIdentityHash);
    const quarantinePath = manifestArtifactPath(input.quarantineRoot, resolvedQuarantinePath);
    const artifactSafety = rejectedSafetyEvidence({
      inspectedAt,
      artifactPath: quarantinePath,
      contentSha256: record.acquisition.contentSha256,
      byteLength: expectedByteLength,
      ...(observedContentSha256 ? { observedContentSha256 } : {}),
      observedByteLength,
      declaredMediaType: record.acquisition.mediaType,
      failureCodes,
      ...(structural ? { structural } : {}),
      ...(scan ? { scan } : {}),
      quarantinePath,
      ...(originalArtifactPath ? { originalArtifactPath } : {}),
    });
    const failures = safetyFailures(failureCodes);
    if (input.dryRun) {
      return {
        operation: "inspect",
        status: "planned",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        documentVersion: record.documentVersion,
        artifactPath: record.acquisition.artifactPath,
        contentSha256: quarantineIdentityHash,
        sectionCount: record.extraction?.sectionCount ?? 0,
        chunkCount: record.indexing?.chunkCount ?? 0,
        artifactSafety,
        mutated: false,
        failures,
      };
    }

    if (managed.root === "library") {
      await (dependencies.mkdir ?? mkdir)(dirname(resolvedQuarantinePath), { recursive: true });
      await moveArtifactNoReplace(managed.resolvedPath, resolvedQuarantinePath, dependencies);
      moved = { from: managed.resolvedPath, to: resolvedQuarantinePath };
    }
    const updated: SourceInventoryRecord = {
      ...record,
      status: "failed",
      acquisition: {
        ...record.acquisition,
        artifactPath: quarantinePath,
        byteLength: expectedByteLength,
      },
      artifactSafety,
      extraction: undefined,
      indexing: undefined,
      failureCodes,
    };
    const updatedManifest = replaceRecord(manifest, updated, inspectedAt);
    const validation = validateSourceInventory(updatedManifest.records);
    if (!validation.valid) throw new Error(`Updated inventory is invalid: ${validation.failures.map((item) => item.code).join(", ")}.`);
    await writeInventory(input.inventoryPath, updatedManifest, dependencies);
    moved = undefined;
    return {
      operation: "inspect",
      status: "quarantined",
      sourceId: updated.sourceId,
      documentKey: updated.documentKey,
      documentVersion: updated.documentVersion,
      artifactPath: quarantinePath,
      contentSha256: quarantineIdentityHash,
      sectionCount: 0,
      chunkCount: 0,
      artifactSafety,
      mutated: true,
      failures,
    };
  } catch (error) {
    if (moved) {
      try {
        await moveArtifactNoReplace(moved.to, moved.from, dependencies);
      } catch {
        // The deterministic paths make manual recovery possible; preserve the original failure.
      }
    }
    return failureResult("inspect", input.sourceId, error);
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

    if (!hasCleanArtifactSafety(record)) {
      throw new ArtifactSafetyError(
        "artifact_safety_not_accepted",
        "Source requires matching clean artifact safety evidence before extraction."
      );
    }
    const policy = dependencies.artifactSafetyPolicy ?? loadArtifactSafetyPolicy(dependencies.env);
    const inspectedAt = Date.parse(record.artifactSafety!.inspectedAt);
    const currentTime = (dependencies.now ?? (() => new Date()))().getTime();
    if (!Number.isFinite(inspectedAt) || inspectedAt > currentTime || currentTime - inspectedAt > policy.malwareScanMaxAgeMs) {
      throw new ArtifactSafetyError(
        "artifact_safety_evidence_stale",
        "Artifact malware scan evidence is missing, future-dated, or stale."
      );
    }

    const artifactMetadata = await (dependencies.lstat ?? lstat)(record.acquisition.artifactPath);
    if (!artifactMetadata.isFile() || artifactMetadata.isSymbolicLink()) {
      throw new ArtifactSafetyError("artifact_not_regular_file", "Managed artifact must be a regular non-symlink file.");
    }
    assertArtifactByteLength(artifactMetadata.size, policy.maxArtifactBytes);
    if (
      artifactMetadata.size !== record.acquisition.byteLength ||
      artifactMetadata.size !== record.artifactSafety!.byteLength
    ) {
      throw new ArtifactSafetyError(
        "artifact_safety_size_mismatch",
        "Artifact size does not match accepted safety evidence."
      );
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
        artifactSafety: record.artifactSafety ?? null,
        mutated: false,
        failures: [],
      };
    }
    if (existing && existing.documentVersion === record.documentVersion && existing.contentSha256 !== contentSha256) {
      throw new Error("Operational manifest contains a conflicting hash for this document version.");
    }

    const extract = dependencies.extractDocument ?? defaultExtractDocument;
    const document = await extract(record.acquisition.artifactPath, record.title, buffer);
    const sectionCount = document.sections.length;
    if (!Number.isInteger(sectionCount) || sectionCount <= 0) throw new Error("Extraction produced no sections.");
    const domainMetadata = sourceInventoryRecordToDomainMetadata(record);
    const documentForIndexing: NormalizedDocument = {
      ...document,
      metadata: {
        ...document.metadata,
        ...domainMetadata,
        sourcePath: record.acquisition.artifactPath,
      },
    };

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
        artifactSafety: record.artifactSafety ?? null,
        mutated: false,
        failures: [],
      };
    }

    const indexedAt = nowIso(dependencies);
    const index = dependencies.indexVectorSource ?? indexVectorSource;
    const indexing = await index({
      inputPath: record.acquisition.artifactPath,
      content: buffer,
      document: documentForIndexing,
      title: record.title,
      documentKey: record.documentKey,
      documentVersion: record.documentVersion,
      metadata: domainMetadata,
    });
    if (indexing.status !== "indexed" || indexing.chunksPlanned <= 0 || indexing.failures.length > 0) {
      const failure = indexing.failures[0];
      throw new IngestionError(
        failure?.code ?? "vector_indexing_failed",
        document.sourceFormat,
        `Indexing failed: ${indexing.failures.map((item) => item.code).join(", ") || indexing.status}.`,
        { retryable: failure?.retryable ?? false }
      );
    }

    const runtime = resolveRuntimeMetadata(dependencies);
    const corpusRecord = operationalRecord(record, indexing, runtime, indexedAt);
    await store.put(corpusRecord);

    const updated: SourceInventoryRecord = {
      ...record,
      status: "ingested",
      extraction: {
        extractedAt: indexedAt,
        extractor: typeof document.metadata.extractor === "string"
          ? document.metadata.extractor
          : "registry",
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
      artifactSafety: updated.artifactSafety ?? null,
      mutated: true,
      failures: [],
    };
  } catch (error) {
    return failureResult("ingest", input.sourceId, error);
  }
};

export const formatDocumentLibraryOperationResult = (result: DocumentLibraryOperationResult): string =>
  JSON.stringify(result, null, 2);
