import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planChunks } from "../embeddings/chunkPlanner.js";
import type { NormalizedDocument } from "../ingestion/types.js";

const documentFixture = (): NormalizedDocument => ({
  title: "Reglamento Municipal",
  sourceFormat: "markdown",
  text: "Articulo 1 Objeto\nRegular el ordenamiento territorial.",
  sections: [
    {
      heading: "Articulo 1 Objeto",
      sectionType: "article",
      sectionPath: ["Reglamento Municipal", "Articulo 1 Objeto"],
      text: "Regular el ordenamiento territorial.",
      pageStart: null,
      pageEnd: null,
      articleNumber: "1",
      citationLabel: "Reglamento Municipal, articulo 1",
      metadata: { ordinal: 1 },
    },
  ],
  metadata: {
    sourcePath: "reglamento.md",
    extractionMethod: "markdown_heading_v1",
    municipality: "La Antigua Guatemala",
  },
});

describe("embedding chunk planner", () => {
  it("keeps simple sections as a single citation-preserving chunk", () => {
    const chunks = planChunks(documentFixture(), {
      documentKey: "reglamento-municipal",
      documentVersion: "v1",
    });

    assert.equal(chunks.length, 1);
    assert.equal(chunks[0]?.chunkOrdinal, 1);
    assert.equal(chunks[0]?.source.documentTitle, "Reglamento Municipal");
    assert.equal(chunks[0]?.source.articleNumber, "1");
    assert.equal(chunks[0]?.source.citationLabel, "Reglamento Municipal, articulo 1");
    assert.equal(chunks[0]?.metadata.sourcePath, "reglamento.md");
    assert.equal(chunks[0]?.metadata.sourceFormat, "markdown");
    assert.deepEqual(chunks[0]?.metadata.documentMetadata, {
      sourcePath: "reglamento.md",
      extractionMethod: "markdown_heading_v1",
      municipality: "La Antigua Guatemala",
    });
    assert.ok(chunks[0]?.contentSha256);
    assert.ok((chunks[0]?.tokenEstimate ?? 0) > 0);
  });

  it("splits long sections while preserving source metadata", () => {
    const document = documentFixture();
    document.sections[0] = {
      ...document.sections[0],
      text: "Parrafo uno con informacion municipal.\n\nParrafo dos con mas informacion.\n\nParrafo tres con cierre.",
    };

    const chunks = planChunks(
      document,
      {
        documentKey: "reglamento-municipal",
        documentVersion: "v1",
      },
      {
        maxChars: 55,
        overlapChars: 10,
      }
    );

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.source.citationLabel === "Reglamento Municipal, articulo 1"));
    assert.deepEqual(chunks.map((chunk) => chunk.chunkOrdinal), [1, 2, 3]);
  });
});
