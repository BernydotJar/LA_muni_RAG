import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { detectFormat } from "../ingestion/detectFormat.js";
import { docxExtractor, REQUIRED_DOCX_PACKAGE } from "../ingestion/extractors/docxExtractor.js";
import { extractByPath, registeredFormats } from "../ingestion/registry.js";
import { IngestionError } from "../ingestion/types.js";

describe("docx ingestion", () => {
  it("detects docx extensions", () => {
    assert.equal(detectFormat("documento.docx"), "docx");
  });

  it("registers docx and exposes the parser dependency name", () => {
    assert.ok(registeredFormats().includes("docx"));
    assert.equal(REQUIRED_DOCX_PACKAGE, "mammoth");
  });

  it("extracts raw text into a NormalizedDocument", async () => {
    const content = await readFile("node_modules/mammoth/test/test-data/single-paragraph.docx");
    const doc = await docxExtractor.extract({
      title: "Documento Word",
      sourcePath: "single-paragraph.docx",
      content,
    });

    assert.equal(doc.sourceFormat, "docx");
    assert.equal(doc.title, "Documento Word");
    assert.ok(doc.text.includes("Walking on imported air"));
    assert.equal(doc.sections.length, 1);
    assert.equal(doc.sections[0]?.sectionType, "paragraph");
    assert.ok(doc.sections[0]?.citationLabel?.includes("Documento Word"));
    assert.equal(doc.metadata.extractor, "mammoth_raw_text_v1");
  });

  it("extracts DOCX through the registry", async () => {
    const content = await readFile("node_modules/mammoth/test/test-data/single-paragraph.docx");
    const doc = await extractByPath("single-paragraph.docx", {
      title: "Documento Word",
      content,
    });

    assert.equal(doc.sourceFormat, "docx");
    assert.ok(doc.sections[0]?.text.includes("Walking on imported air"));
  });

  it("normalizes invalid DOCX failures into a stable ingestion error", async () => {
    await assert.rejects(
      () =>
        Promise.resolve(docxExtractor.extract({
          title: "Documento corrupto",
          content: Buffer.from("not-a-docx"),
        })),
      (error: unknown) => {
        assert.ok(error instanceof IngestionError);
        assert.equal(error.code, "docx_extraction_failed");
        assert.equal(error.sourceFormat, "docx");
        assert.ok(error.message.includes("DOCX extraction failed"));
        assert.ok(error.cause instanceof Error);
        return true;
      }
    );
  });

  it("normalizes empty DOCX failures into the same stable ingestion error", async () => {
    await assert.rejects(
      () =>
        Promise.resolve(docxExtractor.extract({
          title: "Documento vacio",
          content: Buffer.alloc(0),
        })),
      (error: unknown) => {
        assert.ok(error instanceof IngestionError);
        assert.equal(error.code, "docx_extraction_failed");
        assert.equal(error.sourceFormat, "docx");
        assert.ok(error.cause instanceof Error);
        return true;
      }
    );
  });
});
