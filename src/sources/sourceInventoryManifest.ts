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

