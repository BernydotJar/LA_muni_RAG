import { readFile } from "node:fs/promises";
import type { CorpusManifestRecord } from "../ingestion/corpusManifest.js";
import {
  summarizeSourceInventory,
  validateSourceInventory,
  type SourceInventoryRecord,
  type SourceInventorySummary,
  type SourceInventoryValidationFailure,
  type SourceInventoryValidationResult,
} from "./sourceInventory.js";

export interface SourceInventoryManifestFile {
  schemaVersion: 1;
  targetJurisdiction: string;
  generatedAt: string;
  records: SourceInventoryRecord[];
}

export type SourceInventoryReconciliationCode =
  | "ingested_record_missing_operational_manifest"
  | "operational_version_mismatch"
  | "operational_hash_mismatch"
  | "operational_record_not_indexed"
  | "operational_record_has_no_chunks"
  | "operational_manifest_without_inventory_acquisition";

export interface SourceInventoryReconciliationFailure {
  code: SourceInventoryReconciliationCode;
  sourceId?: string;
  documentKey: string;
  message: string;
}

export interface SourceInventoryReconciliationResult {
  valid: boolean;
  failures: SourceInventoryReconciliationFailure[];
}

export interface LoadedSourceInventory {
  manifest: SourceInventoryManifestFile;
  validation: SourceInventoryValidationResult;
  summary: SourceInventorySummary;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseSourceInventoryManifest = (content: string): SourceInventoryManifestFile => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new Error("Source inventory manifest contains invalid JSON.");
  }

  if (!isObject(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.records)) {
    throw new Error("Source inventory manifest must use schemaVersion 1 and contain records.");
  }
  if (typeof parsed.targetJurisdiction !== "string" || !parsed.targetJurisdiction.trim()) {
    throw new Error("Source inventory manifest targetJurisdiction is required.");
  }
  if (typeof parsed.generatedAt !== "string" || !parsed.generatedAt.trim()) {
    throw new Error("Source inventory manifest generatedAt is required.");
  }

  return {
    schemaVersion: 1,
    targetJurisdiction: parsed.targetJurisdiction,
    generatedAt: parsed.generatedAt,
    records: parsed.records as SourceInventoryRecord[],
  };
};

export const loadSourceInventoryManifest = async (path: string): Promise<LoadedSourceInventory> => {
  const manifest = parseSourceInventoryManifest(await readFile(path, "utf-8"));
  const validation = validateSourceInventory(manifest.records);
  return {
    manifest,
    validation,
    summary: summarizeSourceInventory(manifest.records),
  };
};

const reconciliationFailure = (
  code: SourceInventoryReconciliationCode,
  record: SourceInventoryRecord,
  message: string
): SourceInventoryReconciliationFailure => ({
  code,
  sourceId: record.sourceId,
  documentKey: record.documentKey,
  message,
});

export const reconcileSourceInventoryWithCorpusManifest = (
  inventory: SourceInventoryRecord[],
  operational: CorpusManifestRecord[]
): SourceInventoryReconciliationResult => {
  const failures: SourceInventoryReconciliationFailure[] = [];
  const operationalByKey = new Map(operational.map((record) => [record.documentKey, record]));
  const inventoryByKey = new Map(inventory.map((record) => [record.documentKey, record]));

  for (const record of inventory) {
    if (record.status !== "ingested") continue;
    const indexed = operationalByKey.get(record.documentKey);
    if (!indexed) {
      failures.push(reconciliationFailure(
        "ingested_record_missing_operational_manifest",
        record,
        "Ingested inventory record has no operational corpus manifest entry."
      ));
      continue;
    }
    if (indexed.documentVersion !== record.documentVersion) {
      failures.push(reconciliationFailure("operational_version_mismatch", record, "Operational version does not match inventory version."));
    }
    if (indexed.contentSha256 !== record.acquisition?.contentSha256) {
      failures.push(reconciliationFailure("operational_hash_mismatch", record, "Operational content hash does not match acquired artifact hash."));
    }
    if (indexed.status !== "indexed") {
      failures.push(reconciliationFailure("operational_record_not_indexed", record, "Operational manifest record is not indexed."));
    }
    if (indexed.chunkCount <= 0) {
      failures.push(reconciliationFailure("operational_record_has_no_chunks", record, "Operational manifest record has no indexed chunks."));
    }
  }

  for (const indexed of operational) {
    const record = inventoryByKey.get(indexed.documentKey);
    if (!record) continue;
    if (indexed.status === "indexed" && !record.acquisition) {
      failures.push({
        code: "operational_manifest_without_inventory_acquisition",
        sourceId: record.sourceId,
        documentKey: record.documentKey,
        message: "Indexed operational record lacks acquisition evidence in source inventory.",
      });
    }
  }

  return { valid: failures.length === 0, failures };
};

export const combineInventoryValidation = (
  validation: SourceInventoryValidationResult,
  reconciliation: SourceInventoryReconciliationResult
): SourceInventoryValidationResult => {
  const reconciliationFailures: SourceInventoryValidationFailure[] = reconciliation.failures.map((item) => ({
    code: "invalid_record",
    sourceId: item.sourceId,
    message: `${item.code}: ${item.message}`,
  }));
  const failures = [...validation.failures, ...reconciliationFailures];
  return { valid: failures.length === 0, failures };
};
