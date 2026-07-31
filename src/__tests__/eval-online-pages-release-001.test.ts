import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { normalizeBuildSha, sanitizePagesOnlineUrl } from "../../scripts/pages-build-metadata.mjs";

const read = (path: string): Promise<string> => readFile(path, "utf8");
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("EVAL-ONLINE-PAGES-RELEASE-001", () => {
  it("accepts only exact Git SHAs and safe online URLs", () => {
    assert.equal(normalizeBuildSha(SHA.toUpperCase()), SHA);
    assert.throws(() => normalizeBuildSha("abc"), /40-character/);
    assert.equal(sanitizePagesOnlineUrl("https://example.test/project"), "https://example.test/project/");
    assert.equal(sanitizePagesOnlineUrl("http://127.0.0.1:4173"), "http://127.0.0.1:4173/");
    assert.throws(() => sanitizePagesOnlineUrl("http://example.test/"), /HTTPS/);
    assert.throws(() => sanitizePagesOnlineUrl("https://user:pass@example.test/"), /credentials/);
    assert.throws(() => sanitizePagesOnlineUrl("https://example.test/?x=1"), /query/);
  });

  it("embeds bounded SHA metadata in the Pages artifact", async () => {
    const [build, verify] = await Promise.all([
      read("scripts/build-pages.mjs"),
      read("scripts/verify-pages-artifact.mjs"),
    ]);
    assert.match(build, /la-muni-rag-build-sha/);
    assert.match(build, /build-metadata\.json/);
    assert.match(build, /apiConfigured: Boolean\(pagesApiUrl\)/);
    assert.match(verify, /Pages build metadata does not match the expected Git SHA/);
    assert.match(verify, /Homepage is missing the exact Pages build SHA marker/);
  });

  it("verifies the exact deployed product in desktop and mobile Chromium", async () => {
    const online = await read("scripts/verify-pages-online.mjs");
    assert.match(online, /Pixel 7/);
    assert.match(online, /PAGES_ONLINE_WAIT_SECONDS/);
    assert.match(online, /cache-control/);
    assert.match(online, /deployed artifact SHA mismatch/);
    assert.match(online, /Navegación principal/);
    assert.match(online, /mainTabIndex/);
    assert.match(online, /browser runtime errors detected/);
    assert.match(online, /failed network requests detected/);
    assert.match(online, /unconfigured public page emitted an API request/);
  });

  it("runs exact-SHA verification after GitHub Pages deployment", async () => {
    const workflow = await read(".github/workflows/deploy-pages.yml");
    assert.match(workflow, /PAGES_BUILD_SHA: \$\{\{ github\.sha \}\}/);
    assert.doesNotMatch(workflow, /PAGES_BUILD_SHA: \$\{\{ github\.event\.before/);
    assert.match(workflow, /verify-online:/);
    assert.match(workflow, /PAGES_ONLINE_URL: \$\{\{ needs\.deploy\.outputs\.page_url \}\}/);
    assert.match(workflow, /EXPECTED_BUILD_SHA: \$\{\{ github\.sha \}\}/);
    assert.doesNotMatch(workflow, /EXPECTED_BUILD_SHA: \$\{\{ github\.event\.before/);
    assert.match(workflow, /PAGES_ONLINE_WAIT_SECONDS: 180/);
    assert.match(workflow, /npm run verify:pages:online/);
    const legacyRoot = await read("index.html");
    const legacyMetadata = JSON.parse(await read("build-metadata.json"));
    assert.match(legacyRoot, /\.\/dist-pages\/index\.html/);
    assert.equal(legacyMetadata.apiConfigured, true);
    const legacyWidgetEntrypoint = await read("dist-pages/procedure-widget-entrypoint.js");
    assert.match(legacyWidgetEntrypoint, /procedure/i);
  });

  it("keeps public deployment and authenticated journeys outside this implementation", async () => {
    const [spec, decision, runbook] = await Promise.all([
      read("specs/076-online-pages-release-verification-v1/spec.md"),
      read("docs/decisions/076-online-pages-release-verification-v1.md"),
      read("docs/testing/online-pages-release-verification.md"),
    ]);
    assert.match(spec, /temporarily deployed and exact-SHA verified online/i);
    assert.match(spec, /rollback pending/i);
    assert.match(spec, /authenticated browser journey/i);
    assert.match(spec, /No permanent Pages deployment, merge, production API enablement/i);
    assert.match(decision, /human authorization/i);
    assert.match(runbook, /rollback SHA\/ref/);
  });
});
