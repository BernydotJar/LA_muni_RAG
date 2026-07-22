import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  CONSUMER_CONTRACT_KIT_FILES,
  verifyAllConsumerContractKits,
} from "../integration/consumerContractKit.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-CONSUMER-CONTRACT-KIT-001 — portable provider contracts", () => {
  it("publishes exactly the two bounded consumer manifests", async () => {
    assert.deepEqual(CONSUMER_CONTRACT_KIT_FILES, [
      "os-electoral.json",
      "content-agency.json",
    ]);
    const result = await verifyAllConsumerContractKits(process.cwd());
    assert.equal(result.status, "valid", JSON.stringify(result.issues));
    assert.equal(result.kitsValidated, 2);
    assert.equal(result.interactionsValidated, 5);
  });

  it("keeps consumer-owned production fields outside provider examples", async () => {
    const [osKit, contentKit] = await Promise.all([
      read("contracts/consumer-kits/v1/os-electoral.json"),
      read("contracts/consumer-kits/v1/content-agency.json"),
    ]);
    assert.match(osKit, /campaign_strategy/);
    assert.match(contentKit, /content_calendar/);
    assert.doesNotMatch(osKit, /database_url|shared_filesystem|access_token/i);
    assert.doesNotMatch(contentKit, /database_url|shared_filesystem|access_token/i);
  });

  it("requires exact headers, statuses, schemas and canonical examples", async () => {
    const verifier = await read("src/integration/consumerContractKit.ts");
    assert.match(verifier, /sameSet\(advertisedHeaders, interaction\.required_headers\)/);
    assert.match(verifier, /success_status_drift/);
    assert.match(verifier, /error_status_drift/);
    assert.match(verifier, /request_schema_not_advertised/);
    assert.match(verifier, /response_schema_not_advertised/);
    assert.match(verifier, /forbidden_response_field/);
  });

  it("documents that provider verification is not cross-repository interoperability", async () => {
    const docs = await read("docs/integrations/consumer-contract-kits.md");
    assert.match(docs, /no prueba interoperabilidad entre repositorios/i);
    assert.match(docs, /no modifica OS\s+Electoral ni Content Agency/i);
    assert.match(docs, /E2E.*última capa/i);
  });
});
