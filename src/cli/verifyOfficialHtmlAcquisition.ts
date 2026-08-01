import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { validateSourceInventory } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";
import type { HtmlAcquisitionReceipt } from "../sources/htmlAcquisition.js";

const value = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const hash = (content: Buffer): string => createHash("sha256").update(content).digest("hex");

const libraryPath = (root: string, inventoryPath: string): string => {
  if (!inventoryPath.startsWith(".rag/library/")) throw new Error(`Artifact path is outside .rag/library: ${inventoryPath}`);
  const result = resolve(root, ...inventoryPath.slice(".rag/library/".length).split("/"));
  const fromRoot = relative(root, result);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error(`Artifact path escaped library root: ${inventoryPath}`);
  return result;
};

const receiptPath = value("--receipt") ?? "program/reports/2026-08-01-official-source-acquisition.json";
const inventoryPath = value("--inventory") ?? ".rag/source-inventory.json";
const libraryRoot = value("--library-root") ?? process.env.SOURCE_PACK_LIBRARY_ROOT;
if (libraryRoot && !isAbsolute(libraryRoot)) throw new Error("libraryRoot must be absolute when supplied.");

const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as HtmlAcquisitionReceipt;
const inventory = parseSourceInventoryManifest(await readFile(inventoryPath, "utf8"));
const inventoryValidation = validateSourceInventory(inventory.records);
if (!inventoryValidation.valid) throw new Error(inventoryValidation.failures.map((item) => `${item.sourceId ?? "inventory"}: ${item.message}`).join("\n"));
if (receipt.schemaVersion !== 1 || receipt.attempted !== receipt.sources.length) throw new Error("Invalid acquisition receipt shape.");
if (receipt.result !== "pass" || receipt.successful < receipt.minimumSuccessfulSources) throw new Error("Acquisition receipt did not reach the configured threshold.");
if (receipt.successful + receipt.blocked !== receipt.attempted) throw new Error("Acquisition receipt counts do not reconcile.");
if (receipt.managedCorpusMutation || receipt.indexingPerformed) throw new Error("Acquisition receipt claims an unauthorized corpus mutation or indexing action.");

const records = new Map(inventory.records.map((record) => [record.sourceId, record]));
let verifiedBytes = 0;
for (const item of receipt.sources) {
  const record = records.get(item.sourceId);
  if (!record) throw new Error(`Receipt source ${item.sourceId} is missing from inventory.`);
  if (item.outcome === "blocked") {
    if (!item.failureCode || !item.failureMessage) throw new Error(`Blocked source ${item.sourceId} lacks stable failure evidence.`);
    if (item.inventoryStatusBefore !== item.inventoryStatusAfter || record.status !== item.inventoryStatusAfter) {
      throw new Error(`Blocked source ${item.sourceId} changed lifecycle state.`);
    }
    if (["verified", "acquisition_pending"].includes(record.status) && (record.acquisition || record.artifactSafety || record.extraction || record.indexing)) {
      throw new Error(`Blocked discovery source ${item.sourceId} has acquisition lifecycle evidence.`);
    }
    continue;
  }
  if (item.inventoryStatusAfter !== "ingestion_pending" || record.status !== "ingestion_pending" || record.indexing) throw new Error(`Acquired source ${item.sourceId} has invalid lifecycle state.`);
  if (!item.contentSha256 || !item.artifactPath || !item.extractionPath || !item.byteLength || !item.scanner?.definitionsVersion) {
    throw new Error(`Acquired source ${item.sourceId} lacks complete receipt evidence.`);
  }
  if (record.acquisition?.contentSha256 !== item.contentSha256 || record.acquisition.byteLength !== item.byteLength || record.acquisition.artifactPath !== item.artifactPath) {
    throw new Error(`Inventory acquisition evidence does not match receipt for ${item.sourceId}.`);
  }
  if (record.artifactSafety?.verdict !== "clean" || record.artifactSafety.observedContentSha256 !== item.contentSha256 || record.artifactSafety.scannerDefinitionsVersion !== item.scanner.definitionsVersion) {
    throw new Error(`Inventory scan evidence does not match receipt for ${item.sourceId}.`);
  }
  if (record.extraction?.outputPath !== item.extractionPath || record.extraction.sectionCount !== item.sectionCount) {
    throw new Error(`Inventory extraction evidence does not match receipt for ${item.sourceId}.`);
  }
  if (!libraryRoot) continue;
  const root = resolve(libraryRoot);
  const artifact = libraryPath(root, item.artifactPath);
  const extraction = libraryPath(root, item.extractionPath);
  const bytes = await readFile(artifact);
  if (bytes.length !== item.byteLength || hash(bytes) !== item.contentSha256) throw new Error(`Immutable bytes do not match receipt for ${item.sourceId}.`);
  if (((await stat(artifact)).mode & 0o777) !== 0o600) throw new Error(`Artifact mode is not 0600 for ${item.sourceId}.`);
  const extracted = JSON.parse(await readFile(extraction, "utf8")) as { sourceId?: string; contentSha256?: string; document?: { sections?: unknown[]; text?: string } };
  if (extracted.sourceId !== item.sourceId || extracted.contentSha256 !== item.contentSha256 || extracted.document?.sections?.length !== item.sectionCount) {
    throw new Error(`Extraction file does not match receipt for ${item.sourceId}.`);
  }
  if (/\b(?:<script|steal\(|javascript:)/i.test(extracted.document?.text ?? "")) throw new Error(`Executable content survived extraction for ${item.sourceId}.`);
  verifiedBytes += bytes.length;
}

console.log(JSON.stringify({
  status: "pass",
  acquisitionId: receipt.acquisitionId,
  attempted: receipt.attempted,
  successful: receipt.successful,
  blocked: receipt.blocked,
  inventoryRecords: inventory.records.length,
  verifiedBytes,
  libraryVerified: Boolean(libraryRoot),
}));
