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
      schemasValidated: 9,
      examplesValidated: 9,
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

  it("describes only the implemented provider POST operation with required security controls", async () => {
    const openapi = JSON.parse(
      await readFile(resolve(projectRoot, OPENAPI_RELATIVE_PATH), "utf8")
    );

    assert.equal(openapi.openapi, OPENAPI_VERSION);
    assert.equal(openapi.jsonSchemaDialect, JSON_SCHEMA_DIALECT);
    assert.deepEqual(Object.keys(openapi.paths), ["/api/v1/procedure-queries"]);
    assert.deepEqual(Object.keys(openapi.paths["/api/v1/procedure-queries"]), ["post"]);

    const operation = openapi.paths["/api/v1/procedure-queries"].post;
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
      ["200", "400", "401", "403", "409", "429", "500", "503"]
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
      "procedure_workflow_provider_implemented"
    );
  });
});
