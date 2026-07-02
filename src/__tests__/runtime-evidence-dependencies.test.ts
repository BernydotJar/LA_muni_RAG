import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { createRuntimeEvidenceDependencies } from "../runtime/evidenceDependencies.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

describe("runtime evidence dependencies", () => {
  it("returns empty dependencies when query embedding config is missing", () => {
    const dependencies = createRuntimeEvidenceDependencies({ env: {} });

    assert.equal(dependencies.queryEmbeddingProvider, undefined);
    assert.equal(dependencies.vectorRepository, undefined);
  });

  it("returns empty dependencies when database config is missing", () => {
    const dependencies = createRuntimeEvidenceDependencies({
      env: {
        QUERY_EMBEDDING_PROVIDER: "http",
        QUERY_EMBEDDING_ENDPOINT: "https://example.test/embeddings",
        QUERY_EMBEDDING_API_KEY: "test-key",
        QUERY_EMBEDDING_MODEL: "test-model",
        QUERY_EMBEDDING_DIMENSIONS: "3",
      },
    });

    assert.equal(dependencies.queryEmbeddingProvider, undefined);
    assert.equal(dependencies.vectorRepository, undefined);
  });

  it("creates query embedding and vector dependencies when config is complete", async () => {
    let transportCalled = false;
    const transport: QueryEmbeddingTransport = async () => {
      transportCalled = true;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [{ embedding: [0.1, 0.2, 0.3] }] };
        },
      };
    };

    const fakePool = {
      async query() {
        return { rows: [] };
      },
    } as unknown as Pool;

    const dependencies = createRuntimeEvidenceDependencies({
      env: {
        DATABASE_URL: "postgresql://local-test-only",
        QUERY_EMBEDDING_PROVIDER: "http",
        QUERY_EMBEDDING_ENDPOINT: "https://example.test/embeddings",
        QUERY_EMBEDDING_API_KEY: "test-key",
        QUERY_EMBEDDING_MODEL: "test-model",
        QUERY_EMBEDDING_DIMENSIONS: "3",
      },
      pool: fakePool,
      queryEmbeddingTransport: transport,
    });

    assert.ok(dependencies.queryEmbeddingProvider);
    assert.ok(dependencies.vectorRepository);
    assert.deepEqual(await dependencies.queryEmbeddingProvider.embedQuery("query"), [0.1, 0.2, 0.3]);
    assert.equal(transportCalled, true);
  });
});
