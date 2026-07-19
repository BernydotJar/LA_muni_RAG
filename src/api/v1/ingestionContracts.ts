import type { ValidateFunction } from "ajv";
import { loadIntegrationContractRegistry } from "../../cli/validateIntegrationContracts.js";
import type { IngestionJobContractValidators } from "./ingestionTypes.js";

const requiredValidator = (
  schemas: Awaited<ReturnType<typeof loadIntegrationContractRegistry>>["schemasByFile"],
  fileName: string
): ValidateFunction => {
  const validator = schemas.get(fileName)?.validate;
  if (!validator) throw new Error(`Required integration contract is unavailable: ${fileName}`);
  return validator;
};

export const loadIngestionJobContractValidators = async (
  projectRoot = process.cwd()
): Promise<IngestionJobContractValidators> => {
  const registry = await loadIntegrationContractRegistry(projectRoot);
  return {
    request: requiredValidator(registry.schemasByFile, "ingestion-job-request.schema.json"),
    response: requiredValidator(registry.schemasByFile, "ingestion-job-response.schema.json"),
    apiError: requiredValidator(registry.schemasByFile, "api-error.schema.json"),
  };
};
