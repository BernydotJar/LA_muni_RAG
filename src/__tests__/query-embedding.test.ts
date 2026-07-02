import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  QueryEmbeddingError,
  assertQueryEmbeddingDimension,
  embedQuery,
  type QueryEmbeddingProvider,
} from "../embeddings/queryEmbedding.js";

class StaticQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test";
  readonly model = "static-query-vector";
  readonly dimensions = 3;

  async embedQuery(text: string): Promise<number[]> {
    return text.length > 0 ? [0.1, 0.2, 0.3] : [0, 0, 0];
  }
}

class WrongDimensionProvider implements QueryEmbeddingProvider {
  readonly providerName = "test";
  readonly model = "wrong-dimension";
  readonly dimensions = 3;

  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2];
  }
}

describe("query embedding boundary", () => {
  it("embeds a query through the provider boundary", async () => {
    const vector = await embedQuery(new StaticQueryEmbeddingProvider(), "ordenamiento territorial");
    assert.deepEqual(vector, [0.1, 0.2, 0.3]);
  });

  it("validates expected dimensions", () => {
    assert.doesNotThrow(() => assertQueryEmbeddingDimension([0.1, 0.2, 0.3], 3));
    assert.throws(() => assertQueryEmbeddingDimension([0.1, 0.2], 3), QueryEmbeddingError);
  });

  it("rejects provider output with the wrong dimension", async () => {
    await assert.rejects(
      () => embedQuery(new WrongDimensionProvider(), "ordenamiento territorial"),
      /Expected query embedding dimension 3/
    );
  });
});
