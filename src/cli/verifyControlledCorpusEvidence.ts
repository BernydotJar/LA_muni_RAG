import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  reconcileSourceInventoryWithCorpusManifest,
  type SourceInventoryManifestFile,
} from "../sources/sourceInventoryManifest.js";
import { validateSourceInventory } from "../sources/sourceInventory.js";
import type { CorpusManifestRecord } from "../ingestion/corpusManifest.js";

interface ConfigSource {
  sourceId: string;
  documentKey: string;
  documentVersion: string;
  expectedSha256: string;
  expectedByteLength: number;
}
interface ControlledConfig { schemaVersion: number; sources: ConfigSource[]; }
interface ReceiptSource {
  sourceId: string;
  documentKey: string;
  documentVersion: string;
  contentSha256: string;
  byteLength: number;
  ingestionStatus: "ingested" | "blocked_no_text";
  sectionCount: number;
  chunkCount: number;
  failureCode: string | null;
  scanner: { engine: string; version: string; definitionsVersion: string; inspectedAt: string };
  acceptance: { artifactObjectId: string; artifactScanId: string };
  jobId: string;
}
interface ControlledReceipt {
  schemaVersion: number;
  corpusKind: string;
  sources: ReceiptSource[];
  database: {
    postgresVersion: string;
    pgvectorVersion: string;
    runtimeRoleNonOwner: boolean;
    runtimeRoleNoBypassRls: boolean;
    forcedRlsTables: number;
    disposable: boolean;
  };
  embedding: { provider: string; model: string; dimension: number; semanticClaim: boolean };
  rawBytesCommittedToGit: boolean;
  productionObjectStoreClaim: boolean;
  legalValidityClaim: boolean;
  corpusCompletenessClaim: boolean;
}
interface EvidenceManifest { schemaVersion: number; records: CorpusManifestRecord[]; }

const CONFIG_PATH = "evals/real-corpus/controlled-ingestion-config.json";
const RECEIPT_PATH = "evals/real-corpus/results/controlled-ingestion-receipt.json";
const MANIFEST_PATH = "evals/real-corpus/controlled-corpus-manifest.json";
const DEFAULT_ADDITIONAL_MANIFEST_PATHS = ["evals/real-corpus/official-expansion-manifest.json"];
const INVENTORY_PATH = ".rag/source-inventory.json";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const load = async <T>(path: string): Promise<T> => JSON.parse(await readFile(path, "utf8")) as T;
const fail = (message: string): never => { throw new Error(message); };

const main = async (): Promise<void> => {
  const additionalManifestPaths = (process.env.CONTROLLED_CORPUS_ADDITIONAL_MANIFEST_PATHS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? DEFAULT_ADDITIONAL_MANIFEST_PATHS);
  const [config, receipt, manifest, inventory, additionalManifests] = await Promise.all([
    load<ControlledConfig>(CONFIG_PATH),
    load<ControlledReceipt>(RECEIPT_PATH),
    load<EvidenceManifest>(MANIFEST_PATH),
    load<SourceInventoryManifestFile>(INVENTORY_PATH),
    Promise.all(additionalManifestPaths.map((path) => load<EvidenceManifest>(path))),
  ]);
  if (config.schemaVersion !== 1 || config.sources.length !== 2) fail("Controlled config identity is invalid.");
  if (receipt.schemaVersion !== 1 || receipt.corpusKind !== "controlled_real_public_municipal_v1" || receipt.sources.length !== 2) {
    fail("Controlled ingestion receipt is invalid.");
  }
  if (manifest.schemaVersion !== 1 || manifest.records.length !== 1) fail("Controlled corpus evidence manifest is invalid.");
  if (additionalManifests.some((additional) => additional.schemaVersion !== 1)) {
    fail("An additional operational corpus manifest is invalid.");
  }
  const operationalRecords = [manifest, ...additionalManifests].flatMap((item) => item.records);
  const operationalKeys = operationalRecords.map((record) => record.documentKey);
  if (new Set(operationalKeys).size !== operationalKeys.length) {
    fail("Operational corpus manifests contain duplicate document keys.");
  }

  const configured = new Map(config.sources.map((source) => [source.sourceId, source]));
  const manifested = new Map(manifest.records.map((record) => [record.documentKey, record]));
  for (const source of receipt.sources) {
    const expected = configured.get(source.sourceId) ?? fail(`Unexpected source ${source.sourceId}.`);
    if (
      source.documentKey !== expected.documentKey || source.documentVersion !== expected.documentVersion ||
      source.contentSha256 !== expected.expectedSha256 || source.byteLength !== expected.expectedByteLength
    ) fail(`Receipt identity mismatch for ${source.sourceId}.`);
    const record = manifested.get(source.documentKey);
    if (source.ingestionStatus === "ingested") {
      if (
        !record || source.failureCode !== null || source.sectionCount < 1 || source.chunkCount < 1 ||
        source.chunkCount !== record.chunkCount || record.contentSha256 !== expected.expectedSha256 ||
        record.documentVersion !== expected.documentVersion || record.status !== "indexed" ||
        record.embeddingProvider !== "local-eval-hashing" || record.embeddingModel !== "token-bigram-hash-1536-v1" ||
        record.embeddingDimension !== 1536
      ) fail(`Ingested receipt or manifest identity mismatch for ${source.sourceId}.`);
    } else if (
      source.ingestionStatus !== "blocked_no_text" || source.failureCode !== "pdf_no_extractable_text" ||
      source.sectionCount !== 0 || source.chunkCount !== 0 || record
    ) fail(`Blocked extraction evidence mismatch for ${source.sourceId}.`);
    if (
      source.scanner.engine !== "clamav" || !source.scanner.version || !source.scanner.definitionsVersion ||
      !Number.isFinite(Date.parse(source.scanner.inspectedAt)) || !UUID.test(source.acceptance.artifactObjectId) ||
      !UUID.test(source.acceptance.artifactScanId) || !UUID.test(source.jobId)
    ) fail(`Scanner, acceptance or job evidence is incomplete for ${source.sourceId}.`);
  }

  const validation = validateSourceInventory(inventory.records);
  const reconciliation = reconcileSourceInventoryWithCorpusManifest(inventory.records, operationalRecords);
  if (!validation.valid || !reconciliation.valid) {
    fail(`Inventory evidence is invalid: ${JSON.stringify([...validation.failures, ...reconciliation.failures])}`);
  }
  const controlled = inventory.records.filter((record) => configured.has(record.sourceId));
  const ingested = controlled.filter((record) => record.status === "ingested");
  const blocked = controlled.filter((record) => record.status === "failed" && record.failureCodes?.includes("pdf_no_extractable_text"));
  if (controlled.length !== 2 || ingested.length !== 1 || blocked.length !== 1 || controlled.some((record) => record.artifactSafety?.verdict !== "clean")) {
    fail("Controlled inventory must contain one clean ingested source and one clean no-text extraction blocker.");
  }

  if (
    !receipt.database.runtimeRoleNonOwner || !receipt.database.runtimeRoleNoBypassRls ||
    receipt.database.forcedRlsTables !== 5 || !receipt.database.disposable ||
    !receipt.database.postgresVersion || !receipt.database.pgvectorVersion ||
    receipt.embedding.provider !== "local-eval-hashing" || receipt.embedding.model !== "token-bigram-hash-1536-v1" ||
    receipt.embedding.dimension !== 1536 || receipt.embedding.semanticClaim !== false ||
    receipt.rawBytesCommittedToGit !== false || receipt.productionObjectStoreClaim !== false ||
    receipt.legalValidityClaim !== false || receipt.corpusCompletenessClaim !== false
  ) fail("Controlled corpus limitations or database controls are invalid.");

  const trackedRaw = execFileSync("git", ["ls-files", "--", ".rag/library", "data/raw", "artifacts"], { encoding: "utf8" }).trim();
  if (trackedRaw) fail("Raw controlled corpus bytes or legacy extraction artifacts must not be committed.");

  process.stdout.write(`${JSON.stringify({
    status: "pass",
    sources: receipt.sources.length,
    ingestedSources: receipt.sources.filter((source) => source.ingestionStatus === "ingested").length,
    blockedNoTextSources: receipt.sources.filter((source) => source.ingestionStatus === "blocked_no_text").length,
    sections: receipt.sources.reduce((sum, source) => sum + source.sectionCount, 0),
    chunks: receipt.sources.reduce((sum, source) => sum + source.chunkCount, 0),
    postgresVersion: receipt.database.postgresVersion,
    pgvectorVersion: receipt.database.pgvectorVersion,
    embeddingProvider: receipt.embedding.provider,
    operationalManifests: 1 + additionalManifests.length,
    operationalRecords: operationalRecords.length,
    semanticClaim: false,
  }, null, 2)}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Controlled corpus evidence verification failed."}\n`);
  process.exitCode = 1;
});
