import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VECTOR_DIMENSION, PgVectorRepositoryError } from "../embeddings/pgVectorRepository.js";
import { TenantPgVectorRepository } from "../embeddings/tenantPgVectorRepository.js";
import type { EmbeddingVectorRecord } from "../embeddings/types.js";
import type { TenantTransactionClient } from "../security/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const vector = (chunkId: string, version = "v1"): EmbeddingVectorRecord => ({
  chunk: {
    chunkId,
    chunkOrdinal: 1,
    text: "Evidence-backed municipal procedure.",
    contentSha256: "d".repeat(64),
    tokenEstimate: 9,
    source: {
      documentKey: "manual",
      documentTitle: "Manual municipal",
      documentVersion: version,
      sourceFormat: "pdf",
      sectionPath: ["Página 1"],
      sectionType: "page",
      pageStart: 1,
      pageEnd: 1,
      articleNumber: null,
      citationLabel: "Manual municipal, página 1",
    },
    metadata: { sourcePath: "managed/manual.pdf" },
  },
  embedding: Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0.01),
  embeddingModel: "test-model-v1",
  embeddingProvider: "test-provider",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
  status: "embedded",
  indexedAt: "2026-07-21T12:00:00.000Z",
  failure: null,
});

const clientFrom = (
  handler: (sql: string, values?: unknown[]) => unknown | Promise<unknown>
): TenantTransactionClient => ({
  query: async (sql, values) => handler(sql, values),
  release() {},
});

const repository = (client: TenantTransactionClient) => new TenantPgVectorRepository(client, {
  tenantId: TENANT,
  embeddingProvider: "test-provider",
  embeddingModel: "test-model-v1",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
});

const identity = {
  documentKey: "manual",
  documentTitle: "Manual municipal",
  documentVersion: "v1",
};

const generation = {
  documentVersionId: VERSION,
  ingestionJobId: JOB,
};

describe("EVAL-VECTOR-001", () => {
  it("publishes one complete tenant generation and removes stale chunks", async () => {
    const queries: string[] = [];
    const client = clientFrom((sql, values = []) => {
      queries.push(sql);
      if (sql.includes("SELECT chunk_id")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO rag.embedding_vectors")) {
        return { rows: [{ chunk_id: values[3] }], rowCount: 1 };
      }
      if (sql.includes("DELETE FROM rag.embedding_vectors")) return { rows: [], rowCount: 2 };
      throw new Error("unexpected query");
    });

    const result = await repository(client).replaceDocumentVersion(
      [vector("manual:v1:chunk-1")],
      identity,
      generation
    );

    assert.deepEqual(result, {
      insertedCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      deletedCount: 2,
    });
    assert.match(queries[1]!, /ON CONFLICT \(tenant_id, chunk_id\)/);
    assert.match(queries[2]!, /ingestion_job_id IS DISTINCT FROM/);
  });

  it("rejects cross-document chunk identity before mutation", async () => {
    let mutations = 0;
    const client = clientFrom((sql) => {
      if (sql.includes("SELECT chunk_id")) {
        return {
          rows: [{
            chunk_id: "shared-chunk",
            document_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            contract_version: 1,
          }],
          rowCount: 1,
        };
      }
      mutations += 1;
      return { rows: [], rowCount: 0 };
    });

    await assert.rejects(
      () => repository(client).replaceDocumentVersion([vector("shared-chunk")], identity, generation),
      (error: unknown) => error instanceof PgVectorRepositoryError &&
        error.code === "vector_chunk_identity_conflict"
    );
    assert.equal(mutations, 0);
  });

  it("bounds search and preserves server-owned provider, model, and dimension identity", async () => {
    const client = clientFrom(() => ({ rows: [], rowCount: 0 }));
    const scoped = repository(client);
    await assert.rejects(
      () => scoped.searchPublic(Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0), 101),
      /between 1 and 100/
    );
    assert.throws(
      () => new TenantPgVectorRepository(client, {
        tenantId: TENANT,
        embeddingProvider: "test-provider",
        embeddingModel: "test-model-v1",
        embeddingDimension: 384,
      }),
      /requires dimension 1536/
    );
  });
});
