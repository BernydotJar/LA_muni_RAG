import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";
import {
  loadIntegrationContractRegistry,
  readContractExample,
} from "../cli/validateIntegrationContracts.js";

const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule
) as FormatsPlugin;

export const CONSUMER_CONTRACT_KIT_FILES = [
  "os-electoral.json",
  "content-agency.json",
] as const;

export type ConsumerContractKitFile = typeof CONSUMER_CONTRACT_KIT_FILES[number];

type JsonObject = Record<string, unknown>;

interface ArtifactBinding {
  schema_file: string;
  example_file: string;
}

interface ConsumerInteraction {
  name: string;
  method: "POST";
  path: string;
  required_headers: string[];
  required_response_headers: string[];
  success_statuses: number[];
  error_statuses: number[];
  request: ArtifactBinding;
  response: ArtifactBinding;
  error_schema_file: string;
  error_example_files: string[];
}

interface ConsumerContractKit {
  schema_version: "v1";
  kit_version: string;
  consumer_product: "os_electoral" | "content_agency";
  provider_product: "la_muni_rag";
  openapi_document: "contracts/openapi/v1/openapi.json";
  interactions: ConsumerInteraction[];
  forbidden_response_fields: string[];
  preservation_rules: string[];
  limitations: string[];
}


interface ExpectedInteraction {
  path: string;
  requestSchema: string;
  requestExample: string;
  responseSchema: string;
  responseExample: string;
  requestDiscriminator?: { field: string; value: string };
}

const EXPECTED_INTERACTIONS: Record<ConsumerContractKit["consumer_product"], Record<string, ExpectedInteraction>> = {
  os_electoral: {
    procedure_query_evidence_bundle: {
      path: "/api/v1/procedure-queries",
      requestSchema: "procedure-query-request.schema.json",
      requestExample: "procedure-query-evidence-bundle-request.valid.json",
      responseSchema: "evidence-bundle.schema.json",
      responseExample: "evidence-bundle.valid.json",
      requestDiscriminator: { field: "requested_output", value: "evidence_bundle" },
    },
    procedure_query_workflow: {
      path: "/api/v1/procedure-queries",
      requestSchema: "procedure-query-request.schema.json",
      requestExample: "procedure-query-workflow-request.valid.json",
      responseSchema: "procedure-workflow.schema.json",
      responseExample: "procedure-workflow.valid.json",
      requestDiscriminator: { field: "requested_output", value: "procedure_workflow" },
    },
    procedure_query_assessment: {
      path: "/api/v1/procedure-queries",
      requestSchema: "procedure-query-request.schema.json",
      requestExample: "procedure-query-assessment-request.valid.json",
      responseSchema: "procedure-assessment.schema.json",
      responseExample: "procedure-assessment.valid.json",
      requestDiscriminator: { field: "requested_output", value: "procedure_assessment" },
    },
    evidence_gap_intake: {
      path: "/api/v1/evidence-gap-requests",
      requestSchema: "evidence-gap-request.schema.json",
      requestExample: "evidence-gap-request.valid.json",
      responseSchema: "evidence-gap-response.schema.json",
      responseExample: "evidence-gap-response.valid.json",
    },
  },
  content_agency: {
    claim_pack_delivery: {
      path: "/api/v1/claim-packs",
      requestSchema: "claim-pack-request.schema.json",
      requestExample: "claim-pack-request.valid.json",
      responseSchema: "claim-pack.schema.json",
      responseExample: "claim-pack.valid.json",
    },
  },
};

const REQUIRED_FORBIDDEN_FIELDS: Record<ConsumerContractKit["consumer_product"], readonly string[]> = {
  os_electoral: [
    "campaign_strategy",
    "electoral_segments",
    "territories",
    "message_house",
    "approved_message",
    "content_calendar",
    "publication_tasks",
    "media_spend",
  ],
  content_agency: [
    "copy",
    "artifacts",
    "content_calendar",
    "channels",
    "publication_tasks",
    "campaign_strategy",
    "electoral_segments",
    "approved_message",
    "campaign_id",
    "community_id",
  ],
};

export interface ConsumerContractKitIssue {
  artifact: string;
  interaction?: string;
  code: string;
  message: string;
}

export interface ConsumerContractKitValidationResult {
  status: "valid" | "invalid";
  kitFile: string;
  consumerProduct: string | null;
  interactionsValidated: number;
  issues: ConsumerContractKitIssue[];
}

export interface AllConsumerContractKitsValidationResult {
  status: "valid" | "invalid";
  kitFiles: string[];
  kitsValidated: number;
  interactionsValidated: number;
  issues: ConsumerContractKitIssue[];
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonObject = async (path: string): Promise<JsonObject> => {
  const value = JSON.parse(await readFile(path, "utf8")) as unknown;
  if (!isObject(value)) throw new Error(`JSON artifact must be an object: ${path}`);
  return value;
};

const kitDirectory = (projectRoot: string): string =>
  resolve(projectRoot, "contracts", "consumer-kits", "v1");

const formatErrors = (errors: ErrorObject[] | null | undefined): string =>
  (errors ?? [])
    .map((error) => `${error.instancePath || "/"} ${error.message ?? error.keyword}`)
    .join("; ");

const collectRefs = (value: unknown, refs: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
    return refs;
  }
  if (!isObject(value)) return refs;
  if (typeof value.$ref === "string") refs.push(value.$ref);
  for (const child of Object.values(value)) collectRefs(child, refs);
  return refs;
};

const collectKeys = (value: unknown, keys = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (!isObject(value)) return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
};

const sorted = <T extends string | number>(values: Iterable<T>): T[] =>
  [...values].sort((left, right) => String(left).localeCompare(String(right)));

const sameSet = <T extends string | number>(left: Iterable<T>, right: Iterable<T>): boolean =>
  JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

const resolveLocalRef = (document: JsonObject, ref: string): unknown => {
  if (!ref.startsWith("#/")) return undefined;
  let current: unknown = document;
  for (const rawSegment of ref.slice(2).split("/")) {
    const segment = rawSegment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (!isObject(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
};

const collectResolvedRefs = (openapi: JsonObject, value: unknown): string[] => {
  const refs = collectRefs(value);
  const resolved: string[] = [...refs];
  for (const ref of refs) {
    const target = resolveLocalRef(openapi, ref);
    if (target !== undefined) resolved.push(...collectRefs(target));
  }
  return resolved;
};

const schemaBasenames = (refs: Iterable<string>): Set<string> =>
  new Set([...refs].filter((ref) => ref.includes(".schema.json")).map((ref) => basename(ref)));

const operationHeaders = (operation: JsonObject): Set<string> => {
  const headers = new Set<string>();
  const security = Array.isArray(operation.security) ? operation.security : [];
  if (security.some((entry) => isObject(entry) && "bearerAuth" in entry)) {
    headers.add("Authorization");
  }
  const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
  for (const parameter of parameters) {
    if (
      isObject(parameter)
      && parameter.in === "header"
      && parameter.required === true
      && typeof parameter.name === "string"
    ) headers.add(parameter.name);
  }
  return headers;
};

const responseStatusSets = (operation: JsonObject): { success: Set<number>; errors: Set<number> } => {
  const responses = isObject(operation.responses) ? operation.responses : {};
  const success = new Set<number>();
  const errors = new Set<number>();
  for (const status of Object.keys(responses)) {
    if (!/^\d{3}$/.test(status)) continue;
    const numeric = Number(status);
    if (numeric >= 200 && numeric <= 299) success.add(numeric);
    if (numeric >= 400 && numeric <= 599) errors.add(numeric);
  }
  return { success, errors };
};

const responseHeaders = (openapi: JsonObject, operation: JsonObject, status: number): Set<string> => {
  const responses = isObject(operation.responses) ? operation.responses : {};
  let response = responses[String(status)];
  if (isObject(response) && typeof response.$ref === "string") {
    response = resolveLocalRef(openapi, response.$ref);
  }
  if (!isObject(response) || !isObject(response.headers)) return new Set();
  return new Set(Object.keys(response.headers));
};

const responseSchemaRefs = (openapi: JsonObject, operation: JsonObject, statuses: number[]): Set<string> => {
  const responses = isObject(operation.responses) ? operation.responses : {};
  const refs: string[] = [];
  for (const status of statuses) {
    const response = responses[String(status)];
    refs.push(...collectResolvedRefs(openapi, response));
  }
  return schemaBasenames(refs);
};

const expectedConsumerForFile = (kitFile: string): ConsumerContractKit["consumer_product"] | null => {
  if (kitFile === "os-electoral.json") return "os_electoral";
  if (kitFile === "content-agency.json") return "content_agency";
  return null;
};

const loadManifestValidator = async (projectRoot: string) => {
  const schema = await readJsonObject(resolve(kitDirectory(projectRoot), "consumer-contract-kit.schema.json"));
  const ajv = new Ajv2020({ strict: true, allErrors: true, validateFormats: true });
  addFormats(ajv);
  return ajv.compile(schema);
};

export const verifyConsumerContractKit = async (
  projectRoot: string,
  kitFile: string
): Promise<ConsumerContractKitValidationResult> => {
  const artifact = `contracts/consumer-kits/v1/${kitFile}`;
  const issues: ConsumerContractKitIssue[] = [];
  const issue = (code: string, message: string, interaction?: string): void => {
    issues.push({ artifact, ...(interaction ? { interaction } : {}), code, message });
  };

  if (!(CONSUMER_CONTRACT_KIT_FILES as readonly string[]).includes(kitFile)) {
    issue("unknown_kit_file", `Consumer kit ${kitFile} is not allowlisted`);
    return { status: "invalid", kitFile, consumerProduct: null, interactionsValidated: 0, issues };
  }

  let raw: JsonObject;
  try {
    raw = await readJsonObject(resolve(kitDirectory(projectRoot), kitFile));
  } catch (error) {
    issue("kit_read_failed", error instanceof Error ? error.message : String(error));
    return { status: "invalid", kitFile, consumerProduct: null, interactionsValidated: 0, issues };
  }

  let validateManifest: ValidateFunction;
  try {
    validateManifest = await loadManifestValidator(projectRoot);
  } catch (error) {
    issue("kit_schema_load_failed", error instanceof Error ? error.message : String(error));
    return { status: "invalid", kitFile, consumerProduct: null, interactionsValidated: 0, issues };
  }
  if (!validateManifest(raw)) {
    issue("invalid_kit_manifest", formatErrors(validateManifest.errors));
    return {
      status: "invalid",
      kitFile,
      consumerProduct: typeof (raw as JsonObject)["consumer_product"] === "string"
        ? String((raw as JsonObject)["consumer_product"])
        : null,
      interactionsValidated: 0,
      issues,
    };
  }

  const kit = raw as unknown as ConsumerContractKit;
  const expectedConsumer = expectedConsumerForFile(kitFile);
  if (expectedConsumer !== kit.consumer_product) {
    issue("consumer_identity_mismatch", `${kitFile} must declare ${expectedConsumer ?? "a known consumer"}`);
  }

  const expectedInteractions = EXPECTED_INTERACTIONS[kit.consumer_product];
  const actualNames = new Set(kit.interactions.map((interaction) => interaction.name));
  const expectedNames = new Set(Object.keys(expectedInteractions));
  if (!sameSet(actualNames, expectedNames)) {
    issue(
      "interaction_set_drift",
      `Expected interactions ${sorted(expectedNames).join(",")}; manifest has ${sorted(actualNames).join(",")}`
    );
  }
  for (const requiredField of REQUIRED_FORBIDDEN_FIELDS[kit.consumer_product]) {
    if (!kit.forbidden_response_fields.includes(requiredField)) {
      issue("forbidden_field_guard_missing", `Manifest does not guard ${requiredField}`);
    }
  }

  const names = new Set<string>();
  for (const interaction of kit.interactions) {
    if (names.has(interaction.name)) {
      issue("duplicate_interaction_name", `Duplicate interaction name ${interaction.name}`, interaction.name);
    }
    names.add(interaction.name);
  }

  let openapi: JsonObject;
  let registry: Awaited<ReturnType<typeof loadIntegrationContractRegistry>>;
  try {
    openapi = await readJsonObject(resolve(projectRoot, kit.openapi_document));
    registry = await loadIntegrationContractRegistry(projectRoot);
  } catch (error) {
    issue("contract_artifact_load_failed", error instanceof Error ? error.message : String(error));
    return {
      status: "invalid",
      kitFile,
      consumerProduct: kit.consumer_product,
      interactionsValidated: 0,
      issues,
    };
  }
  const paths = isObject(openapi.paths) ? openapi.paths : {};

  for (const interaction of kit.interactions) {
    const expected = expectedInteractions[interaction.name];
    if (expected && (
      interaction.path !== expected.path
      || interaction.request.schema_file !== expected.requestSchema
      || interaction.request.example_file !== expected.requestExample
      || interaction.response.schema_file !== expected.responseSchema
      || interaction.response.example_file !== expected.responseExample
    )) {
      issue("interaction_identity_drift", `Interaction ${interaction.name} no longer matches its canonical artifact binding`, interaction.name);
    }

    const pathItem = paths[interaction.path];
    if (!isObject(pathItem)) {
      issue("openapi_path_missing", `OpenAPI path ${interaction.path} is missing`, interaction.name);
      continue;
    }
    const operation = pathItem[interaction.method.toLowerCase()];
    if (!isObject(operation)) {
      issue("openapi_method_missing", `${interaction.method} ${interaction.path} is missing`, interaction.name);
      continue;
    }

    const advertisedHeaders = operationHeaders(operation);
    if (!sameSet(advertisedHeaders, interaction.required_headers)) {
      for (const header of interaction.required_headers) {
        if (!advertisedHeaders.has(header)) {
          issue("required_header_missing", `OpenAPI does not require ${header}`, interaction.name);
        }
      }
      for (const header of advertisedHeaders) {
        if (!interaction.required_headers.includes(header)) {
          issue("manifest_header_omission", `Manifest omits required OpenAPI header ${header}`, interaction.name);
        }
      }
    }

    for (const status of [...interaction.success_statuses, ...interaction.error_statuses]) {
      const advertisedResponseHeaders = responseHeaders(openapi, operation, status);
      for (const header of interaction.required_response_headers) {
        if (!advertisedResponseHeaders.has(header)) {
          issue("response_header_missing", `OpenAPI response ${status} does not require ${header}`, interaction.name);
        }
      }
    }

    const statuses = responseStatusSets(operation);
    if (!sameSet(statuses.success, interaction.success_statuses)) {
      issue(
        "success_status_drift",
        `Expected success statuses ${sorted(statuses.success).join(",")}; manifest has ${sorted(interaction.success_statuses).join(",")}`,
        interaction.name
      );
    }
    if (!sameSet(statuses.errors, interaction.error_statuses)) {
      issue(
        "error_status_drift",
        `Expected error statuses ${sorted(statuses.errors).join(",")}; manifest has ${sorted(interaction.error_statuses).join(",")}`,
        interaction.name
      );
    }

    const requestBody = isObject(operation.requestBody) ? operation.requestBody : {};
    const requestRefs = schemaBasenames(collectResolvedRefs(openapi, requestBody));
    if (!requestRefs.has(interaction.request.schema_file)) {
      issue(
        "request_schema_not_advertised",
        `OpenAPI request does not advertise ${interaction.request.schema_file}`,
        interaction.name
      );
    }

    const responseRefs = responseSchemaRefs(openapi, operation, interaction.success_statuses);
    if (!responseRefs.has(interaction.response.schema_file)) {
      issue(
        "response_schema_not_advertised",
        `OpenAPI response does not advertise ${interaction.response.schema_file}`,
        interaction.name
      );
    }

    const errorRefs = responseSchemaRefs(openapi, operation, interaction.error_statuses);
    if (!errorRefs.has(interaction.error_schema_file)) {
      issue(
        "error_schema_not_advertised",
        `OpenAPI errors do not advertise ${interaction.error_schema_file}`,
        interaction.name
      );
    }

    for (const binding of [interaction.request, interaction.response]) {
      const schema = registry.schemasByFile.get(binding.schema_file);
      if (!schema) {
        issue("schema_file_missing", `Unknown schema ${binding.schema_file}`, interaction.name);
        continue;
      }
      if (binding === interaction.response) {
        const schemaKeys = collectKeys(schema.schema);
        for (const forbidden of kit.forbidden_response_fields) {
          if (schemaKeys.has(forbidden)) {
            issue(
              "forbidden_response_schema_field",
              `${binding.schema_file} permits consumer-owned field ${forbidden}`,
              interaction.name
            );
          }
        }
      }
      try {
        const example = await readContractExample(projectRoot, binding.example_file);
        if (!schema.validate(example)) {
          issue(
            "example_schema_invalid",
            `${binding.example_file} does not validate against ${binding.schema_file}: ${formatErrors(schema.validate.errors)}`,
            interaction.name
          );
        }
        if (
          binding === interaction.request
          && expected?.requestDiscriminator
          && example[expected.requestDiscriminator.field] !== expected.requestDiscriminator.value
        ) {
          issue(
            "request_discriminator_drift",
            `${binding.example_file} must set ${expected.requestDiscriminator.field}=${expected.requestDiscriminator.value}`,
            interaction.name
          );
        }
        if (binding === interaction.response) {
          const keys = collectKeys(example);
          for (const forbidden of kit.forbidden_response_fields) {
            if (keys.has(forbidden)) {
              issue(
                "forbidden_response_field",
                `${binding.example_file} contains consumer-owned field ${forbidden}`,
                interaction.name
              );
            }
          }
        }
      } catch (error) {
        issue("example_file_missing", error instanceof Error ? error.message : String(error), interaction.name);
      }
    }

    const errorSchema = registry.schemasByFile.get(interaction.error_schema_file);
    if (!errorSchema) {
      issue("schema_file_missing", `Unknown schema ${interaction.error_schema_file}`, interaction.name);
    } else {
      for (const exampleFile of interaction.error_example_files) {
        try {
          const example = await readContractExample(projectRoot, exampleFile);
          if (!errorSchema.validate(example)) {
            issue(
              "example_schema_invalid",
              `${exampleFile} does not validate against ${interaction.error_schema_file}: ${formatErrors(errorSchema.validate.errors)}`,
              interaction.name
            );
          }
        } catch (error) {
          issue("example_file_missing", error instanceof Error ? error.message : String(error), interaction.name);
        }
      }
    }
  }

  return {
    status: issues.length === 0 ? "valid" : "invalid",
    kitFile,
    consumerProduct: kit.consumer_product,
    interactionsValidated: kit.interactions.length,
    issues,
  };
};

export const verifyAllConsumerContractKits = async (
  projectRoot = process.cwd()
): Promise<AllConsumerContractKitsValidationResult> => {
  const results = await Promise.all(
    CONSUMER_CONTRACT_KIT_FILES.map((kitFile) => verifyConsumerContractKit(projectRoot, kitFile))
  );
  const issues = results.flatMap((result) => result.issues);
  return {
    status: issues.length === 0 ? "valid" : "invalid",
    kitFiles: [...CONSUMER_CONTRACT_KIT_FILES],
    kitsValidated: results.length,
    interactionsValidated: results.reduce((sum, result) => sum + result.interactionsValidated, 0),
    issues,
  };
};
