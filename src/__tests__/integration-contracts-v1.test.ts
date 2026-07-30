import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CONTRACT_EXAMPLE_BINDINGS,
  JSON_SCHEMA_DIALECT,
  OPENAPI_RELATIVE_PATH,
  OPENAPI_VERSION,
  loadIntegrationContractRegistry,
  readContractExample,
  validateIntegrationContracts,
} from "../cli/validateIntegrationContracts.js";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const clone = <T>(value: T): T => structuredClone(value);

const schemaValidator = async (fileName: string) => {
  const registry = await loadIntegrationContractRegistry(projectRoot);
  const artifact = registry.schemasByFile.get(fileName);
  assert.ok(artifact, "Missing schema " + fileName);
  return artifact.validate;
};

describe("integration contracts v1", () => {
  it("validates every draft 2020-12 schema, example, and bounded OpenAPI document", async () => {
    const result = await validateIntegrationContracts(projectRoot);

    assert.deepEqual(result, {
      status: "valid",
      schemaDialect: JSON_SCHEMA_DIALECT,
      openapiVersion: OPENAPI_VERSION,
      schemasValidated: 33,
      examplesValidated: 33,
      openapiDocumentsValidated: 1,
      issues: [],
    });
  });

  it("closes every top-level contract and validates all examples independently", async () => {
    const registry = await loadIntegrationContractRegistry(projectRoot);

    for (const binding of CONTRACT_EXAMPLE_BINDINGS) {
      const artifact = registry.schemasByFile.get(binding.schemaFile);
      assert.ok(artifact);
      assert.equal(artifact.schema.$schema, JSON_SCHEMA_DIALECT);
      assert.equal(artifact.schema.additionalProperties, false);
      const example = await readContractExample(projectRoot, binding.exampleFile);
      assert.equal(
        artifact.validate(example),
        true,
        binding.exampleFile + ": " + JSON.stringify(artifact.validate.errors)
      );
    }
  });

  it("requires UUID tenant/request ids while allowing safe opaque campaign/community ids", async () => {
    const validate = await schemaValidator("procedure-query-request.schema.json");
    const valid = await readContractExample(projectRoot, "procedure-query-request.valid.json");
    assert.equal(validate(valid), true);

    const badTenant = clone(valid);
    badTenant.tenant_id = "tenant-antigua";
    assert.equal(validate(badTenant), false);

    const badRequest = clone(valid);
    badRequest.request_id = "request-1";
    assert.equal(validate(badRequest), false);

    const opaqueIds = clone(valid);
    opaqueIds.campaign_id = "campaign:antigua.2027";
    opaqueIds.community_id = "community-san_mateo";
    assert.equal(validate(opaqueIds), true);
  });

  it("negotiates exactly one response artifact in v1", async () => {
    const validate = await schemaValidator("procedure-query-request.schema.json");
    const request = await readContractExample(
      projectRoot,
      "procedure-query-request.valid.json"
    );

    const unsupportedAggregate = clone(request);
    unsupportedAggregate.requested_output = "all";
    assert.equal(validate(unsupportedAggregate), false);
  });

  it("keeps ingestion submission and status contracts strict and digest-bound", async () => {
    const validateRequest = await schemaValidator("ingestion-job-request.schema.json");
    const validateResponse = await schemaValidator("ingestion-job-response.schema.json");
    const request = await readContractExample(
      projectRoot,
      "ingestion-job-request.valid.json"
    );
    const response = await readContractExample(
      projectRoot,
      "ingestion-job-response.valid.json"
    );
    assert.equal(validateRequest(request), true);
    assert.equal(validateResponse(response), true);

    const uppercaseDigest = clone(request);
    uppercaseDigest.artifact_sha256 = "A".repeat(64);
    assert.equal(validateRequest(uppercaseDigest), false);

    const callerSelectedProvider = clone(request);
    callerSelectedProvider.embedding_provider = "untrusted-provider";
    assert.equal(validateRequest(callerSelectedProvider), false);

    const leakedLease = clone(response);
    const leakedJob = leakedLease.job as Record<string, unknown>;
    leakedJob.lease_token = "must-never-cross-the-api";
    assert.equal(validateResponse(leakedLease), false);
  });

  it("minimizes ProcedureAssessment narrative case context at the contract boundary", async () => {
    const assessmentSchema = JSON.parse(
      await readFile(
        new URL("../../contracts/schemas/v1/procedure-assessment.schema.json", import.meta.url),
        "utf8"
      )
    ) as {
      properties: {
        case_context: {
          allOf: Array<Record<string, unknown>>;
        };
      };
    };
    const minimization = assessmentSchema.properties.case_context.allOf[1] as {
      properties: {
        facts: { type: string; maxItems: number };
        constraints: { type: string; maxItems: number };
      };
    };
    const example = JSON.parse(
      await readFile(
        new URL("../../contracts/examples/v1/procedure-assessment.valid.json", import.meta.url),
        "utf8"
      )
    ) as { case_context: { facts: unknown[]; constraints: unknown[] } };

    assert.equal(minimization.properties.facts.type, "array");
    assert.equal(minimization.properties.facts.maxItems, 0);
    assert.equal(minimization.properties.constraints.type, "array");
    assert.equal(minimization.properties.constraints.maxItems, 0);
    assert.deepEqual(example.case_context.facts, []);
    assert.deepEqual(example.case_context.constraints, []);
  });

  it("keeps workflow lifecycle requests action-bound and every AI draft unapproved", async () => {
    const draftValidate = await schemaValidator("workflow-draft-request.schema.json");
    const reviewValidate = await schemaValidator("workflow-review-request.schema.json");
    const approvalValidate = await schemaValidator("workflow-approval-request.schema.json");
    const versionValidate = await schemaValidator("workflow-version.schema.json");
    const draft = await readContractExample(projectRoot, "workflow-draft-request.valid.json");
    const review = await readContractExample(projectRoot, "workflow-review-request.valid.json");
    const approval = await readContractExample(projectRoot, "workflow-approval-request.valid.json");
    const version = await readContractExample(projectRoot, "workflow-version.valid.json");
    assert.equal(draftValidate(draft), true);
    assert.equal(reviewValidate(review), true);
    assert.equal(approvalValidate(approval), true);
    assert.equal(versionValidate(version), true);

    const promotedDraft = clone(draft);
    const promotedDefinition = promotedDraft.workflow_definition as Record<string, unknown>;
    promotedDefinition.approval_status = "approved";
    assert.equal(draftValidate(promotedDraft), false);

    const submitWithDecision = clone(review);
    submitWithDecision.action = "submit_for_review";
    assert.equal(reviewValidate(submitWithDecision), false);

    const reviewWithoutDecision = clone(review);
    delete reviewWithoutDecision.decision;
    assert.equal(reviewValidate(reviewWithoutDecision), false);

    const supersedeWithoutReplacement = clone(approval);
    supersedeWithoutReplacement.action = "supersede";
    assert.equal(approvalValidate(supersedeWithoutReplacement), false);

    const approveWithReplacement = clone(approval);
    approveWithReplacement.replacement_workflow_version_id =
      "99999999-9999-4999-8999-999999999999";
    assert.equal(approvalValidate(approveWithReplacement), false);
  });

  it("models unknown authentication identity only for 401 errors", async () => {
    const validate = await schemaValidator("api-error.schema.json");
    const unauthorized = await readContractExample(
      projectRoot,
      "api-error-unauthorized.valid.json"
    );
    const forbidden = await readContractExample(projectRoot, "api-error.valid.json");

    assert.equal(validate(unauthorized), true);
    assert.equal(validate(forbidden), true);

    const unauthorizedWithTenant = clone(unauthorized);
    unauthorizedWithTenant.tenant_id = "11111111-1111-4111-8111-111111111111";
    assert.equal(validate(unauthorizedWithTenant), false);

    const unauthorizedWithCredential = clone(unauthorized);
    const unauthorizedProvenance = unauthorizedWithCredential.provenance as Record<
      string,
      unknown
    >;
    unauthorizedProvenance.credential_id =
      "33333333-3333-4333-8333-333333333333";
    assert.equal(validate(unauthorizedWithCredential), false);

    const leakingUnauthorized = clone(unauthorized);
    const leakingUnauthorizedError = leakingUnauthorized.error as Record<string, unknown>;
    leakingUnauthorizedError.message = "Credential expired";
    assert.equal(validate(leakingUnauthorized), false);

    const forbiddenWithoutTenant = clone(forbidden);
    forbiddenWithoutTenant.tenant_id = null;
    assert.equal(validate(forbiddenWithoutTenant), false);

    const forbiddenWithoutCredential = clone(forbidden);
    const forbiddenProvenance = forbiddenWithoutCredential.provenance as Record<
      string,
      unknown
    >;
    forbiddenProvenance.credential_id = null;
    assert.equal(validate(forbiddenWithoutCredential), false);
  });

  it("keeps forbidden responses uniform and non-leaking", async () => {
    const validate = await schemaValidator("api-error.schema.json");
    const forbidden = await readContractExample(projectRoot, "api-error.valid.json");
    const error = forbidden.error as Record<string, unknown>;

    assert.deepEqual(error, {
      code: "forbidden",
      message: "Access denied",
      details: [],
    });
    assert.equal(validate(forbidden), true);

    const leakingTenantReason = clone(forbidden);
    const leakingError = leakingTenantReason.error as Record<string, unknown>;
    leakingError.code = "tenant_access_denied";
    leakingError.message = "Credential lacks access to tenant 123";
    leakingError.details = [{ field: "tenant_id", issue: "Tenant exists" }];
    assert.equal(validate(leakingTenantReason), false);
  });

  it("keeps every AI workflow in draft while allowing human lifecycle transitions", async () => {
    const validate = await schemaValidator("procedure-workflow.schema.json");
    const example = await readContractExample(projectRoot, "procedure-workflow.valid.json");
    assert.equal(validate(example), true);

    const invalidAiApproval = clone(example);
    invalidAiApproval.approval_status = "approved";
    assert.equal(validate(invalidAiApproval), false);

    const reviewedByHuman = clone(example);
    const provenance = reviewedByHuman.provenance as Record<string, unknown>;
    provenance.generated_by = "human";
    reviewedByHuman.approval_status = "approved";
    assert.equal(validate(reviewedByHuman), true);
  });

  it("enforces the canonical Mixco comparative boundary", async () => {
    const validate = await schemaValidator("evidence-bundle.schema.json");
    const example = await readContractExample(projectRoot, "evidence-bundle.valid.json");
    assert.equal(validate(example), true);

    const promotedMixco = clone(example);
    assert.ok(Array.isArray(promotedMixco.sources));
    promotedMixco.sources[0].authority_status = "official_target_jurisdiction";
    promotedMixco.sources[0].official_for_target_jurisdiction = true;
    assert.equal(validate(promotedMixco), false);

    const warningRemoved = clone(example);
    assert.ok(Array.isArray(warningRemoved.sources));
    warningRemoved.sources[0].limitations = ["Referencia externa."];
    assert.equal(validate(warningRemoved), false);
  });

  it("allows a null source URL only while the source is missing", async () => {
    const validate = await schemaValidator("evidence-bundle.schema.json");
    const evidence = await readContractExample(projectRoot, "evidence-bundle.valid.json");

    const missingSource = clone(evidence);
    assert.ok(Array.isArray(missingSource.sources));
    missingSource.sources[0].status = "missing_source";
    missingSource.sources[0].source_url = null;
    assert.equal(validate(missingSource), true);

    const verifiedWithoutUrl = clone(evidence);
    assert.ok(Array.isArray(verifiedWithoutUrl.sources));
    verifiedWithoutUrl.sources[0].status = "verified";
    verifiedWithoutUrl.sources[0].source_url = null;
    assert.equal(validate(verifiedWithoutUrl), false);

    const missingWithKnownUrl = clone(evidence);
    assert.ok(Array.isArray(missingWithKnownUrl.sources));
    missingWithKnownUrl.sources[0].status = "missing_source";
    assert.equal(validate(missingWithKnownUrl), true);
  });

  it("keeps ClaimPack requests Content-Agency-only and free of production fields", async () => {
    const validate = await schemaValidator("claim-pack-request.schema.json");
    const request = await readContractExample(projectRoot, "claim-pack-request.valid.json");
    assert.equal(validate(request), true);

    const osProvenance = clone(request);
    const provenance = osProvenance.provenance as Record<string, unknown>;
    provenance.source_product = "os_electoral";
    assert.equal(validate(osProvenance), false);

    for (const field of ["campaign_id", "community_id", "content_brief", "channels", "copy"]) {
      const extra = clone(request);
      extra[field] = field === "channels" ? ["social"] : "not-allowed";
      assert.equal(validate(extra), false, `unexpectedly allowed ${field}`);
    }
  });

  it("rejects campaign strategy in responses and content generation in ClaimPack", async () => {
    const validateEvidence = await schemaValidator("evidence-bundle.schema.json");
    const evidence = await readContractExample(projectRoot, "evidence-bundle.valid.json");
    const campaignResponse = clone(evidence);
    campaignResponse.campaign_strategy = {
      objective: "Convert evidence into voter targeting",
    };
    assert.equal(validateEvidence(campaignResponse), false);

    const validateClaimPack = await schemaValidator("claim-pack.schema.json");
    const claimPack = await readContractExample(projectRoot, "claim-pack.valid.json");
    const contentArtifact = clone(claimPack);
    contentArtifact.generated_content = ["social post"];
    assert.equal(validateClaimPack(contentArtifact), false);

    const enabledGeneration = clone(claimPack);
    const scope = enabledGeneration.allowed_paraphrase_scope as Record<string, unknown>;
    scope.content_generation_allowed = true;
    assert.equal(validateClaimPack(enabledGeneration), false);
  });

  it("binds EventEnvelope payload_type to the declared payload schema", async () => {
    const validate = await schemaValidator("event-envelope.schema.json");
    const envelope = await readContractExample(projectRoot, "event-envelope.valid.json");
    assert.equal(validate(envelope), true);

    const mismatched = clone(envelope);
    mismatched.payload_type = "api_error";
    assert.equal(validate(mismatched), false);
  });

  it("describes only the implemented v1 route surface with required security controls", async () => {
    const openapi = JSON.parse(
      await readFile(resolve(projectRoot, OPENAPI_RELATIVE_PATH), "utf8")
    );

    assert.equal(openapi.openapi, OPENAPI_VERSION);
    assert.equal(openapi.jsonSchemaDialect, JSON_SCHEMA_DIALECT);
    assert.deepEqual(Object.keys(openapi.paths), [
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
      "/api/v1/search",
      "/api/v1/evidence-bundles",
      "/api/public/v1/query",
    ]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/claim-packs"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/evidence-gap-requests"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/procedure-queries"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/ingestion-jobs"]), ["post", "get"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/ingestion-jobs/{job_id}"]), ["get"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/workflow-drafts"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/workflow-reviews"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/workflow-approvals"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/workflows/{workflow_version_id}"]), ["get"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/procedure-cases"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/procedure-cases/{case_id}"]), ["get", "patch"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/sources"]), ["get", "post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/documents"]), ["get", "post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/procedures"]), ["get"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/search"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/evidence-bundles"]), ["post"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/public/v1/query"]), ["post"]);
    const publicQuery = openapi.paths["/api/public/v1/query"].post;
    assert.deepEqual(publicQuery.security, []);
    assert.equal(publicQuery.requestBody.content["application/json"].schema.$ref, "../../schemas/v1/public-query-request.schema.json");
    assert.equal(publicQuery.responses["200"].content["application/json"].schema.$ref, "../../schemas/v1/public-query-response.schema.json");
    assert.deepEqual(Object.keys(publicQuery.responses), ["200", "400", "403", "405", "429", "500", "503"]);

    const sourceCreate = openapi.paths["/api/v1/sources"].post;
    const sourceList = openapi.paths["/api/v1/sources"].get;
    const documentCreate = openapi.paths["/api/v1/documents"].post;
    const documentList = openapi.paths["/api/v1/documents"].get;
    const ingestionList = openapi.paths["/api/v1/ingestion-jobs"].get;
    const procedureList = openapi.paths["/api/v1/procedures"].get;
    const search = openapi.paths["/api/v1/search"].post;
    const evidenceBundle = openapi.paths["/api/v1/evidence-bundles"].post;
    for (const catalogOperation of [sourceCreate, sourceList, documentCreate, documentList, ingestionList, procedureList]) {
      assert.deepEqual(catalogOperation.security, [{ bearerAuth: [] }]);
    }
    assert.equal(sourceCreate.requestBody.content["application/json"].schema.$ref, "../../schemas/v1/source-create-request.schema.json");
    assert.equal(sourceCreate.responses["201"].content["application/json"].schema.$ref, "../../schemas/v1/source-response.schema.json");
    assert.equal(documentCreate.requestBody.content["application/json"].schema.$ref, "../../schemas/v1/document-create-request.schema.json");
    assert.equal(documentCreate.responses["201"].content["application/json"].schema.$ref, "../../schemas/v1/document-response.schema.json");
    assert.equal(sourceList.responses["200"].content["application/json"].schema.$ref, "../../schemas/v1/source-list-response.schema.json");
    assert.equal(documentList.responses["200"].content["application/json"].schema.$ref, "../../schemas/v1/document-list-response.schema.json");
    assert.equal(ingestionList.responses["200"].content["application/json"].schema.$ref, "../../schemas/v1/ingestion-job-list-response.schema.json");
    assert.equal(procedureList.responses["200"].content["application/json"].schema.$ref, "../../schemas/v1/procedure-list-response.schema.json");
    assert.deepEqual(search.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      search.parameters.map((parameter: { name: string }) => parameter.name),
      ["X-Request-Id"]
    );
    assert.equal(
      search.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/search-request.schema.json"
    );
    assert.equal(
      search.responses["200"].content["application/json"].schema.$ref,
      "../../schemas/v1/search-response.schema.json"
    );
    assert.deepEqual(
      Object.keys(search.responses),
      ["200", "400", "401", "403", "429", "500", "503"]
    );
    assert.deepEqual(evidenceBundle.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      evidenceBundle.parameters.map((parameter: { name: string }) => parameter.name),
      ["Idempotency-Key", "X-Request-Id"]
    );
    assert.equal(
      evidenceBundle.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/evidence-bundle-request.schema.json"
    );
    assert.equal(
      evidenceBundle.responses["200"].content["application/json"].schema.$ref,
      "../../schemas/v1/evidence-bundle.schema.json"
    );
    assert.deepEqual(
      Object.keys(evidenceBundle.responses),
      ["200", "400", "401", "403", "409", "429", "500", "503"]
    );

    const claimPack = openapi.paths["/api/v1/claim-packs"].post;
    const evidenceGap = openapi.paths["/api/v1/evidence-gap-requests"].post;
    const operation = openapi.paths["/api/v1/procedure-queries"].post;
    const procedureCaseCreate = openapi.paths["/api/v1/procedure-cases"].post;
    const procedureCaseGet = openapi.paths["/api/v1/procedure-cases/{case_id}"].get;
    const procedureCasePatch = openapi.paths["/api/v1/procedure-cases/{case_id}"].patch;
    assert.deepEqual(claimPack.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      claimPack.parameters.map((parameter: { name: string }) => parameter.name),
      ["Idempotency-Key", "X-Request-Id"]
    );
    assert.equal(
      claimPack.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/claim-pack-request.schema.json"
    );
    assert.equal(
      claimPack.responses["200"].content["application/json"].schema.$ref,
      "../../schemas/v1/claim-pack.schema.json"
    );
    assert.deepEqual(
      Object.keys(claimPack.responses),
      ["200", "400", "401", "403", "409", "429", "500"]
    );
    assert.deepEqual(evidenceGap.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      evidenceGap.parameters.map((parameter: { name: string }) => parameter.name),
      ["Idempotency-Key", "X-Request-Id"]
    );
    assert.equal(
      evidenceGap.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/evidence-gap-request.schema.json"
    );
    assert.equal(
      evidenceGap.responses["200"].content["application/json"].schema.$ref,
      "../../schemas/v1/evidence-gap-response.schema.json"
    );
    assert.deepEqual(
      Object.keys(evidenceGap.responses),
      ["200", "400", "401", "403", "409", "429", "500"]
    );
    assert.match(evidenceGap.description, /does not declare any source official/);
    assert.deepEqual(
      operation.responses["200"].content["application/json"].schema.oneOf.map(
        (schema: { $ref: string }) => schema.$ref
      ),
      [
        "../../schemas/v1/evidence-bundle.schema.json",
        "../../schemas/v1/procedure-workflow.schema.json",
        "../../schemas/v1/procedure-assessment.schema.json",
      ]
    );
    assert.deepEqual(procedureCaseCreate.security, [{ bearerAuth: [] }]);
    assert.equal(
      procedureCaseCreate.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/procedure-case-request.schema.json"
    );
    assert.equal(
      procedureCaseCreate.responses["201"].content["application/json"].schema.$ref,
      "../../schemas/v1/procedure-case.schema.json"
    );
    assert.deepEqual(procedureCaseGet.security, [{ bearerAuth: [] }]);
    assert.deepEqual(procedureCasePatch.security, [{ bearerAuth: [] }]);
    assert.equal(
      procedureCasePatch.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/procedure-case-request.schema.json"
    );

    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      operation.parameters.map((parameter: { name: string }) => parameter.name),
      ["Idempotency-Key", "X-Request-Id"]
    );
    assert.ok(
      operation.parameters.every((parameter: { required: boolean }) => parameter.required)
    );
    assert.deepEqual(
      Object.keys(operation.responses),
      ["200", "400", "401", "403", "409", "429", "500"]
    );
    const enqueue = openapi.paths["/api/v1/ingestion-jobs"].post;
    const status = openapi.paths["/api/v1/ingestion-jobs/{job_id}"].get;
    assert.deepEqual(enqueue.security, [{ bearerAuth: [] }]);
    assert.deepEqual(status.security, [{ bearerAuth: [] }]);
    assert.deepEqual(
      enqueue.parameters.map((parameter: { name: string }) => parameter.name),
      ["Idempotency-Key", "X-Request-Id"]
    );
    assert.deepEqual(
      status.parameters.map((parameter: { name: string }) => parameter.name),
      ["job_id", "X-Request-Id"]
    );
    assert.deepEqual(
      Object.keys(enqueue.responses),
      ["200", "202", "400", "401", "403", "409", "429", "500", "503"]
    );
    assert.deepEqual(
      Object.keys(status.responses),
      ["200", "400", "401", "403", "404", "429", "500"]
    );
    const workflowDraft = openapi.paths["/api/v1/workflow-drafts"].post;
    const workflowReview = openapi.paths["/api/v1/workflow-reviews"].post;
    const workflowApproval = openapi.paths["/api/v1/workflow-approvals"].post;
    const workflowRead = openapi.paths["/api/v1/workflows/{workflow_version_id}"].get;
    for (const lifecycleOperation of [workflowDraft, workflowReview, workflowApproval, workflowRead]) {
      assert.deepEqual(lifecycleOperation.security, [{ bearerAuth: [] }]);
    }
    for (const lifecycleOperation of [workflowDraft, workflowReview, workflowApproval]) {
      assert.deepEqual(
        lifecycleOperation.parameters.map((parameter: { name: string }) => parameter.name),
        ["Idempotency-Key", "X-Request-Id"]
      );
    }
    assert.deepEqual(
      workflowRead.parameters.map((parameter: { name: string }) => parameter.name),
      ["workflow_version_id", "X-Request-Id"]
    );
    assert.equal(
      workflowDraft.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/workflow-draft-request.schema.json"
    );
    assert.equal(
      workflowReview.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/workflow-review-request.schema.json"
    );
    assert.equal(
      workflowApproval.requestBody.content["application/json"].schema.$ref,
      "../../schemas/v1/workflow-approval-request.schema.json"
    );
    assert.deepEqual(
      Object.keys(workflowDraft.responses),
      ["201", "400", "401", "403", "409", "429", "500"]
    );
    assert.deepEqual(
      Object.keys(workflowReview.responses),
      ["200", "400", "401", "403", "404", "409", "429", "500"]
    );
    assert.deepEqual(
      Object.keys(workflowApproval.responses),
      ["200", "400", "401", "403", "404", "409", "429", "500"]
    );
    assert.deepEqual(
      Object.keys(workflowRead.responses),
      ["200", "400", "401", "403", "404", "429", "500"]
    );
    assert.equal(openapi.components.securitySchemes.bearerAuth.type, "http");
    assert.equal(openapi.components.securitySchemes.bearerAuth.scheme, "bearer");
    assert.equal(
      openapi.components.headers.WWWAuthenticate.schema.const,
      'Bearer realm="la-muni-rag"'
    );
    assert.equal(
      operation.parameters[0].schema.pattern,
      "^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$"
    );
    assert.deepEqual(
      openapi.components.responses.Unauthorized.headers["WWW-Authenticate"],
      { $ref: "#/components/headers/WWWAuthenticate" }
    );
    assert.equal(
      openapi["x-implementation-status"],
      "catalog_search_evidence_claim_pack_gap_procedure_ingestion_workflow_case_providers_implemented_with_limits"
    );
  });
});
