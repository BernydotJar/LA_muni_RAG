import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { indexDocument } from "../embeddings/indexer.js";
import { DeterministicTestEmbeddingProvider } from "../embeddings/provider.js";
import { InMemoryEmbeddingRepository } from "../embeddings/repository.js";
import type { EmbeddingProvider } from "../embeddings/types.js";
import type { NormalizedDocument } from "../ingestion/types.js";

const documentFixture = (): NormalizedDocument => ({
  title: "PDM-OT Antigua Guatemala",
  sourceFormat: "pdf",
  text: "Planificacion territorial.",
  sections: [
    {
      heading: "Pagina 14",
      sectionType: "page",
      sectionPath: ["Pagina 14"],
      text: "Planificacion territorial para el municipio.",
      pageStart: 14,
      pageEnd: 14,
      articleNumber: null,
      citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
      metadata: { ordinal: 1 },
    },
  ],
  metadata: { sourcePath: "pdm_ot.pdf" },
});

class FailingProvider implements EmbeddingProvider {
  readonly providerName = "failing-provider";
  readonly model = "failing-model";
  readonly dimensions = 3;

  async embed(_texts: string[]): Promise<number[][]> {
    throw new Error("provider unavailable");
  }
}

class WrongDimensionProvider implements EmbeddingProvider {
  readonly providerName = "wrong-dimension-provider";
  readonly model = "wrong-dimension-model";
  readonly dimensions = 3;

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.1, 0.2]);
  }
}

class FewerVectorsProvider implements EmbeddingProvider {
  readonly providerName = "fewer-vectors-provider";
  readonly model = "fewer-vectors-model";
  readonly dimensions = 3;

  async embed(_texts: string[]): Promise<number[][]> {
    return [];
  }
}

class ExtraVectorsProvider implements EmbeddingProvider {
  readonly providerName = "extra-vectors-provider";
  readonly model = "extra-vectors-model";
  readonly dimensions = 3;

  async embed(texts: string[]): Promise<number[][]> {
    return [...texts.map(() => [0.1, 0.2, 0.3]), [0.4, 0.5, 0.6]];
  }
}

describe("embedding indexer", () => {
  it("indexes document chunks into the repository", async () => {
    const repository = new InMemoryEmbeddingRepository();
    const provider = new DeterministicTestEmbeddingProvider(4);

    const result = await indexDocument(
      documentFixture(),
      { documentKey: "pdm-ot", documentVersion: "official-pdf" },
      provider,
      repository,
      { now: () => new Date("2026-07-02T00:00:00.000Z") }
    );

    assert.equal(result.plannedCount, 1);
    assert.equal(result.embeddedCount, 1);
    assert.equal(result.insertedCount, 1);
    assert.equal(result.failedCount, 0);

    const records = await repository.list();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.embeddingDimension, 4);
    assert.equal(records[0]?.chunk.source.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
  });

  it("is idempotent for unchanged chunks", async () => {
    const repository = new InMemoryEmbeddingRepository();
    const provider = new DeterministicTestEmbeddingProvider(4);
    const input = { documentKey: "pdm-ot", documentVersion: "official-pdf" };

    await indexDocument(documentFixture(), input, provider, repository);
    const second = await indexDocument(documentFixture(), input, provider, repository);

    assert.equal(second.insertedCount, 0);
    assert.equal(second.updatedCount, 0);
    assert.equal(second.unchangedCount, 1);
    assert.equal((await repository.list()).length, 1);
  });

  it("reports provider failures without writing records", async () => {
    const repository = new InMemoryEmbeddingRepository();

    const result = await indexDocument(
      documentFixture(),
      { documentKey: "pdm-ot", documentVersion: "official-pdf" },
      new FailingProvider(),
      repository
    );

    assert.equal(result.failedCount, 1);
    assert.equal(result.failures[0]?.code, "embedding_pipeline_failed");
    assert.equal(result.failures[0]?.retryable, true);
    assert.equal((await repository.list()).length, 0);
  });

  it("reports dimension mismatch without writing records", async () => {
    const repository = new InMemoryEmbeddingRepository();

    const result = await indexDocument(
      documentFixture(),
      { documentKey: "pdm-ot", documentVersion: "official-pdf" },
      new WrongDimensionProvider(),
      repository
    );

    assert.equal(result.failedCount, 1);
    assert.equal(result.failures[0]?.code, "embedding_dimension_mismatch");
    assert.equal(result.failures[0]?.retryable, false);
    assert.equal((await repository.list()).length, 0);
  });

  it("reports fewer-vector count mismatch without writing records", async () => {
    const repository = new InMemoryEmbeddingRepository();

    const result = await indexDocument(
      documentFixture(),
      { documentKey: "pdm-ot", documentVersion: "official-pdf" },
      new FewerVectorsProvider(),
      repository
    );

    assert.equal(result.failedCount, 1);
    assert.equal(result.failures[0]?.code, "embedding_vector_count_mismatch");
    assert.equal(result.failures[0]?.retryable, false);
    assert.equal((await repository.list()).length, 0);
  });

  it("reports extra-vector count mismatch without writing records", async () => {
    const repository = new InMemoryEmbeddingRepository();

    const result = await indexDocument(
      documentFixture(),
      { documentKey: "pdm-ot", documentVersion: "official-pdf" },
      new ExtraVectorsProvider(),
      repository
    );

    assert.equal(result.failedCount, 1);
    assert.equal(result.failures[0]?.code, "embedding_vector_count_mismatch");
    assert.equal(result.failures[0]?.retryable, false);
    assert.equal((await repository.list()).length, 0);
  });
});
