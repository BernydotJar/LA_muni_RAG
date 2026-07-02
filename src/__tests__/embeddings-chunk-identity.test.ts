import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildChunkId, sha256Hex } from "../embeddings/chunkIdentity.js";
import type { EmbeddingSource } from "../embeddings/types.js";

const sourceFixture = (overrides: Partial<EmbeddingSource> = {}): EmbeddingSource => ({
  documentKey: "codigo-municipal",
  documentTitle: "Codigo Municipal",
  documentVersion: "decreto-12-2002",
  sourceFormat: "txt",
  sectionPath: ["Articulo 1"],
  sectionType: "article",
  pageStart: null,
  pageEnd: null,
  articleNumber: "1",
  citationLabel: "Codigo Municipal, articulo 1",
  ...overrides,
});

describe("embedding chunk identity", () => {
  it("builds stable ids for the same source and content", () => {
    const source = sourceFixture();
    const contentHash = sha256Hex("El municipio es autonomo.");

    const first = buildChunkId(source, contentHash, 1);
    const second = buildChunkId(source, contentHash, 1);

    assert.equal(first, second);
    assert.equal(first.length, 64);
  });

  it("changes ids when content changes", () => {
    const source = sourceFixture();

    const first = buildChunkId(source, sha256Hex("contenido A"), 1);
    const second = buildChunkId(source, sha256Hex("contenido B"), 1);

    assert.notEqual(first, second);
  });

  it("changes ids when version changes", () => {
    const contentHash = sha256Hex("mismo contenido");

    const first = buildChunkId(sourceFixture({ documentVersion: "v1" }), contentHash, 1);
    const second = buildChunkId(sourceFixture({ documentVersion: "v2" }), contentHash, 1);

    assert.notEqual(first, second);
  });

  it("changes ids when section type changes", () => {
    const contentHash = sha256Hex("mismo contenido");

    const first = buildChunkId(sourceFixture({ sectionType: "paragraph" }), contentHash, 1);
    const second = buildChunkId(sourceFixture({ sectionType: "article" }), contentHash, 1);

    assert.notEqual(first, second);
  });

  it("changes ids when citation label changes", () => {
    const contentHash = sha256Hex("mismo contenido");

    const first = buildChunkId(sourceFixture({ citationLabel: "Codigo Municipal, articulo 1" }), contentHash, 1);
    const second = buildChunkId(sourceFixture({ citationLabel: "Codigo Municipal, articulo 1 reformado" }), contentHash, 1);

    assert.notEqual(first, second);
  });
});
