import type { ErrorObject, ValidateFunction } from "ajv";
import { loadIntegrationContractRegistry } from "../../cli/validateIntegrationContracts.js";
import type {
  ApiErrorDetailV1,
  ProcedureQueryContractValidators,
} from "./types.js";
import type { ClaimPackContractValidators } from "./claimPackTypes.js";

const requiredValidator = (
  schemas: Awaited<ReturnType<typeof loadIntegrationContractRegistry>>["schemasByFile"],
  fileName: string
): ValidateFunction => {
  const validator = schemas.get(fileName)?.validate;
  if (!validator) throw new Error(`Required integration contract is unavailable: ${fileName}`);
  return validator;
};

/**
 * The endpoint consumes the canonical contract registry. It deliberately does
 * not duplicate or relax any JSON Schema in application code.
 */
export const loadProcedureQueryContractValidators = async (
  projectRoot = process.cwd()
): Promise<ProcedureQueryContractValidators> => {
  const registry = await loadIntegrationContractRegistry(projectRoot);
  return {
    request: requiredValidator(registry.schemasByFile, "procedure-query-request.schema.json"),
    evidenceBundle: requiredValidator(registry.schemasByFile, "evidence-bundle.schema.json"),
    workflow: requiredValidator(registry.schemasByFile, "procedure-workflow.schema.json"),
    apiError: requiredValidator(registry.schemasByFile, "api-error.schema.json"),
  };
};

const fieldForError = (error: ErrorObject): string => {
  if (error.keyword === "additionalProperties") {
    const property = (error.params as { additionalProperty?: unknown }).additionalProperty;
    if (typeof property === "string" && property.length > 0) {
      return `${error.instancePath || ""}/${property}` || "/";
    }
  }
  return error.instancePath || "/";
};

/** Values are never included: only schema paths and validator-owned messages. */
export const validationDetails = (
  errors: ErrorObject[] | null | undefined
): ApiErrorDetailV1[] =>
  (errors ?? []).slice(0, 16).map((error) => ({
    field: fieldForError(error).slice(0, 300),
    issue: (error.message ?? error.keyword).slice(0, 1000),
  }));

export const loadClaimPackContractValidators = async (
  projectRoot = process.cwd()
): Promise<ClaimPackContractValidators> => {
  const registry = await loadIntegrationContractRegistry(projectRoot);
  return {
    request: requiredValidator(registry.schemasByFile, "claim-pack-request.schema.json"),
    claimPack: requiredValidator(registry.schemasByFile, "claim-pack.schema.json"),
    apiError: requiredValidator(registry.schemasByFile, "api-error.schema.json"),
  };
};
