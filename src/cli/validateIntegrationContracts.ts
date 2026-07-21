import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { AnySchema, ErrorObject, ValidateFunction } from "ajv";
import type { FormatsPlugin } from "ajv-formats";

const addFormats = (
  (addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule
) as FormatsPlugin;

export const JSON_SCHEMA_DIALECT = "https://json-schema.org/draft/2020-12/schema";
export const OPENAPI_VERSION = "3.1.1";
export const OPENAPI_RELATIVE_PATH = "contracts/openapi/v1/openapi.json";

export const CONTRACT_SCHEMA_FILES = [
  "common.schema.json",
  "evidence-bundle.schema.json",
  "procedure-workflow.schema.json",
  "procedure-assessment.schema.json",
  "procedure-query-request.schema.json",
  "ingestion-job-request.schema.json",
  "ingestion-job-response.schema.json",
  "evidence-gap-request.schema.json",
  "evidence-gap-response.schema.json",
  "claim-pack.schema.json",
  "claim-pack-request.schema.json",
  "workflow-draft-request.schema.json",
  "workflow-review-request.schema.json",
  "workflow-approval-request.schema.json",
  "workflow-version.schema.json",
  "procedure-case-request.schema.json",
  "procedure-case.schema.json",
  "source-create-request.schema.json",
  "source-response.schema.json",
  "source-list-response.schema.json",
  "document-create-request.schema.json",
  "document-response.schema.json",
  "document-list-response.schema.json",
  "ingestion-job-list-response.schema.json",
  "procedure-list-response.schema.json",
  "event-envelope.schema.json",
  "api-error.schema.json",
] as const;

export const CONTRACT_EXAMPLE_BINDINGS = [
  { contractName: "evidence-bundle", schemaFile: "evidence-bundle.schema.json", exampleFile: "evidence-bundle.valid.json" },
  { contractName: "procedure-workflow", schemaFile: "procedure-workflow.schema.json", exampleFile: "procedure-workflow.valid.json" },
  { contractName: "procedure-assessment", schemaFile: "procedure-assessment.schema.json", exampleFile: "procedure-assessment.valid.json" },
  { contractName: "procedure-query-request", schemaFile: "procedure-query-request.schema.json", exampleFile: "procedure-query-request.valid.json" },
  { contractName: "ingestion-job-request", schemaFile: "ingestion-job-request.schema.json", exampleFile: "ingestion-job-request.valid.json" },
  { contractName: "ingestion-job-response", schemaFile: "ingestion-job-response.schema.json", exampleFile: "ingestion-job-response.valid.json" },
  { contractName: "evidence-gap-request", schemaFile: "evidence-gap-request.schema.json", exampleFile: "evidence-gap-request.valid.json" },
  { contractName: "evidence-gap-response", schemaFile: "evidence-gap-response.schema.json", exampleFile: "evidence-gap-response.valid.json" },
  { contractName: "claim-pack", schemaFile: "claim-pack.schema.json", exampleFile: "claim-pack.valid.json" },
  { contractName: "claim-pack-request", schemaFile: "claim-pack-request.schema.json", exampleFile: "claim-pack-request.valid.json" },
  { contractName: "workflow-draft-request", schemaFile: "workflow-draft-request.schema.json", exampleFile: "workflow-draft-request.valid.json" },
  { contractName: "workflow-review-request", schemaFile: "workflow-review-request.schema.json", exampleFile: "workflow-review-request.valid.json" },
  { contractName: "workflow-approval-request", schemaFile: "workflow-approval-request.schema.json", exampleFile: "workflow-approval-request.valid.json" },
  { contractName: "workflow-version", schemaFile: "workflow-version.schema.json", exampleFile: "workflow-version.valid.json" },
  { contractName: "procedure-case-request", schemaFile: "procedure-case-request.schema.json", exampleFile: "procedure-case-request.valid.json" },
  { contractName: "procedure-case", schemaFile: "procedure-case.schema.json", exampleFile: "procedure-case.valid.json" },
  { contractName: "source-create-request", schemaFile: "source-create-request.schema.json", exampleFile: "source-create-request.valid.json" },
  { contractName: "source-response", schemaFile: "source-response.schema.json", exampleFile: "source-response.valid.json" },
  { contractName: "source-list-response", schemaFile: "source-list-response.schema.json", exampleFile: "source-list-response.valid.json" },
  { contractName: "document-create-request", schemaFile: "document-create-request.schema.json", exampleFile: "document-create-request.valid.json" },
  { contractName: "document-response", schemaFile: "document-response.schema.json", exampleFile: "document-response.valid.json" },
  { contractName: "document-list-response", schemaFile: "document-list-response.schema.json", exampleFile: "document-list-response.valid.json" },
  { contractName: "ingestion-job-list-response", schemaFile: "ingestion-job-list-response.schema.json", exampleFile: "ingestion-job-list-response.valid.json" },
  { contractName: "procedure-list-response", schemaFile: "procedure-list-response.schema.json", exampleFile: "procedure-list-response.valid.json" },
  { contractName: "event-envelope", schemaFile: "event-envelope.schema.json", exampleFile: "event-envelope.valid.json" },
  { contractName: "api-error", schemaFile: "api-error.schema.json", exampleFile: "api-error.valid.json" },
  { contractName: "api-error-unauthorized", schemaFile: "api-error.schema.json", exampleFile: "api-error-unauthorized.valid.json" },
] as const;

type JsonObject = Record<string, unknown>;

export interface LoadedContractSchema {
  fileName: string;
  filePath: string;
  id: string;
  schema: JsonObject;
  validate: ValidateFunction;
}

export interface IntegrationContractRegistry {
  schemasByFile: Map<string, LoadedContractSchema>;
}

export interface ContractValidationIssue {
  artifact: string;
  code: string;
  message: string;
}

export interface IntegrationContractValidationResult {
  status: "valid" | "invalid";
  schemaDialect: typeof JSON_SCHEMA_DIALECT;
  openapiVersion: typeof OPENAPI_VERSION;
  schemasValidated: number;
  examplesValidated: number;
  openapiDocumentsValidated: number;
  issues: ContractValidationIssue[];
}

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = async (filePath: string): Promise<JsonObject> => {
  const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  if (!isJsonObject(parsed)) {
    throw new Error("JSON artifact must contain an object: " + filePath);
  }
  return parsed;
};

const schemaDirectory = (projectRoot: string): string =>
  resolve(projectRoot, "contracts", "schemas", "v1");

const exampleDirectory = (projectRoot: string): string =>
  resolve(projectRoot, "contracts", "examples", "v1");

export const createContractAjv = (): Ajv2020 => {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    validateFormats: true,
  });
  addFormats(ajv);
  return ajv;
};

const requireSchemaMetadata = (fileName: string, schema: JsonObject): string => {
  if (schema.$schema !== JSON_SCHEMA_DIALECT) {
    throw new Error(fileName + " must declare JSON Schema draft 2020-12");
  }
  if (typeof schema.$id !== "string" || schema.$id.length === 0) {
    throw new Error(fileName + " must declare a non-empty $id");
  }
  return schema.$id;
};

export const loadIntegrationContractRegistry = async (
  projectRoot = process.cwd()
): Promise<IntegrationContractRegistry> => {
  const ajv = createContractAjv();
  const loaded = await Promise.all(
    CONTRACT_SCHEMA_FILES.map(async (fileName) => {
      const filePath = resolve(schemaDirectory(projectRoot), fileName);
      const schema = await parseJson(filePath);
      const id = requireSchemaMetadata(fileName, schema);
      return { fileName, filePath, id, schema };
    })
  );

  const ids = new Set<string>();
  for (const artifact of loaded) {
    if (ids.has(artifact.id)) {
      throw new Error("Duplicate schema $id: " + artifact.id);
    }
    ids.add(artifact.id);
    ajv.addSchema(artifact.schema as AnySchema, artifact.id);
  }

  const schemasByFile = new Map<string, LoadedContractSchema>();
  for (const artifact of loaded) {
    const validate = ajv.compile({ $ref: artifact.id });
    schemasByFile.set(artifact.fileName, {
      ...artifact,
      validate,
    });
  }

  return { schemasByFile };
};

export const readContractExample = async (
  projectRoot: string,
  exampleFile: string
): Promise<JsonObject> => parseJson(resolve(exampleDirectory(projectRoot), exampleFile));

const formatAjvErrors = (errors: ErrorObject[] | null | undefined): string =>
  (errors ?? [])
    .map(
      (error) =>
        (error.instancePath || "/") + " " + (error.message ?? error.keyword)
    )
    .join("; ");

const collectReferences = (value: unknown, references: string[] = []): string[] => {
  if (Array.isArray(value)) {
    for (const item of value) collectReferences(item, references);
    return references;
  }
  if (!isJsonObject(value)) return references;
  if (typeof value.$ref === "string") references.push(value.$ref);
  for (const item of Object.values(value)) collectReferences(item, references);
  return references;
};

const sorted = (values: Iterable<string>): string[] => [...values].sort();

const equalStringSets = (actual: Iterable<string>, expected: string[]): boolean =>
  JSON.stringify(sorted(actual)) === JSON.stringify([...expected].sort());

const validateOpenApiDocument = async (
  projectRoot: string,
  openapi: JsonObject
): Promise<ContractValidationIssue[]> => {
  const issues: ContractValidationIssue[] = [];
  const artifact = OPENAPI_RELATIVE_PATH;
  const recordIssue = (code: string, message: string): void => {
    issues.push({ artifact, code, message });
  };

  if (openapi.openapi !== OPENAPI_VERSION) {
    recordIssue("invalid_openapi_version", "openapi must equal " + OPENAPI_VERSION);
  }
  if (openapi.jsonSchemaDialect !== JSON_SCHEMA_DIALECT) {
    recordIssue("invalid_json_schema_dialect", "jsonSchemaDialect must be draft 2020-12");
  }

  const paths = isJsonObject(openapi.paths) ? openapi.paths : {};
  const expectedPaths = [
    "/api/v1/claim-packs",
    "/api/v1/evidence-gap-requests",
    "/api/v1/procedure-queries",
    "/api/v1/ingestion-jobs",
    "/api/v1/ingestion-jobs/{job_id}",
    "/api/v1/workflow-drafts",
    "/api/v1/workflow-reviews",
    "/api/v1/workflow-approvals",
    "/api/v1/workflows/{workflow_version_id}",
    "/api/v1/procedure-cases",
    "/api/v1/procedure-cases/{case_id}",
    "/api/v1/sources",
    "/api/v1/documents",
    "/api/v1/procedures",
  ];
  if (!equalStringSets(Object.keys(paths), expectedPaths)) {
    recordIssue("invalid_path_scope", "OpenAPI path scope does not match implemented v1 routes");
  }

  const claimPackPath = isJsonObject(paths["/api/v1/claim-packs"])
    ? paths["/api/v1/claim-packs"]
    : {};
  const evidenceGapPath = isJsonObject(paths["/api/v1/evidence-gap-requests"])
    ? paths["/api/v1/evidence-gap-requests"]
    : {};
  const procedurePath = isJsonObject(paths["/api/v1/procedure-queries"])
    ? paths["/api/v1/procedure-queries"]
    : {};
  const ingestionPath = isJsonObject(paths["/api/v1/ingestion-jobs"])
    ? paths["/api/v1/ingestion-jobs"]
    : {};
  const ingestionItemPath = isJsonObject(paths["/api/v1/ingestion-jobs/{job_id}"])
    ? paths["/api/v1/ingestion-jobs/{job_id}"]
    : {};
  const workflowDraftPath = isJsonObject(paths["/api/v1/workflow-drafts"])
    ? paths["/api/v1/workflow-drafts"]
    : {};
  const workflowReviewPath = isJsonObject(paths["/api/v1/workflow-reviews"])
    ? paths["/api/v1/workflow-reviews"]
    : {};
  const workflowApprovalPath = isJsonObject(paths["/api/v1/workflow-approvals"])
    ? paths["/api/v1/workflow-approvals"]
    : {};
  const workflowItemPath = isJsonObject(paths["/api/v1/workflows/{workflow_version_id}"])
    ? paths["/api/v1/workflows/{workflow_version_id}"]
    : {};
  const procedureCasePath = isJsonObject(paths["/api/v1/procedure-cases"])
    ? paths["/api/v1/procedure-cases"]
    : {};
  const procedureCaseItemPath = isJsonObject(paths["/api/v1/procedure-cases/{case_id}"])
    ? paths["/api/v1/procedure-cases/{case_id}"]
    : {};
  const sourcesPath = isJsonObject(paths["/api/v1/sources"])
    ? paths["/api/v1/sources"]
    : {};
  const documentsPath = isJsonObject(paths["/api/v1/documents"])
    ? paths["/api/v1/documents"]
    : {};
  const proceduresPath = isJsonObject(paths["/api/v1/procedures"])
    ? paths["/api/v1/procedures"]
    : {};
  if (!equalStringSets(Object.keys(claimPackPath), ["post"])) {
    recordIssue("invalid_method_scope", "ClaimPack path must describe only POST");
  }
  if (!equalStringSets(Object.keys(evidenceGapPath), ["post"])) {
    recordIssue("invalid_method_scope", "Evidence gap path must describe only POST");
  }
  if (!equalStringSets(Object.keys(procedurePath), ["post"])) {
    recordIssue("invalid_method_scope", "Procedure query path must describe only POST");
  }
  if (!equalStringSets(Object.keys(ingestionPath), ["get", "post"])) {
    recordIssue("invalid_method_scope", "Ingestion collection path must describe GET and POST");
  }
  if (!equalStringSets(Object.keys(ingestionItemPath), ["get"])) {
    recordIssue("invalid_method_scope", "Ingestion item path must describe only GET");
  }
  for (const [label, path, method] of [
    ["Workflow draft", workflowDraftPath, "post"],
    ["Workflow review", workflowReviewPath, "post"],
    ["Workflow approval", workflowApprovalPath, "post"],
    ["Workflow item", workflowItemPath, "get"],
    ["Procedure case collection", procedureCasePath, "post"],
  ] as const) {
    if (!equalStringSets(Object.keys(path), [method])) {
      recordIssue("invalid_method_scope", label + " path must describe only " + method.toUpperCase());
    }
  }
  if (!equalStringSets(Object.keys(procedureCaseItemPath), ["get", "patch"])) {
    recordIssue("invalid_method_scope", "Procedure case item path must describe GET and PATCH");
  }
  if (!equalStringSets(Object.keys(sourcesPath), ["get", "post"])) {
    recordIssue("invalid_method_scope", "Sources path must describe GET and POST");
  }
  if (!equalStringSets(Object.keys(documentsPath), ["get", "post"])) {
    recordIssue("invalid_method_scope", "Documents path must describe GET and POST");
  }
  if (!equalStringSets(Object.keys(proceduresPath), ["get"])) {
    recordIssue("invalid_method_scope", "Procedures path must describe only GET");
  }

  const claimPackOperation = isJsonObject(claimPackPath.post) ? claimPackPath.post : {};
  const evidenceGapOperation = isJsonObject(evidenceGapPath.post) ? evidenceGapPath.post : {};
  const procedureOperation = isJsonObject(procedurePath.post) ? procedurePath.post : {};
  const ingestionPostOperation = isJsonObject(ingestionPath.post) ? ingestionPath.post : {};
  const ingestionListOperation = isJsonObject(ingestionPath.get) ? ingestionPath.get : {};
  const ingestionGetOperation = isJsonObject(ingestionItemPath.get) ? ingestionItemPath.get : {};
  const workflowDraftOperation = isJsonObject(workflowDraftPath.post) ? workflowDraftPath.post : {};
  const workflowReviewOperation = isJsonObject(workflowReviewPath.post) ? workflowReviewPath.post : {};
  const workflowApprovalOperation = isJsonObject(workflowApprovalPath.post) ? workflowApprovalPath.post : {};
  const workflowGetOperation = isJsonObject(workflowItemPath.get) ? workflowItemPath.get : {};
  const procedureCaseCreateOperation = isJsonObject(procedureCasePath.post) ? procedureCasePath.post : {};
  const procedureCaseGetOperation = isJsonObject(procedureCaseItemPath.get) ? procedureCaseItemPath.get : {};
  const procedureCasePatchOperation = isJsonObject(procedureCaseItemPath.patch) ? procedureCaseItemPath.patch : {};
  const sourceCreateOperation = isJsonObject(sourcesPath.post) ? sourcesPath.post : {};
  const sourceListOperation = isJsonObject(sourcesPath.get) ? sourcesPath.get : {};
  const documentCreateOperation = isJsonObject(documentsPath.post) ? documentsPath.post : {};
  const documentListOperation = isJsonObject(documentsPath.get) ? documentsPath.get : {};
  const procedureListOperation = isJsonObject(proceduresPath.get) ? proceduresPath.get : {};
  const operations = [
    ["POST /api/v1/claim-packs", claimPackOperation],
    ["POST /api/v1/evidence-gap-requests", evidenceGapOperation],
    ["POST /api/v1/procedure-queries", procedureOperation],
    ["POST /api/v1/ingestion-jobs", ingestionPostOperation],
    ["GET /api/v1/ingestion-jobs/{job_id}", ingestionGetOperation],
    ["POST /api/v1/workflow-drafts", workflowDraftOperation],
    ["POST /api/v1/workflow-reviews", workflowReviewOperation],
    ["POST /api/v1/workflow-approvals", workflowApprovalOperation],
    ["GET /api/v1/workflows/{workflow_version_id}", workflowGetOperation],
    ["POST /api/v1/procedure-cases", procedureCaseCreateOperation],
    ["GET /api/v1/procedure-cases/{case_id}", procedureCaseGetOperation],
    ["PATCH /api/v1/procedure-cases/{case_id}", procedureCasePatchOperation],
    ["POST /api/v1/sources", sourceCreateOperation],
    ["GET /api/v1/sources", sourceListOperation],
    ["POST /api/v1/documents", documentCreateOperation],
    ["GET /api/v1/documents", documentListOperation],
    ["GET /api/v1/ingestion-jobs", ingestionListOperation],
    ["GET /api/v1/procedures", procedureListOperation],
  ] as const;
  for (const [label, operation] of operations) {
    const security = Array.isArray(operation.security) ? operation.security : [];
    if (!security.some((entry) => isJsonObject(entry) && Array.isArray(entry.bearerAuth))) {
      recordIssue("missing_bearer_security", label + " must require bearerAuth");
    }
  }

  const requiredHeaders = (operation: JsonObject): Set<string> => new Set(
    (Array.isArray(operation.parameters) ? operation.parameters : [])
      .filter(
        (parameter): parameter is JsonObject =>
          isJsonObject(parameter) &&
          parameter.in === "header" &&
          parameter.required === true &&
          typeof parameter.name === "string"
      )
      .map((parameter) => String(parameter.name).toLowerCase())
  );
  for (const [label, operation, expectedHeaders] of [
    ["claim pack", claimPackOperation, ["idempotency-key", "x-request-id"]],
    ["evidence gap", evidenceGapOperation, ["idempotency-key", "x-request-id"]],
    ["procedure query", procedureOperation, ["idempotency-key", "x-request-id"]],
    ["ingestion enqueue", ingestionPostOperation, ["idempotency-key", "x-request-id"]],
    ["ingestion status", ingestionGetOperation, ["x-request-id"]],
    ["workflow draft", workflowDraftOperation, ["idempotency-key", "x-request-id"]],
    ["workflow review", workflowReviewOperation, ["idempotency-key", "x-request-id"]],
    ["workflow approval", workflowApprovalOperation, ["idempotency-key", "x-request-id"]],
    ["workflow read", workflowGetOperation, ["x-request-id"]],
    ["procedure case create", procedureCaseCreateOperation, ["idempotency-key", "x-request-id"]],
    ["procedure case read", procedureCaseGetOperation, ["x-request-id"]],
    ["procedure case update", procedureCasePatchOperation, ["idempotency-key", "x-request-id"]],
    ["source create", sourceCreateOperation, ["idempotency-key", "x-request-id"]],
    ["source list", sourceListOperation, ["x-request-id"]],
    ["document create", documentCreateOperation, ["idempotency-key", "x-request-id"]],
    ["document list", documentListOperation, ["x-request-id"]],
    ["ingestion list", ingestionListOperation, ["x-request-id"]],
    ["procedure list", procedureListOperation, ["x-request-id"]],
  ] as const) {
    const headerNames = requiredHeaders(operation);
    for (const requiredHeader of expectedHeaders) {
      if (!headerNames.has(requiredHeader)) {
        recordIssue("missing_required_header", label + " is missing " + requiredHeader);
      }
    }
  }

  for (const [label, operation, expectedResponses] of [
    ["claim pack", claimPackOperation, ["200", "400", "401", "403", "409", "429", "500"]],
    ["evidence gap", evidenceGapOperation, ["200", "400", "401", "403", "409", "429", "500"]],
    ["procedure query", procedureOperation, ["200", "400", "401", "403", "409", "429", "500"]],
    ["ingestion enqueue", ingestionPostOperation, ["200", "202", "400", "401", "403", "409", "429", "500", "503"]],
    ["ingestion status", ingestionGetOperation, ["200", "400", "401", "403", "404", "429", "500"]],
    ["workflow draft", workflowDraftOperation, ["201", "400", "401", "403", "409", "429", "500"]],
    ["workflow review", workflowReviewOperation, ["200", "400", "401", "403", "404", "409", "429", "500"]],
    ["workflow approval", workflowApprovalOperation, ["200", "400", "401", "403", "404", "409", "429", "500"]],
    ["workflow read", workflowGetOperation, ["200", "400", "401", "403", "404", "429", "500"]],
    ["procedure case create", procedureCaseCreateOperation, ["201", "400", "401", "403", "409", "429", "500"]],
    ["procedure case read", procedureCaseGetOperation, ["200", "400", "401", "403", "404", "429", "500"]],
    ["procedure case update", procedureCasePatchOperation, ["200", "400", "401", "403", "404", "409", "429", "500"]],
    ["source create", sourceCreateOperation, ["201", "400", "401", "403", "409", "429", "500"]],
    ["source list", sourceListOperation, ["200", "400", "401", "403", "429", "500"]],
    ["document create", documentCreateOperation, ["201", "400", "401", "403", "404", "409", "429", "500"]],
    ["document list", documentListOperation, ["200", "400", "401", "403", "429", "500"]],
    ["ingestion list", ingestionListOperation, ["200", "400", "401", "403", "429", "500"]],
    ["procedure list", procedureListOperation, ["200", "400", "401", "403", "429", "500"]],
  ] as const) {
    const responses = isJsonObject(operation.responses) ? operation.responses : {};
    if (!equalStringSets(Object.keys(responses), [...expectedResponses])) {
      recordIssue(
        "invalid_response_scope",
        label + " responses must be exactly " + expectedResponses.join(", ")
      );
    }
  }

  const schemaRef = (value: unknown): string | null => {
    if (!isJsonObject(value)) return null;
    return typeof value.$ref === "string" ? value.$ref : null;
  };
  const evidenceGapRequestBody = isJsonObject(evidenceGapOperation.requestBody)
    ? evidenceGapOperation.requestBody
    : {};
  const evidenceGapRequestContent = isJsonObject(evidenceGapRequestBody.content)
    ? evidenceGapRequestBody.content
    : {};
  const evidenceGapRequestJson = isJsonObject(evidenceGapRequestContent["application/json"])
    ? evidenceGapRequestContent["application/json"]
    : {};
  if (
    schemaRef(evidenceGapRequestJson.schema) !==
    "../../schemas/v1/evidence-gap-request.schema.json"
  ) {
    recordIssue(
      "invalid_request_schema",
      "Evidence gap requestBody must reference evidence-gap-request.schema.json"
    );
  }
  const evidenceGapResponses = isJsonObject(evidenceGapOperation.responses)
    ? evidenceGapOperation.responses
    : {};
  const evidenceGapOk = isJsonObject(evidenceGapResponses["200"])
    ? evidenceGapResponses["200"]
    : {};
  const evidenceGapOkContent = isJsonObject(evidenceGapOk.content)
    ? evidenceGapOk.content
    : {};
  const evidenceGapOkJson = isJsonObject(evidenceGapOkContent["application/json"])
    ? evidenceGapOkContent["application/json"]
    : {};
  if (
    schemaRef(evidenceGapOkJson.schema) !==
    "../../schemas/v1/evidence-gap-response.schema.json"
  ) {
    recordIssue(
      "invalid_response_schema",
      "Evidence gap 200 response must reference evidence-gap-response.schema.json"
    );
  }

  const components = isJsonObject(openapi.components) ? openapi.components : {};
  const schemes = isJsonObject(components.securitySchemes)
    ? components.securitySchemes
    : {};
  const bearer = isJsonObject(schemes.bearerAuth) ? schemes.bearerAuth : {};
  if (bearer.type !== "http" || bearer.scheme !== "bearer") {
    recordIssue("invalid_bearer_scheme", "bearerAuth must be an HTTP bearer scheme");
  }

  const componentHeaders = isJsonObject(components.headers) ? components.headers : {};
  const wwwAuthenticate = isJsonObject(componentHeaders.WWWAuthenticate)
    ? componentHeaders.WWWAuthenticate
    : {};
  const wwwAuthenticateSchema = isJsonObject(wwwAuthenticate.schema)
    ? wwwAuthenticate.schema
    : {};
  if (wwwAuthenticateSchema.const !== 'Bearer realm="la-muni-rag"') {
    recordIssue(
      "invalid_www_authenticate_header",
      "WWWAuthenticate header must declare the exact v1 Bearer challenge"
    );
  }

  const componentResponses = isJsonObject(components.responses)
    ? components.responses
    : {};
  const unauthorizedResponse = isJsonObject(componentResponses.Unauthorized)
    ? componentResponses.Unauthorized
    : {};
  const unauthorizedHeaders = isJsonObject(unauthorizedResponse.headers)
    ? unauthorizedResponse.headers
    : {};
  const unauthorizedChallenge = isJsonObject(
    unauthorizedHeaders["WWW-Authenticate"]
  )
    ? unauthorizedHeaders["WWW-Authenticate"]
    : {};
  if (unauthorizedChallenge.$ref !== "#/components/headers/WWWAuthenticate") {
    recordIssue(
      "missing_www_authenticate_header",
      "401 Unauthorized must return the reusable WWW-Authenticate challenge"
    );
  }

  const openapiPath = resolve(projectRoot, OPENAPI_RELATIVE_PATH);
  const externalReferences = collectReferences(openapi).filter(
    (reference) => !reference.startsWith("#")
  );
  for (const reference of externalReferences) {
    const referencedPath = resolve(dirname(openapiPath), reference);
    try {
      const referenced = await parseJson(referencedPath);
      if (referenced.$schema !== JSON_SCHEMA_DIALECT) {
        recordIssue(
          "invalid_external_schema",
          reference + " does not declare draft 2020-12"
        );
      }
    } catch (error) {
      recordIssue(
        "unresolved_external_reference",
        reference +
          ": " +
          (error instanceof Error ? error.message : "unreadable reference")
      );
    }
  }

  return issues;
};

export const validateIntegrationContracts = async (
  projectRoot = process.cwd()
): Promise<IntegrationContractValidationResult> => {
  const issues: ContractValidationIssue[] = [];
  let registry: IntegrationContractRegistry;
  try {
    registry = await loadIntegrationContractRegistry(projectRoot);
  } catch (error) {
    return {
      status: "invalid",
      schemaDialect: JSON_SCHEMA_DIALECT,
      openapiVersion: OPENAPI_VERSION,
      schemasValidated: 0,
      examplesValidated: 0,
      openapiDocumentsValidated: 0,
      issues: [
        {
          artifact: "contracts/schemas/v1",
          code: "schema_registry_invalid",
          message: error instanceof Error ? error.message : "Schema registry failed",
        },
      ],
    };
  }

  let examplesValidated = 0;
  for (const binding of CONTRACT_EXAMPLE_BINDINGS) {
    const schema = registry.schemasByFile.get(binding.schemaFile);
    if (!schema) {
      issues.push({
        artifact: binding.exampleFile,
        code: "schema_binding_missing",
        message: "Missing validator for " + binding.schemaFile,
      });
      continue;
    }
    try {
      const example = await readContractExample(projectRoot, binding.exampleFile);
      examplesValidated += 1;
      if (!schema.validate(example)) {
        issues.push({
          artifact: binding.exampleFile,
          code: "example_invalid",
          message: formatAjvErrors(schema.validate.errors),
        });
      }
    } catch (error) {
      issues.push({
        artifact: binding.exampleFile,
        code: "example_unreadable",
        message: error instanceof Error ? error.message : "Example could not be read",
      });
    }
  }

  let openapiDocumentsValidated = 0;
  try {
    const openapi = await parseJson(resolve(projectRoot, OPENAPI_RELATIVE_PATH));
    openapiDocumentsValidated = 1;
    issues.push(...(await validateOpenApiDocument(projectRoot, openapi)));
  } catch (error) {
    issues.push({
      artifact: OPENAPI_RELATIVE_PATH,
      code: "openapi_unreadable",
      message: error instanceof Error ? error.message : "OpenAPI document could not be read",
    });
  }

  return {
    status: issues.length === 0 ? "valid" : "invalid",
    schemaDialect: JSON_SCHEMA_DIALECT,
    openapiVersion: OPENAPI_VERSION,
    schemasValidated: registry.schemasByFile.size,
    examplesValidated,
    openapiDocumentsValidated,
    issues,
  };
};

const isMainModule = (): boolean => {
  const entrypoint = process.argv[1];
  return Boolean(entrypoint) && import.meta.url === pathToFileURL(resolve(entrypoint)).href;
};

if (isMainModule()) {
  validateIntegrationContracts()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "valid") process.exitCode = 1;
    })
    .catch((error: unknown) => {
      console.error(
        JSON.stringify(
          {
            status: "invalid",
            code: "contract_validation_failed",
            message: error instanceof Error ? error.message : "Unexpected validation failure",
          },
          null,
          2
        )
      );
      process.exitCode = 1;
    });
}
