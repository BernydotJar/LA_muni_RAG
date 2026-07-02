import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectFormat } from "../ingestion/detectFormat.js";
import { markdownExtractor } from "../ingestion/extractors/markdownExtractor.js";
import { extractByPath } from "../ingestion/registry.js";

describe("markdown ingestion", () => {
  it("detects markdown extensions", () => {
    assert.equal(detectFormat("data/raw/core-documents/reglamento.md"), "markdown");
    assert.equal(detectFormat("data/raw/core-documents/reglamento.markdown"), "markdown");
  });

  it("normalizes headings into citable sections", async () => {
    const doc = await markdownExtractor.extract({
      title: "Reglamento de Prueba",
      sourcePath: "reglamento.md",
      content: `# Reglamento de Prueba

Texto introductorio.

## Articulo 1 Objeto

Regular el ordenamiento territorial.

### Alcance

Aplica al municipio.
`,
    });

    assert.equal(doc.sourceFormat, "markdown");
    assert.equal(doc.title, "Reglamento de Prueba");
    assert.equal(doc.sections.length, 3);

    const article = doc.sections[1];
    assert.equal(article?.heading, "Articulo 1 Objeto");
    assert.equal(article?.sectionType, "article");
    assert.equal(article?.articleNumber, "1");
    assert.deepEqual(article?.sectionPath, ["Reglamento de Prueba", "Articulo 1 Objeto"]);
    assert.equal(article?.citationLabel, "Reglamento de Prueba, articulo 1");

    const nested = doc.sections[2];
    assert.deepEqual(nested?.sectionPath, ["Reglamento de Prueba", "Articulo 1 Objeto", "Alcance"]);
    assert.ok(nested?.text.includes("Aplica al municipio."));
  });

  it("extracts markdown through the registry", async () => {
    const doc = await extractByPath("acta.md", {
      title: "Acta Municipal",
      content: "## Punto Primero\n\nSe conoce el expediente.",
    });

    assert.equal(doc.sourceFormat, "markdown");
    assert.equal(doc.sections[0]?.heading, "Punto Primero");
  });
});
