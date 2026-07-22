import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createQueryEmbeddingProvider,
  loadQueryEmbeddingProviderConfig,
} from "../embeddings/queryEmbeddingFactory.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

describe("query embedding provider factory", () => {
  it("loads provider configuration from environment variables", () => {
    const config = loadQueryEmbeddingProviderConfig({
      QUERY_EMBEDDING_PROVIDER: "http",
      QUERY_EMBEDDING_ENDPOINT: "https://example.test/embeddings",
      QUERY_EMBEDDING_API_KEY: "test-key",
      QUERY_EMBEDDING_MODEL: "test-model",
      QUERY_EMBEDDING_DIMENSIONS: "3",
      QUERY_EMBEDDING_TIMEOUT_MS: "2500",
    });

    assert.deepEqual(config, {
      provider: "http",
      endpoint: "https://example.test/embeddings",
      apiKey: "test-key",
      model: "test-model",
      dimensions: 3,
      timeoutMs: 2500,
    });
  });

  it("returns null when configuration is missing", () => {
    const provider = createQueryEmbeddingProvider({ env: {} });
    assert.equal(provider, null);
  });

  it("returns null for invalid dimensions", () => {
    const provider = createQueryEmbeddingProvider({
      env: {
        QUERY_EMBEDDING_PROVIDER: "http",
        QUERY_EMBEDDING_ENDPOINT: "https://example.test/embeddings",
        QUERY_EMBEDDING_API_KEY: "test-key",
        QUERY_EMBEDDING_MODEL: "test-model",
        QUERY_EMBEDDING_DIMENSIONS: "not-a-number",
      },
    });

    assert.equal(provider, null);
  });

  it("creates a provider when configuration is complete", async () => {
    const transport: QueryEmbeddingTransport = async () => ({
      ok: true,
      status: 200,
      async json() {
        return { data: [{ embedding: [0.1, 0.2, 0.3] }] };
      },
    });

    const provider = createQueryEmbeddingProvider({
      env: {
        QUERY_EMBEDDING_PROVIDER: "http",
        QUERY_EMBEDDING_ENDPOINT: "https://example.test/embeddings",
        QUERY_EMBEDDING_API_KEY: "test-key",
        QUERY_EMBEDDING_MODEL: "test-model",
        QUERY_EMBEDDING_DIMENSIONS: "3",
      },
      transport,
    });

    assert.ok(provider);
    assert.equal(provider.providerName, "http");
    assert.equal(provider.model, "test-model");
    assert.equal(provider.dimensions, 3);
    assert.deepEqual(await provider.embedQuery("query"), [0.1, 0.2, 0.3]);
  });
});
