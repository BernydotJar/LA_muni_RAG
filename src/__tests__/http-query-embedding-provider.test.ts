import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HttpQueryEmbeddingProvider,
  type QueryEmbeddingTransport,
} from "../embeddings/httpQueryEmbeddingProvider.js";
import { QueryEmbeddingError } from "../embeddings/queryEmbedding.js";

const response = (status: number, payload: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  async json() {
    return payload;
  },
});

describe("HTTP query embedding provider", () => {
  it("maps provider responses into query vectors", async () => {
    let capturedBody: unknown;
    let capturedAuthorization = "";

    const transport: QueryEmbeddingTransport = async (_url, init) => {
      capturedBody = JSON.parse(init.body);
      capturedAuthorization = init.headers.authorization;
      return response(200, { data: [{ embedding: [0.1, 0.2, 0.3] }] });
    };

    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      transport,
    });

    const vector = await provider.embedQuery("ordenamiento territorial");

    assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    assert.deepEqual(capturedBody, { model: "test-model", input: "ordenamiento territorial" });
    assert.equal(capturedAuthorization, "Bearer test-key");
  });

  it("rejects wrong-dimension provider responses", async () => {
    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      transport: async () => response(200, { data: [{ embedding: [0.1, 0.2] }] }),
    });

    await assert.rejects(() => provider.embedQuery("query"), /Expected query embedding dimension 3/);
  });

  it("normalizes invalid provider responses", async () => {
    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      transport: async () => response(200, { data: [{ embedding: [0.1, "bad", 0.3] }] }),
    });

    await assert.rejects(() => provider.embedQuery("query"), QueryEmbeddingError);
  });

  it("maps HTTP failures into stable query embedding errors", async () => {
    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      transport: async () => response(503, { error: "unavailable" }),
    });

    await assert.rejects(() => provider.embedQuery("query"), (error) => {
      assert.ok(error instanceof QueryEmbeddingError);
      assert.equal(error.code, "query_embedding_provider_error");
      assert.equal(error.retryable, true);
      return true;
    });
  });

  it("aborts and fails retryably when the provider exceeds its timeout", async () => {
    let observedSignal: AbortSignal | undefined;
    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      timeoutMs: 20,
      transport: async (_url, init) => {
        observedSignal = init.signal;
        return new Promise(() => undefined);
      },
    });

    await assert.rejects(() => provider.embedQuery("query"), (error) => {
      assert.ok(error instanceof QueryEmbeddingError);
      assert.equal(error.code, "query_embedding_request_timeout");
      assert.equal(error.retryable, true);
      return true;
    });
    assert.equal(observedSignal?.aborted, true);
  });

  it("maps transport failures into retryable query embedding errors", async () => {
    const provider = new HttpQueryEmbeddingProvider({
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      transport: async () => {
        throw new Error("network unavailable");
      },
    });

    await assert.rejects(() => provider.embedQuery("query"), (error) => {
      assert.ok(error instanceof QueryEmbeddingError);
      assert.equal(error.code, "query_embedding_request_failed");
      assert.equal(error.retryable, true);
      return true;
    });
  });
});
