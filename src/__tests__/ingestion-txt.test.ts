import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCitationLabel } from "../ingestion/citation.js";
import { detectFormat } from "../ingestion/detectFormat.js";
import { normalizeExistingPdfSections } from "../ingestion/extractors/pdfExtractorAdapter.js";
import { extractByPath, registeredFormats } from "../ingestion/registry.js";
import { txtExtractor } from "../ingestion/extractors/txtExtractor.js";

describe("txt ingestion", () => {
  it("detects txt extensions", () => {
    assert.equal(detectFormat("documento.txt"), "txt");
  });

  it("splits article-like text into normalized sections", async () => {
    const doc = await txtExtractor.extract({
      title: "Codigo Municipal",
      sourcePath: "codigo.txt",
      content: `ARTICULO 1 Naturaleza
El municipio es una institucion autonoma.

ARTICULO 2 Competencias
Debe prestar servicios publicos.
`,
    });

    assert.equal(doc.sourceFormat, "txt");
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.sections[0]?.sectionType, "article");
    assert.equal(doc.sections[0]?.articleNumber, "1");
    assert.equal(doc.sections[0]?.citationLabel, "Codigo Municipal, articulo 1");
    assert.ok(doc.sections[1]?.text.includes("servicios publicos"));
  });

  it("builds citation labels with page priority", () => {
    assert.equal(
      buildCitationLabel({ title: "PDM-OT Antigua Guatemala", pageStart: 12 }),
      "PDM-OT Antigua Guatemala, pagina 12"
    );
  });
});

describe("pdf adapter", () => {
  it("normalizes existing PDF JSONL sections without changing the PDF flow", () => {
    const doc = normalizeExistingPdfSections({
      title: "PDM-OT Antigua Guatemala",
      sections: [
        {
          page: 12,
          section_type: "section",
          section_label: "Pagina 12",
          title: "Pagina 12",
          citation_label: "PDM-OT Antigua Guatemala, pagina 12",
          content: "SIGLAS Y ACRONIMOS\nCNPAG Consejo Nacional...",
          content_sha256: "abc123",
        },
      ],
    });

    assert.equal(doc.sourceFormat, "pdf");
    assert.equal(doc.metadata.sourceFlow, "scripts/extract_pdf_sections.py");
    assert.equal(doc.sections[0]?.sectionType, "page");
    assert.equal(doc.sections[0]?.pageStart, 12);
    assert.equal(doc.sections[0]?.citationLabel, "PDM-OT Antigua Guatemala, pagina 12");
  });

  it("routes PDF JSONL through the extractor registry", async () => {
    assert.ok(registeredFormats().includes("pdf"));

    const jsonl = JSON.stringify({
      page: 14,
      section_type: "section",
      section_label: "Pagina 14",
      title: "Pagina 14",
      citation_label: "PDM-OT Antigua Guatemala, pagina 14",
      content: "Planificacion territorial y desarrollo municipal.",
      content_sha256: "def456",
    });

    const doc = await extractByPath("pdm_ot.pdf", {
      title: "PDM-OT Antigua Guatemala",
      content: jsonl,
    });

    assert.equal(doc.sourceFormat, "pdf");
    assert.equal(doc.metadata.sourceFlow, "scripts/extract_pdf_sections.py");
    assert.equal(doc.sections[0]?.pageStart, 14);
    assert.equal(doc.sections[0]?.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
  });
});
