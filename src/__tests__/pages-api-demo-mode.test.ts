import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("Pages API configuration and demo mode", () => {
  it("adds a static Pages demo/API bridge", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /data-demo-mode/);
    assert.match(bridge, /data-api-url/);
    assert.match(bridge, /apiUrl/);
    assert.match(bridge, /window\.fetch = async/);
    assert.match(bridge, /endsWith\("\/api\/chat"\)/);
  });

  it("supports auto demo mode on GitHub Pages without inventing source links", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /hostname\.endsWith\("github\.io"\)/);
    assert.match(bridge, /demoMode === "auto"/);
    assert.match(bridge, /x-la-muni-rag-demo/);
    assert.match(bridge, /sourceUrl: null/);
    assert.match(bridge, /Respuesta de demostración estática para GitHub Pages/);
  });

  it("supports routing to a deployed API when configured", async () => {
    const bridge = await readSource("public/pages-demo-api.js");

    assert.match(bridge, /configuredApiUrl/);
    assert.match(bridge, /shouldProxy/);
    assert.match(bridge, /new URL\("\/api\/chat", configuredApiUrl\)/);
    assert.match(bridge, /nativeFetch\(targetUrl, init\)/);
  });

  it("injects and verifies the bridge in the Pages artifact", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /injectPagesDemoBridge/);
    assert.match(buildScript, /pages-demo-api\.js/);
    assert.match(buildScript, /data-demo-mode="auto"/);
    assert.match(verifyScript, /pages-demo-api\.js/);
    assert.match(verifyScript, /missing the demo\/API bridge/);
  });

  it("documents the feature boundary", async () => {
    const requirements = await readSource("specs/034-pages-api-configuration-and-demo-mode/requirements.md");
    const design = await readSource("specs/034-pages-api-configuration-and-demo-mode/design.md");

    assert.match(requirements, /No backend deployment/);
    assert.match(requirements, /No fake production API/);
    assert.match(design, /GitHub Pages can publish the frontend/);
    assert.match(design, /cannot run the Node API/);
  });
});
