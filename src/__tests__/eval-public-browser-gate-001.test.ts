import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-PUBLIC-BROWSER-GATE-001", () => {
  it("pins Playwright and executes Chromium desktop and mobile projects", async () => {
    const [pkg, config, lock] = await Promise.all([
      read("package.json"),
      read("playwright.config.ts"),
      read("package-lock.json"),
    ]);
    assert.match(pkg, /"@playwright\/test": "1\.62\.0"/);
    assert.match(pkg, /"test:browser:public": "playwright test"/);
    assert.match(lock, /node_modules\/@playwright\/test/);
    assert.match(config, /chromium-desktop/);
    assert.match(config, /chromium-mobile/);
    assert.match(config, /Pixel 7/);
    assert.match(config, /America\/Guatemala/);
    assert.match(config, /retain-on-failure/);
  });

  it("uses a loopback-only server and keeps the bridge harness outside public assets", async () => {
    const [server, build] = await Promise.all([
      read("scripts/serve-pages-test.mjs"),
      read("scripts/build-pages.mjs"),
    ]);
    assert.match(server, /const host = "127\.0\.0\.1"/);
    assert.match(server, /__playwright__\/bridge-harness\.html/);
    assert.match(server, /must-not-leave-browser|observedHeaders/);
    assert.match(server, /invalid_path/);
    assert.doesNotMatch(build, /serve-pages-test|bridge-harness/);
  });

  it("covers public responsive, focus, fail-closed, storage and credential boundaries", async () => {
    const test = await read("tests/browser/public-pages.spec.ts");
    assert.match(test, /scrollWidth > window\.innerWidth/);
    assert.match(test, /Saltar al contenido/);
    assert.match(test, /Servicio no configurado/);
    assert.match(test, /reducedMotion: "reduce"/);
    assert.match(test, /la-muni-rag:training-progress:v1/);
    assert.match(test, /HTTP 503/);
    assert.match(test, /authorization: null/);
    assert.match(test, /cookie: null/);
    assert.match(test, /public page emitted browser runtime errors/);
  });

  it("runs in a separate pinned CI workflow", async () => {
    const workflow = await read(".github/workflows/public-browser.yml");
    assert.match(workflow, /name: Public Browser Gate/);
    assert.match(workflow, /actions\/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd/);
    assert.match(workflow, /actions\/setup-node@a0853c24544627f65ddf259abe73b1d18a591444/);
    assert.match(workflow, /npm ci/);
    assert.match(workflow, /playwright install --with-deps chromium/);
    assert.match(workflow, /npm run test:browser:public/);
    assert.match(workflow, /actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02/);
    assert.match(workflow, /if: failure\(\)/);
  });

  it("preserves the authenticated browser blocker and avoids product-boundary overclaims", async () => {
    const [spec, decision, testing, staging] = await Promise.all([
      read("specs/075-public-browser-gate-v1/spec.md"),
      read("docs/decisions/075-public-browser-gate-v1.md"),
      read("docs/testing/public-browser-gate.md"),
      read("docs/testing/ephemeral-staging-e2e-architecture.md"),
    ]);
    for (const document of [spec, decision, testing]) {
      assert.match(document, /twelve authenticated(?: browser)? journeys|12 authenticated(?: browser)? journeys/i);
      assert.match(document, /remain blocked|blocked/i);
    }
    assert.match(staging, /Twelve planned browser journeys/i);
    assert.match(staging, /blocked/);
    assert.doesNotMatch(spec, /authenticated.*passed|production ready/i);
  });
});
