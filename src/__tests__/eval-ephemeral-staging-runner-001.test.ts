import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import type { FormatsPlugin } from "ajv-formats";
import { loadEphemeralStagingPlan } from "../staging/ephemeralStagingPlan.js";
import {
  STAGING_DATABASES,
  STAGING_DATABASE_SCENARIOS,
  STAGING_RUNTIME_ROLES,
  assertStagingJourneyCoverage,
} from "../staging/ephemeralStagingRunner.js";

const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ?? addFormatsModule) as FormatsPlugin;
const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-EPHEMERAL-STAGING-RUNNER-001", () => {
  it("maps all 20 runnable API journeys exactly once and no browser journey", async () => {
    const plan = await loadEphemeralStagingPlan(process.cwd());
    assert.deepEqual(assertStagingJourneyCoverage(plan, STAGING_DATABASE_SCENARIOS), {
      apiJourneyCount: 20,
      browserJourneyCount: 12,
      mappedJourneyCount: 20,
      missingJourneyIds: [],
      duplicateJourneyIds: [],
      browserJourneyIds: [],
    });
  });

  it("uses four fixed disposable databases and three fixed non-owner runtime roles", () => {
    assert.deepEqual(STAGING_DATABASES, [
      "la_muni_rag_test",
      "la_muni_rag_catalog_test",
      "la_muni_rag_search_test",
      "la_muni_rag_ingestion_test",
    ]);
    assert.deepEqual(STAGING_RUNTIME_ROLES, [
      "la_muni_ingestion_runtime_test",
      "la_muni_search_runtime_test",
      "la_muni_runtime_test",
    ]);
    assert.equal(STAGING_DATABASE_SCENARIOS.length, 4);
    assert.ok(STAGING_DATABASE_SCENARIOS.every((scenario) => scenario.database.endsWith("_test")));
    assert.ok(STAGING_DATABASE_SCENARIOS.some((scenario) => scenario.reset?.smoke.id === "reset-integrity"));
  });

  it("runs only guarded SQL and compiled local smoke scripts", () => {
    const sqlFiles = STAGING_DATABASE_SCENARIOS.flatMap((scenario) => [
      ...scenario.sqlFiles,
      ...(scenario.reset?.sqlFiles ?? []),
    ]);
    const smokeScripts = STAGING_DATABASE_SCENARIOS.flatMap((scenario) => [
      ...scenario.smokes.map((smoke) => smoke.script),
      ...(scenario.reset ? [scenario.reset.smoke.script] : []),
    ]);
    assert.ok(sqlFiles.every((file) => /^db\/(migrations|tests)\/[a-z0-9_]+\.sql$/.test(file)));
    assert.ok(smokeScripts.every((file) => /^scripts\/[a-z0-9-]+\.mjs$/.test(file)));
    assert.ok(sqlFiles.includes("db/migrations/016_public_query_gateway.sql"));
    assert.ok(sqlFiles.includes("db/tests/staging_reset_runtime_gate.sql"));
    assert.ok(smokeScripts.includes("scripts/staging-reset-postgres-smoke.mjs"));
  });

  it("uses exact declared personas instead of permission-equivalent substitutes", async () => {
    const searchGate = await read("db/tests/search_evidence_api_runtime_gate.sql");
    const catalogGate = await read("db/tests/catalog_api_runtime_gate.sql");
    const caseGate = await read("db/tests/procedure_case_runtime_gate.sql");
    const catalogSmoke = await read("scripts/catalog-api-postgres-smoke.mjs");
    const caseSmoke = await read("scripts/procedure-case-postgres-smoke.mjs");
    assert.match(searchGate, /'viewer'/);
    assert.doesNotMatch(searchGate, /'researcher'/);
    assert.match(catalogGate, /'platform_admin'/);
    assert.match(catalogGate, /'tenant_admin'/);
    assert.match(catalogSmoke, /PLATFORM_ADMIN_TOKEN/);
    assert.match(catalogSmoke, /TENANT_ADMIN_TOKEN/);
    assert.match(caseGate, /procedure-case-operator-a/);
    assert.match(caseGate, /'case_operator'/);
    assert.match(caseSmoke, /CASE_TOKEN/);
    assert.doesNotMatch(caseSmoke, /AUTHOR_TOKEN/);
  });

  it("isolates child processes from local dotenv and does not invoke a shell", async () => {
    const executor = await read("src/staging/ephemeralStagingPostgresExecutor.ts");
    assert.match(executor, /DOTENV_CONFIG_PATH: "\/dev\/null"/);
    assert.match(executor, /execFileAsync\(process\.execPath/);
    assert.doesNotMatch(executor, /shell:\s*true/);
    assert.doesNotMatch(executor, /\.\.\.process\.env/);
    assert.match(executor, /staging_cluster_not_dedicated/);
    assert.match(executor, /SELECT EXISTS \(SELECT 1 FROM pg_database/);
    assert.match(executor, /DROP DATABASE \$\{quoteIdentifier\(name\)\}/);
    assert.match(executor, /SELECT EXISTS \(SELECT 1 FROM pg_roles/);
    assert.match(executor, /DROP ROLE \$\{quoteIdentifier\(name\)\}/);
  });

  it("publishes a closed receipt schema and validates before writing", async () => {
    const schema = JSON.parse(await read("contracts/staging/v1/ephemeral-staging-receipt.schema.json"));
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats(ajv);
    assert.doesNotThrow(() => ajv.compile(schema));
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.journeys.minItems, 20);
    assert.equal(schema.properties.journeys.maxItems, 20);
    const cli = await read("src/cli/runEphemeralStaging.ts");
    assert.match(cli, /STAGING_CONFIRM_EPHEMERAL/);
    assert.match(cli, /git", \["status", "--porcelain"/);
    assert.match(cli, /clean Git worktree/);
    assert.match(cli, /validateEphemeralStagingReceipt\(receipt/);
    assert.match(cli, /artifacts", "staging/);
    assert.match(cli, /mode: 0o600/);
  });

  it("keeps reset evidence empty and prevents authority or corpus claims", async () => {
    const gate = await read("db/tests/staging_reset_runtime_gate.sql");
    const smoke = await read("scripts/staging-reset-postgres-smoke.mjs");
    assert.match(gate, /fresh staging reset database contains sources/);
    assert.doesNotMatch(gate, /INSERT INTO rag\.sources/i);
    assert.match(smoke, /assert\.deepEqual\(body\.items, \[\]\)/);
    assert.doesNotMatch(smoke, /official_source|validated|production/i);
  });

  it("executes the named eval and real runner in CI without cloud provisioning", async () => {
    const workflow = await read(".github/workflows/ci.yml");
    assert.match(workflow, /Run EVAL-EPHEMERAL-STAGING-RUNNER-001/);
    assert.match(workflow, /npm run eval:staging-runner/);
    assert.match(workflow, /Execute ephemeral staging runner/);
    assert.match(workflow, /STAGING_CONFIRM_EPHEMERAL: "true"/);
    assert.match(workflow, /STAGING_CLEAN_EXISTING: "true"/);
    assert.match(workflow, /npm run staging:run/);
    assert.doesNotMatch(workflow, /terraform apply|gcloud run deploy|aws cloudformation deploy/i);
  });
});
