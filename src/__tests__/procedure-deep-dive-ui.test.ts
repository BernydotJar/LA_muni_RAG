import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const readSource = (path: string): Promise<string> => readFile(path, "utf-8");

describe("procedure deep-dive UI", () => {
  it("loads the progressive enhancement without replacing the overview page", async () => {
    const feedback = await readSource("public/procedure-feedback.js");
    const page = await readSource("public/procedure-workflow.html");

    assert.match(feedback, /procedure-deep-dive\.js/);
    assert.match(feedback, /data-procedure-deep-dive/);
    assert.match(page, /procedure-workflow-form/);
    assert.match(page, /renderProcedureWorkflow/);
  });

  it("adds an explicit overview and deep-dive control", async () => {
    const source = await readSource("public/procedure-deep-dive.js");

    assert.match(source, /procedure-depth/);
    assert.match(source, /value="overview" checked/);
    assert.match(source, /value="deep_dive"/);
    assert.match(source, /Ver flujo completo/);
    assert.match(source, /searchParams\.set\("depth", depth\)/);
  });

  it("renders governed step evidence and only supported responsibility metadata", async () => {
    const source = await readSource("public/procedure-deep-dive.js");

    assert.match(source, /evidenceStatus/);
    assert.match(source, /Respaldado/);
    assert.match(source, /Inferido/);
    assert.match(source, /Sin evidencia suficiente/);
    assert.match(source, /responsibleRole/);
    assert.match(source, /responsibleUnit/);
    assert.match(source, /step\.deadline/);
    assert.match(source, /No encontré base documental suficiente para afirmar este paso/);
  });

  it("renders dependencies and expandable escaped citations", async () => {
    const source = await readSource("public/procedure-deep-dive.js");

    assert.match(source, /Dependencias y decisiones/);
    assert.match(source, /citation-dossier/);
    assert.match(source, /<details class=/);
    assert.match(source, /div\.textContent = String\(value \?\? ""\)/);
    assert.match(source, /esc\(citation\.excerpt/);
    assert.match(source, /esc\(dependency\.statement/);
  });

  it("promotes only static demo responses and preserves backend deep-dive responses", async () => {
    const source = await readSource("public/procedure-deep-dive.js");

    assert.match(source, /promoteDemoWorkflow/);
    assert.match(source, /payload\?\.metadata\?\.depth === "deep_dive"/);
    assert.match(source, /procedure_workflow_advisor_deep_dive_v1/);
    assert.match(source, /requires review|requiere validación|validación contra documentos oficiales/i);
  });
});
