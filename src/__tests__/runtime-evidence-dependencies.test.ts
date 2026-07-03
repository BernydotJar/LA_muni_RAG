import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import {
  createRuntimeEvidenceDependencies,
  createRuntimeEvidenceDependencyContext,
} from "../runtime/evidenceDependencies.js";
import type { QueryEmbeddingTransport } from "../embeddings/httpQueryEmbeddingProvider.js";

const completeEnv = {
  DATABASE_URL: "postgresql://user:secret-password@example.test:5432/db",
  QUERY_EMBEDDING_PROVIDER: "http",
  QUERY_EMBEDDING_ENDPOINT: "https://secret-provider.example.test/embeddings",
  QUERY_EMBEDDING_API_KEY: "super-secret-api-key",
  QUERY_EMBEDDING_MODEL: "test-model",
  QUERY_EMBEDDING_DIMENSIONS: "3",
};

const fakePool = {
  async query() {
    return { rows: [] };
  },
} as unknown as Pool;

const transport: QueryEmbeddingTransport = async () => ({
  ok: true,
  status: 200,
  async json() {
    return { data: [{ embedding: [0.1, 0.2, 0.3] }] };
  },
});

const assertNoSecretLeak = (value: unknown): void => {
  const serialized = JSON.stringify(value);
  assert.ok(!serialized.includes("super-secret-api-key"));
  assert.ok(!serialized.includes("secret-password"));
  assert.ok(!serialized.includes("secret-provider.example.test"));
  assert.ok(!serialized.includes("postgresql://"));
};

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
    const localTransport: QueryEmbeddingTransport = async () => {
      transportCalled = true;
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [{ embedding: [0.1, 0.2, 0.3] }] };
        },
      };
    };

    const dependencies = createRuntimeEvidenceDependencies({
      env: completeEnv,
      pool: fakePool,
      queryEmbeddingTransport: localTransport,
    });

    assert.ok(dependencies.queryEmbeddingProvider);
    assert.ok(dependencies.vectorRepository);
    assert.deepEqual(await dependencies.queryEmbeddingProvider.embedQuery("query"), [0.1, 0.2, 0.3]);
    assert.equal(transportCalled, true);
  });

  it("reports disabled status when query embedding config is missing", () => {
    const context = createRuntimeEvidenceDependencyContext({ env: {} });

    assert.equal(context.vectorStatus.state, "disabled");
    assert.deepEqual(context.vectorStatus.reasons.sort(), [
      "missing_database_config",
      "missing_query_embedding_config",
    ]);
    assert.equal(context.vectorStatus.queryEmbeddingProviderConfigured, false);
    assert.equal(context.vectorStatus.vectorRepositoryConfigured, false);
    assertNoSecretLeak(context.vectorStatus);
  });

  it("reports degraded status when database config is missing", () => {
    const context = createRuntimeEvidenceDependencyContext({
      env: {
        QUERY_EMBEDDING_PROVIDER: "http",
        QUERY_EMBEDDING_ENDPOINT: "https://secret-provider.example.test/embeddings",
        QUERY_EMBEDDING_API_KEY: "super-secret-api-key",
        QUERY_EMBEDDING_MODEL: "test-model",
        QUERY_EMBEDDING_DIMENSIONS: "3",
      },
      queryEmbeddingTransport: transport,
    });

    assert.equal(context.vectorStatus.state, "degraded");
    assert.deepEqual(context.vectorStatus.reasons.sort(), [
      "missing_database_config",
      "partial_runtime_dependencies",
    ]);
    assert.equal(context.vectorStatus.queryEmbeddingProviderConfigured, true);
    assert.equal(context.vectorStatus.vectorRepositoryConfigured, false);
    assert.equal(context.vectorStatus.providerName, "http");
    assert.equal(context.vectorStatus.model, "test-model");
    assert.equal(context.vectorStatus.expectedDimensions, 3);
    assertNoSecretLeak(context.vectorStatus);
  });

  it("reports enabled status when runtime vector config is complete", () => {
    const context = createRuntimeEvidenceDependencyContext({
      env: completeEnv,
      pool: fakePool,
      queryEmbeddingTransport: transport,
    });

    assert.equal(context.vectorStatus.state, "enabled");
    assert.deepEqual(context.vectorStatus.reasons, ["runtime_dependencies_ready"]);
    assert.equal(context.vectorStatus.queryEmbeddingProviderConfigured, true);
    assert.equal(context.vectorStatus.vectorRepositoryConfigured, true);
    assert.equal(context.vectorStatus.providerName, "http");
    assert.equal(context.vectorStatus.model, "test-model");
    assert.equal(context.vectorStatus.expectedDimensions, 3);
    assertNoSecretLeak(context.vectorStatus);
  });
});
