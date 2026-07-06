import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("GitHub Pages static deployment", () => {
  it("adds dedicated Pages build and verification scripts", async () => {
    const packageJson = await readSource("package.json");
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(packageJson, /"build:pages": "node scripts\/build-pages\.mjs"/);
    assert.match(buildScript, /const sourceDir = join\(repoRoot, "public"\)/);
    assert.match(buildScript, /const outputDir = join\(repoRoot, "dist-pages"\)/);
    assert.match(buildScript, /\.nojekyll/);
    assert.match(verifyScript, /requiredFiles/);
    assert.match(verifyScript, /GitHub Pages artifact verified/);
  });

  it("patches root-relative static links for project-page hosting", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /href=\"\/glass-wall\.html\"/);
    assert.match(buildScript, /href=\"\.\/glass-wall\.html\"/);
    assert.match(buildScript, /src=\"\/assets\//);
    assert.match(buildScript, /src=\"\.\/assets\//);
    assert.match(buildScript, /src=\"\/widget\.js\"/);
    assert.match(buildScript, /src=\"\.\/widget\.js\"/);
    assert.match(verifyScript, /forbiddenRootRelativePatterns/);
  });

  it("uses a static-only GitHub Pages actions flow", async () => {
    const workflow = await readSource(".github/workflows/deploy-pages.yml");

    assert.match(workflow, /actions\/configure-pages@v5/);
    assert.match(workflow, /actions\/upload-pages-artifact@v3/);
    assert.match(workflow, /actions\/deploy-pages@v4/);
    assert.match(workflow, /pages: write/);
    assert.match(workflow, /id-token: write/);
    assert.match(workflow, /node scripts\/build-pages\.mjs/);
    assert.match(workflow, /node scripts\/verify-pages-artifact\.mjs/);
    assert.match(workflow, /path: dist-pages/);
    assert.doesNotMatch(workflow, /npm run typecheck/);
    assert.doesNotMatch(workflow, /npm run test/);
    assert.doesNotMatch(workflow, /npm run build\n/);
  });

  it("documents the static-only boundary", async () => {
    const requirements = await readSource("specs/033-github-pages-static-deploy/requirements.md");
    const design = await readSource("specs/033-github-pages-static-deploy/design.md");

    assert.match(requirements, /No backend deployment/);
    assert.match(requirements, /No fake API endpoint/);
    assert.match(design, /GitHub Pages cannot run the Node server/);
    assert.match(design, /data-api-url/);
  });
});
