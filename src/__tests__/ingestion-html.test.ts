import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectFormat } from "../ingestion/detectFormat.js";
import { htmlExtractor } from "../ingestion/extractors/htmlExtractor.js";
import { extractByPath } from "../ingestion/registry.js";

describe("HTML ingestion", () => {
  it("detects HTML extensions", () => {
    assert.equal(detectFormat("portal.html"), "html");
    assert.equal(detectFormat("portal.htm"), "html");
  });

  it("extracts citable heading sections and removes executable content", async () => {
    const document = await htmlExtractor.extract({
      title: "Guía Oficial",
      sourcePath: "guia.html",
      content: `<!doctype html>
        <html><head><style>.secret{display:none}</style><script>steal()</script></head>
        <body>
          <h1>Guía &amp; requisitos</h1>
          <p>Texto introductorio.</p>
          <h2>Artículo 7 Requisitos</h2>
          <p>Presentar solicitud y certificación&nbsp;municipal.</p>
          <h3>Documentos</h3><ul><li>Plano</li><li>Presupuesto</li></ul>
        </body></html>`,
    });

    assert.equal(document.sourceFormat, "html");
    assert.equal(document.sections.length, 3);
    assert.equal(document.sections[0]?.heading, "Guía & requisitos");
    assert.equal(document.sections[1]?.articleNumber, "7");
    assert.equal(document.sections[1]?.citationLabel, "Guía Oficial, articulo 7");
    assert.deepEqual(document.sections[2]?.sectionPath, [
      "Guía & requisitos",
      "Artículo 7 Requisitos",
      "Documentos",
    ]);
    assert.match(document.sections[2]?.text ?? "", /Plano/);
    assert.doesNotMatch(document.text, /steal|secret/);
  });

  it("extracts HTML through the registry", async () => {
    const document = await extractByPath("requisitos.html", {
      title: "Requisitos",
      content: "<h2>Solicitud</h2><p>Adjuntar identificación.</p>",
    });
    assert.equal(document.sourceFormat, "html");
    assert.equal(document.sections[0]?.heading, "Solicitud");
  });
});
