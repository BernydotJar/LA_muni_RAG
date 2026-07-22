import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import type { CatalogValidators } from "./catalogTypes.js";

const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule
) as FormatsPlugin;
const schemaDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../contracts/schemas/v1"
);
const required = (validators: Map<string, ValidateFunction>, file: string): ValidateFunction => {
  const validator = validators.get(file);
  if (!validator) throw new Error(`Missing compiled catalog schema: ${file}`);
  return validator;
};

export const loadCatalogValidators = async (): Promise<CatalogValidators> => {
  const ajv = new Ajv2020({ allErrors: true, strict: true, validateFormats: true });
  addFormats(ajv);
  const files = (await readdir(schemaDirectory)).filter((file) => file.endsWith(".schema.json")).sort();
  const schemas = new Map<string, Record<string, unknown>>();
  for (const file of files) {
    const schema = JSON.parse(await readFile(join(schemaDirectory, file), "utf8")) as Record<string, unknown>;
    schemas.set(file, schema);
    ajv.addSchema(schema);
  }
  const validators = new Map<string, ValidateFunction>();
  for (const [file, schema] of schemas) {
    const id = schema.$id;
    if (typeof id !== "string") throw new Error(`Schema ${file} has no $id`);
    const validator = ajv.getSchema(id);
    if (!validator) throw new Error(`Schema ${file} did not compile`);
    validators.set(file, validator);
  }
  return {
    sourceRequest: required(validators, "source-create-request.schema.json"),
    sourceResponse: required(validators, "source-response.schema.json"),
    sourcePage: required(validators, "source-list-response.schema.json"),
    documentRequest: required(validators, "document-create-request.schema.json"),
    documentResponse: required(validators, "document-response.schema.json"),
    documentPage: required(validators, "document-list-response.schema.json"),
    ingestionJobPage: required(validators, "ingestion-job-list-response.schema.json"),
    procedurePage: required(validators, "procedure-list-response.schema.json"),
    apiError: required(validators, "api-error.schema.json"),
  };
};
