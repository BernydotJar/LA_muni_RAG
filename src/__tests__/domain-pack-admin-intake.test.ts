import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("domain pack admin intake", () => {
  it("adds a local domain-aware document intake page", async () => {
    const html = await readSource("public/domain-intake.html");

    assert.match(html, /Intake documental pack-aware/);
    assert.match(html, /input-path/);
    assert.match(html, /manifest-path/);
    assert.match(html, /source-authority-class/);
    assert.match(html, /confidentiality/);
    assert.match(html, /metadata-preview/);
    assert.match(html, /command-preview/);
  });

  it("loads the active domain pack and builds a backfill command", async () => {
    const html = await readSource("public/domain-intake.html");

    assert.match(html, /fetch\("\/api\/domain-pack"/);
    assert.match(html, /sourceAuthorityClasses/);
    assert.match(html, /--domain-pack/);
    assert.match(html, /--source-authority-class/);
    assert.match(html, /--confidentiality/);
    assert.match(html, /node --import tsx src\/cli\/backfillCorpus\.ts/);
  });

  it("does not upload files or write to the backend from the intake page", async () => {
    const html = await readSource("public/domain-intake.html");

    assert.doesNotMatch(html, /type="file"/);
    assert.doesNotMatch(html, /method="post"/i);
    assert.doesNotMatch(html, /fetch\([^)]*\/api\/procedure-feedback/);
    assert.doesNotMatch(html, /DATABASE_URL|PROCEDURE_FEEDBACK_API_TOKEN|Bearer/);
  });

  it("includes the intake page in Pages build and verification", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /domain-intake\.html/);
    assert.match(verifyScript, /domain-intake\.html/);
    assert.match(verifyScript, /Domain intake page/);
  });

  it("links the workflow page to document intake", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /domain-intake\.html/);
    assert.match(html, /Intake documental/);
  });
});
