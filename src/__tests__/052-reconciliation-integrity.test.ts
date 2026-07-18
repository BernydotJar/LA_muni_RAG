import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");
const lineCount = (content: string): number => content.split(/\r?\n/).length;

describe("Feature 052 post-merge reconciliation integrity", () => {
  it("rejects a truncated or compressed portfolio shell", async () => {
    const html = await readSource("public/procedure-case-portfolio.html");

    assert.ok(lineCount(html) >= 70, "portfolio HTML must remain reviewable and multi-line");
    assert.doesNotMatch(html, /<!doctype html><html/i);
    assert.match(html, /<main class="shell">/);
    assert.match(html, /id="case-list"/);
    assert.match(html, /procedure-case-portfolio-data\.js/);
    assert.match(html, /procedure-case-portfolio\.js/);
    assert.match(html, /<\/body>\s*<\/html>\s*$/);
  });

  it("keeps source attribution readable and explicit", async () => {
    const renderer = await readSource("public/procedure-source-attribution.js");

    assert.ok(lineCount(renderer) >= 100, "source attribution renderer must remain reviewable");
    assert.match(renderer, /Abrir fuente oficial/);
    assert.match(renderer, /Abrir referencia comparativa/);
    assert.match(renderer, /Abrir fuente contextual/);
    assert.match(renderer, /noopener noreferrer/);
  });

  it("keeps the complete procedure contract", async () => {
    const types = await readSource("src/procedure/types.ts");

    assert.ok(lineCount(types) >= 100, "procedure contract must not be truncated");
    assert.match(types, /export interface ProcedureWorkflow/);
    assert.match(types, /export interface ProcedureEvidenceBundle/);
    assert.match(types, /generatedBy:/);
    assert.match(types, /hasAntiguaEvidence:/);
  });

  it("uses the Node loader for deterministic domain evaluation", async () => {
    const packageJson = JSON.parse(await readSource("package.json")) as {
      scripts?: Record<string, string>;
    };

    assert.equal(
      packageJson.scripts?.["domain:evaluate"],
      "node --import tsx src/cli/evaluateDomainPacks.ts"
    );
  });
});
