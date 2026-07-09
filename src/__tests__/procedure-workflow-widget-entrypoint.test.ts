import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure workflow widget entrypoint", () => {
  it("adds a separate progressive-enhancement script for the widget", async () => {
    const script = await readSource("public/procedure-widget-entrypoint.js");

    assert.match(script, /Procedure Workflow Widget Entrypoint/);
    assert.match(script, /data-procedure-url/);
    assert.match(script, /procedure-workflow\.html/);
    assert.match(script, /muni-rag-widget/);
    assert.match(script, /shadowRoot/);
    assert.match(script, /procedure-workflow-entrypoint/);
  });

  it("adds both rail and welcome entrypoints without duplicating them", async () => {
    const script = await readSource("public/procedure-widget-entrypoint.js");

    assert.match(script, /makeRailEntrypoint/);
    assert.match(script, /makeWelcomeEntrypoint/);
    assert.match(script, /muni-header-rail/);
    assert.match(script, /muni-suggestions/);
    assert.match(script, /data-procedure-workflow-entrypoint/);
    assert.match(script, /querySelector\(\`\[\$\{ENTRY_ATTR\}=\"true\"\]\`\)/);
  });

  it("uses a bounded observer and is safe when the widget is missing", async () => {
    const script = await readSource("public/procedure-widget-entrypoint.js");

    assert.match(script, /MAX_ATTEMPTS = 80/);
    assert.match(script, /MutationObserver/);
    assert.match(script, /window\.setTimeout\(stop, 8000\)/);
    assert.match(script, /if \(!shadow\) return false/);
    assert.match(script, /observer\.disconnect\(\)/);
  });

  it("injects and verifies the entrypoint in GitHub Pages artifacts", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /procedure-widget-entrypoint\.js/);
    assert.match(buildScript, /<script src="\.\/procedure-widget-entrypoint\.js"><\/script>/);
    assert.match(verifyScript, /procedure-widget-entrypoint\.js/);
    assert.match(verifyScript, /missing the procedure workflow widget entrypoint/);
  });

  it("integrates the AI-native operating model from the attached transcript", async () => {
    const docs = await readSource("docs/ai-native-operating-model.md");

    assert.match(docs, /AI-native is culture/);
    assert.match(docs, /machine-readable signal/);
    assert.match(docs, /Governance comes before access/);
    assert.match(docs, /Internal APIs/);
    assert.match(docs, /outcome object/);
    assert.match(docs, /ProcedureWorkflow/);
    assert.match(docs, /simulators and evaluators/);
    assert.match(docs, /Everyone creates/);
  });
});
