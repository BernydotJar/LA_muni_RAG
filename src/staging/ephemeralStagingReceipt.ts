import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import type { EphemeralStagingReceipt } from "./ephemeralStagingRunner.js";

const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as FormatsPlugin;
export const EPHEMERAL_STAGING_RECEIPT_SCHEMA_PATH = "contracts/staging/v1/ephemeral-staging-receipt.schema.json";

export interface StagingReceiptValidationResult {
  status: "valid" | "invalid";
  issues: string[];
}

const FORBIDDEN_SERIALIZED = /password|database_url|authorization|cookie|bearer\s|secret[_-]?token|postgresql:\/\//i;

export const validateEphemeralStagingReceipt = async (
  receipt: EphemeralStagingReceipt,
  projectRoot = process.cwd()
): Promise<StagingReceiptValidationResult> => {
  const schema = JSON.parse(await readFile(resolve(projectRoot, EPHEMERAL_STAGING_RECEIPT_SCHEMA_PATH), "utf8"));
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const issues: string[] = [];
  if (!validate(receipt)) {
    issues.push(...(validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`));
  }
  const phaseNames = receipt.phases.map((phase) => phase.name);
  if (new Set(phaseNames).size !== phaseNames.length) issues.push("duplicate_phase");
  const journeyIds = receipt.journeys.map((journey) => journey.id);
  if (new Set(journeyIds).size !== journeyIds.length) issues.push("duplicate_journey");
  if (Date.parse(receipt.finished_at) < Date.parse(receipt.started_at)) issues.push("invalid_time_order");
  if (receipt.status === "passed") {
    if (receipt.journeys.some((journey) => journey.status !== "passed")) issues.push("passed_receipt_has_incomplete_journey");
    if (!receipt.cleanup.complete || receipt.cleanup.databases_destroyed !== 4 || receipt.cleanup.roles_destroyed !== 3) issues.push("passed_receipt_has_incomplete_cleanup");
    if (receipt.phases.some((phase) => phase.status !== "passed")) issues.push("passed_receipt_has_incomplete_phase");
  }
  if (FORBIDDEN_SERIALIZED.test(JSON.stringify(receipt))) issues.push("sensitive_material_in_receipt");
  return { status: issues.length === 0 ? "valid" : "invalid", issues: [...new Set(issues)].sort() };
};
