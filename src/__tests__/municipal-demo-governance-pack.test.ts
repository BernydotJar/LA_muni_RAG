import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readDoc = (path: string): Promise<string> => readFile(path, "utf-8");

describe("municipal demo governance pack", () => {
  it("provides a presenter-ready municipal demo script", async () => {
    const script = await readDoc("docs/municipal-demo-script.md");

    assert.match(script, /Guion de demo municipal/);
    assert.match(script, /Duración sugerida/);
    assert.match(script, /necesidades más urgentes/);
    assert.match(script, /agua/);
    assert.match(script, /Glass Wall/);
    assert.match(script, /Preguntas difíciles/);
  });

  it("documents governance limits and human review", async () => {
    const guide = await readDoc("docs/municipal-governance-readiness.md");

    assert.match(guide, /consulta documental con evidencia/);
    assert.match(guide, /Política de evidencia/);
    assert.match(guide, /Revisión humana/);
    assert.match(guide, /Evidencia sólida/);
    assert.match(guide, /Evidencia suficiente/);
    assert.match(guide, /Evidencia limitada/);
  });

  it("keeps the feature bounded to documentation and readiness tests", async () => {
    const requirements = await readDoc("specs/029-demo-script-and-governance-pack/requirements.md");
    const design = await readDoc("specs/029-demo-script-and-governance-pack/design.md");
    const tasks = await readDoc("specs/029-demo-script-and-governance-pack/tasks.md");

    assert.match(requirements, /No new APIs/);
    assert.match(requirements, /No new dependencies/);
    assert.match(design, /municipal evidence assistant/);
    assert.match(design, /Mayor or council/);
    assert.match(tasks, /demo script/);
    assert.match(tasks, /governance/);
  });
});
