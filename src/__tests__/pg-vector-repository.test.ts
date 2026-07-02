import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_VECTOR_DIMENSION,
  PgVectorRepositoryError,
  assertVectorDimension,
  embeddingRecordToPgVectorValues,
  pgVectorRowToVectorCandidate,
  toPgVectorLiteral,
} from "../embeddings/pgVectorRepository.js";
import type { EmbeddingVectorRecord } from "../embeddings/types.js";

const embeddingRecord = (overrides: Partial<EmbeddingVectorRecord> = {}): EmbeddingVectorRecord => ({
  chunk: {
    chunkId: "pdm-ot:official:chunk-1",
    chunkOrdinal: 1,
    text: "Planificacion territorial para el municipio.",
    contentSha256: "abc123",
    tokenEstimate: 12,
    source: {
      documentKey: "pdm-ot",
      documentTitle: "PDM-OT Antigua Guatemala",
      documentVersion: "official-pdf",
      sourceFormat: "pdf",
      sectionPath: ["Pagina 14"],
      sectionType: "page",
      pageStart: 14,
      pageEnd: 14,
      articleNumber: null,
      citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
    },
    metadata: { sourcePath: "pdm_ot.pdf" },
  },
  embedding: Array.from({ length: DEFAULT_VECTOR_DIMENSION }, (_, index) => index / DEFAULT_VECTOR_DIMENSION),
  embeddingModel: "text-embedding-3-small",
  embeddingProvider: "openai",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
  status: "embedded",
  indexedAt: "2026-07-02T00:00:00.000Z",
  failure: null,
  ...overrides,
});

describe("pgvector repository mapping", () => {
  it("formats vectors as pgvector literals", () => {
    assert.equal(toPgVectorLiteral([0.1, 0.2, 0.3]), "[0.1,0.2,0.3]");
  });

  it("rejects non-finite vector values", () => {
    assert.throws(() => toPgVectorLiteral([0.1, Number.NaN]), PgVectorRepositoryError);
  });

  it("validates vector dimensions", () => {
    assert.doesNotThrow(() => assertVectorDimension([0.1, 0.2], 2));
    assert.throws(() => assertVectorDimension([0.1], 2), /Expected vector dimension 2/);
  });

  it("maps embedding records to pgvector upsert values", () => {
    const values = embeddingRecordToPgVectorValues(embeddingRecord());

    assert.equal(values.chunkId, "pdm-ot:official:chunk-1");
    assert.equal(values.documentKey, "pdm-ot");
    assert.equal(values.documentVersion, "official-pdf");
    assert.equal(values.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
    assert.equal(values.embeddingDimension, DEFAULT_VECTOR_DIMENSION);
    assert.equal(values.sectionPath[0], "Pagina 14");
    assert.ok(values.embeddingLiteral.startsWith("[0,"));
  });

  it("rejects records without citation labels", () => {
    const record = embeddingRecord({
      chunk: {
        ...embeddingRecord().chunk,
        source: {
          ...embeddingRecord().chunk.source,
          citationLabel: null,
        },
      },
    });

    assert.throws(() => embeddingRecordToPgVectorValues(record), /citation labels/);
  });

  it("maps vector rows to vector retrieval candidates", () => {
    const candidate = pgVectorRowToVectorCandidate({
      chunk_id: "chunk-1",
      document_key: "pdm-ot",
      document_version: "official-pdf",
      document_title: "PDM-OT Antigua Guatemala",
      citation_label: "PDM-OT Antigua Guatemala, pagina 14",
      page_start: 14,
      page_end: 14,
      article_number: null,
      source_type: "pdf",
      section_path: ["Pagina 14"],
      section_type: "page",
      chunk_ordinal: 1,
      chunk_text: "Planificacion territorial.",
      content_sha256: "abc123",
      token_estimate: 10,
      embedding_model: "text-embedding-3-small",
      embedding_provider: "openai",
      embedding_dimension: DEFAULT_VECTOR_DIMENSION,
      embedding: "[0.1,0.2]",
      metadata: { sourcePath: "pdm_ot.pdf" },
      indexed_at: "2026-07-02T00:00:00.000Z",
      similarity: "0.91",
    });

    assert.equal(candidate.chunkId, "chunk-1");
    assert.equal(candidate.documentTitle, "PDM-OT Antigua Guatemala");
    assert.equal(candidate.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
    assert.equal(candidate.similarity, 0.91);
    assert.equal(candidate.metadata?.embeddingDimension, DEFAULT_VECTOR_DIMENSION);
  });
});
