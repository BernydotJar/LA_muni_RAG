import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  CONSUMER_CONTRACT_KIT_FILES,
  verifyAllConsumerContractKits,
  verifyConsumerContractKit,
} from "../integration/consumerContractKit.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const copyProjectContracts = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "la-muni-consumer-kit-"));
  temporaryRoots.push(root);
  await cp(join(process.cwd(), "contracts"), join(root, "contracts"), { recursive: true });
  return root;
};

const mutateJson = async (
  root: string,
  relativePath: string,
  mutate: (value: Record<string, unknown>) => void
): Promise<void> => {
  const path = join(root, relativePath);
  const value = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
  mutate(value);
  await writeFile(path, JSON.stringify(value, null, 2) + "\n");
};

describe("portable consumer contract kit v1", () => {
  it("validates both canonical consumer kits against OpenAPI, schemas and examples", async () => {
    const result = await verifyAllConsumerContractKits(process.cwd());
    assert.equal(result.status, "valid", JSON.stringify(result.issues));
    assert.equal(result.kitsValidated, 2);
    assert.equal(result.interactionsValidated, 5);
    assert.deepEqual(result.kitFiles, [...CONSUMER_CONTRACT_KIT_FILES]);
  });

  it("rejects a declared path that is absent from OpenAPI", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/consumer-kits/v1/os-electoral.json", (kit) => {
      const interactions = kit.interactions as Array<Record<string, unknown>>;
      interactions[0]!.path = "/api/v1/not-implemented";
    });
    const result = await verifyConsumerContractKit(root, "os-electoral.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "openapi_path_missing"));
  });

  it("rejects a required header that the OpenAPI operation does not require", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/openapi/v1/openapi.json", (openapi) => {
      const paths = openapi.paths as Record<string, Record<string, Record<string, unknown>>>;
      const operation = paths["/api/v1/claim-packs"]!.post!;
      operation.parameters = (operation.parameters as Array<Record<string, unknown>>)
        .filter((parameter) => parameter.name !== "Idempotency-Key");
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "required_header_missing"));
  });

  it("rejects response schema drift from the OpenAPI interaction", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/consumer-kits/v1/content-agency.json", (kit) => {
      const interactions = kit.interactions as Array<Record<string, unknown>>;
      const response = interactions[0]!.response as Record<string, unknown>;
      response.schema_file = "evidence-bundle.schema.json";
      response.example_file = "evidence-bundle.valid.json";
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "response_schema_not_advertised"));
  });

  it("rejects consumer-owned fields injected into a provider response example", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/examples/v1/claim-pack.valid.json", (example) => {
      example.content_calendar = [];
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "forbidden_response_field"));
  });

  it("rejects a consumer-owned field added only to a response schema", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/schemas/v1/claim-pack.schema.json", (schema) => {
      const properties = schema.properties as Record<string, unknown>;
      properties.content_calendar = { type: "array", items: { type: "string" } };
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "forbidden_response_schema_field"));
  });

  it("rejects loss of the response correlation header", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/openapi/v1/openapi.json", (openapi) => {
      const paths = openapi.paths as Record<string, Record<string, Record<string, unknown>>>;
      const operation = paths["/api/v1/claim-packs"]!.post!;
      const responses = operation.responses as Record<string, Record<string, unknown>>;
      responses["200"]!.headers = {};
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "response_header_missing"));
  });

  it("rejects removal of a required consumer interaction", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/consumer-kits/v1/os-electoral.json", (kit) => {
      const interactions = kit.interactions as Array<Record<string, unknown>>;
      kit.interactions = interactions.filter((interaction) => interaction.name !== "procedure_query_assessment");
    });
    const result = await verifyConsumerContractKit(root, "os-electoral.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "interaction_set_drift"));
  });

  it("rejects removal of a required forbidden-field guard", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/consumer-kits/v1/content-agency.json", (kit) => {
      kit.forbidden_response_fields = (kit.forbidden_response_fields as string[])
        .filter((field) => field !== "content_calendar");
    });
    const result = await verifyConsumerContractKit(root, "content-agency.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "forbidden_field_guard_missing"));
  });

  it("rejects a procedure request example with the wrong output discriminator", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/examples/v1/procedure-query-assessment-request.valid.json", (example) => {
      example.requested_output = "procedure_workflow";
    });
    const result = await verifyConsumerContractKit(root, "os-electoral.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "request_discriminator_drift"));
  });

  it("rejects non-allowlisted kit paths without reading outside the kit directory", async () => {
    const result = await verifyConsumerContractKit(process.cwd(), "../../package.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "unknown_kit_file"));
  });

  it("rejects duplicate interaction names", async () => {
    const root = await copyProjectContracts();
    await mutateJson(root, "contracts/consumer-kits/v1/os-electoral.json", (kit) => {
      const interactions = kit.interactions as Array<Record<string, unknown>>;
      interactions[1]!.name = interactions[0]!.name;
    });
    const result = await verifyConsumerContractKit(root, "os-electoral.json");
    assert.equal(result.status, "invalid");
    assert.ok(result.issues.some((issue) => issue.code === "duplicate_interaction_name"));
  });
});
