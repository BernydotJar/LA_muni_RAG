import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("Pages production API configuration", () => {
  it("adds a fail-closed Pages API bridge", async () => {
    const bridge = await readSource("public/pages-api-bridge.js");
    assert.match(bridge, /data-api-url/);
    assert.match(bridge, /window\.__LA_MUNI_API_CONFIG__/);
    assert.match(bridge, /window\.fetch = async/);
    assert.match(bridge, /"\/api\/public\/v1\/query"/);
    assert.match(bridge, /"\/api\/procedure"/);
    assert.match(bridge, /"\/api\/domain-pack"/);
    assert.match(bridge, /service_unavailable/);
    assert.match(bridge, /status: 503/);
  });

  it("does not contain static answers, citations, procedures, or domain fixtures", async () => {
    const bridge = await readSource("public/pages-api-bridge.js");
    assert.doesNotMatch(bridge, /demoResponse|demoProcedureResponse|demoDomainPackResponse/);
    assert.doesNotMatch(bridge, /PDM-OT Antigua Guatemala|procedureStep|x-la-muni-rag-demo/);
    assert.match(bridge, /never emits[\s\S]*static answers, citations, procedures, or domain data/i);
  });

  it("routes only approved methods to an explicitly configured backend", async () => {
    const bridge = await readSource("public/pages-api-bridge.js");
    assert.match(bridge, /sanitizeApiBaseUrl/);
    assert.match(bridge, /parsed\.username = ""/);
    assert.match(bridge, /parsed\.password = ""/);
    assert.match(bridge, /credentials: "omit"/);
    assert.match(bridge, /redirect: "error"/);
    assert.match(bridge, /cache: "no-store"/);
    assert.match(bridge, /approvedRoutes/);
    assert.match(bridge, /new URL\(route\.targetPath \+ url\.search, configuredApiUrl\)/);
  });

  it("injects and verifies the production bridge in the Pages artifact", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");
    assert.match(buildScript, /PAGES_API_URL/);
    assert.match(buildScript, /sanitizePagesApiUrl/);
    assert.match(buildScript, /pages-api-bridge\.js/);
    assert.match(buildScript, /PAGES_API_BRIDGE/);
    assert.match(verifyScript, /pages-api-bridge\.js/);
    assert.match(verifyScript, /fail-closed API bridge/);
    assert.match(verifyScript, /still contains demo responses/);
  });

  it("rejects insecure production API configuration at build time", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    assert.match(buildScript, /must use https outside localhost/);
    assert.match(buildScript, /must not contain credentials, query parameters, or fragments/);
    assert.match(buildScript, /isLocalhost/);
  });
});
