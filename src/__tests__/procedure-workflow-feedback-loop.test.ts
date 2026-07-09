import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure workflow feedback loop", () => {
  it("dispatches a workflow-rendered event after rendering a procedure workflow", async () => {
    const html = await readSource("public/procedure-workflow.html");

    assert.match(html, /procedure-workflow:rendered/);
    assert.match(html, /new CustomEvent\("procedure-workflow:rendered", \{ detail: \{ workflow \} \}\)/);
    assert.match(html, /<script src="\.\/procedure-feedback\.js"><\/script>/);
  });

  it("adds a local feedback script with a namespaced storage key", async () => {
    const script = await readSource("public/procedure-feedback.js");

    assert.match(script, /Procedure Workflow Feedback Loop/);
    assert.match(script, /la-muni-rag:procedure-feedback/);
    assert.match(script, /window\.localStorage\.getItem\(STORAGE_KEY\)/);
    assert.match(script, /window\.localStorage\.setItem\(STORAGE_KEY/);
    assert.match(script, /procedure-feedback-panel/);
  });

  it("captures workflow metadata, selected step, feedback type, and comment", async () => {
    const script = await readSource("public/procedure-feedback.js");

    assert.match(script, /workflowId/);
    assert.match(script, /workflowTitle/);
    assert.match(script, /procedureType/);
    assert.match(script, /jurisdiction/);
    assert.match(script, /confidence/);
    assert.match(script, /stepNumber/);
    assert.match(script, /feedbackType/);
    assert.match(script, /comment/);
  });

  it("supports copy/export JSON and does not send feedback over the network", async () => {
    const script = await readSource("public/procedure-feedback.js");

    assert.match(script, /copy-procedure-feedback-json/);
    assert.match(script, /JSON\.stringify\(items, null, 2\)/);
    assert.match(script, /navigator\.clipboard/);
    assert.doesNotMatch(script, /fetch\(/);
    assert.doesNotMatch(script, /XMLHttpRequest/);
    assert.doesNotMatch(script, /sendBeacon/);
  });

  it("warns users not to paste confidential information", async () => {
    const script = await readSource("public/procedure-feedback.js");

    assert.match(script, /No se envía información al servidor/);
    assert.match(script, /No pegues datos personales/);
    assert.match(script, /información reservada/);
  });

  it("includes feedback script in Pages build and verification", async () => {
    const buildScript = await readSource("scripts/build-pages.mjs");
    const verifyScript = await readSource("scripts/verify-pages-artifact.mjs");

    assert.match(buildScript, /procedure-feedback\.js/);
    assert.match(verifyScript, /procedure-feedback\.js/);
    assert.match(verifyScript, /missing the feedback loop script/);
  });

  it("documents the AI-native feedback loop around ProcedureWorkflow", async () => {
    const docs = await readSource("docs/procedure-workflow-feedback-loop.md");

    assert.match(docs, /ProcedureWorkflow/);
    assert.match(docs, /outcome object/);
    assert.match(docs, /product signal/);
    assert.match(docs, /No network request/);
    assert.match(docs, /Copiar feedback JSON/);
  });
});
